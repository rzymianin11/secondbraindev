import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db, { uploadsDir } from '../db.js';
import { analyzeImage, isOpenAIConfigured } from '../services/openai.js';

const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const imagesDir = path.join(uploadsDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Analyze image with OCR
router.post('/analyze', upload.single('image'), async (req, res) => {
  if (!isOpenAIConfigured()) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const { projectId, analysisType = 'conversation' } = req.body;

  try {
    // Read image as base64
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Analyze with GPT-4 Vision
    const analysis = await analyzeImage(base64Image, mimeType, analysisType);

    // Save to database if projectId provided
    let savedAnalysis = null;
    if (projectId) {
      const result = db.prepare(`
        INSERT INTO image_analyses (projectId, filename, analysisType, extractedText, summary, tasks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        projectId,
        req.file.filename,
        analysisType,
        analysis.extractedText || null,
        analysis.summary || null,
        analysis.tasks ? JSON.stringify(analysis.tasks) : null
      );

      savedAnalysis = db.prepare('SELECT * FROM image_analyses WHERE id = ?').get(result.lastInsertRowid);
      
      // Auto-create tasks if extracted
      if (analysis.tasks && analysis.tasks.length > 0) {
        const insertTask = db.prepare(`
          INSERT INTO tasks (projectId, title, status, priority) VALUES (?, ?, 'pending', 'medium')
        `);
        
        for (const task of analysis.tasks) {
          insertTask.run(projectId, task);
        }
      }
    }

    // Clean up image file after processing (optional - keep if you want history)
    // fs.unlinkSync(imagePath);

    res.json({
      success: true,
      analysis: {
        ...analysis,
        id: savedAnalysis?.id,
        filename: req.file.filename
      }
    });

  } catch (err) {
    console.error('OCR analysis error:', err);
    // Clean up on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

// Get analysis history for a project
router.get('/project/:projectId', (req, res) => {
  const analyses = db.prepare(`
    SELECT * FROM image_analyses 
    WHERE projectId = ? 
    ORDER BY createdAt DESC
  `).all(req.params.projectId);
  
  res.json(analyses.map(a => ({
    ...a,
    tasks: a.tasks ? JSON.parse(a.tasks) : []
  })));
});

// Get single analysis
router.get('/:id', (req, res) => {
  const analysis = db.prepare('SELECT * FROM image_analyses WHERE id = ?').get(req.params.id);
  
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }
  
  res.json({
    ...analysis,
    tasks: analysis.tasks ? JSON.parse(analysis.tasks) : []
  });
});

// Delete analysis
router.delete('/:id', (req, res) => {
  const analysis = db.prepare('SELECT * FROM image_analyses WHERE id = ?').get(req.params.id);
  
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }
  
  // Delete image file
  const imagePath = path.join(uploadsDir, 'images', analysis.filename);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
  
  db.prepare('DELETE FROM image_analyses WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;

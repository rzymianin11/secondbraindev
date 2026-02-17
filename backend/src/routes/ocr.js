import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db, { uploadsDir } from '../db.js';
import { analyzeImage, analyzeText, isOpenAIConfigured } from '../services/openai.js';

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

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_TEXT_TYPES = ['text/plain', 'text/vtt'];
const ALLOWED_DOC_TYPES = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_EXTENSIONS = ['.txt', '.vtt', '.docx'];

function isAllowedFile(file) {
  const allTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_TEXT_TYPES, ...ALLOWED_DOC_TYPES];
  if (allTypes.includes(file.mimetype)) return true;
  
  // Also check by extension for files with incorrect/missing MIME types
  const ext = path.extname(file.originalname).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function isImageFile(file) {
  return ALLOWED_IMAGE_TYPES.includes(file.mimetype) || 
    file.mimetype.startsWith('image/');
}

function isTextFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  return ALLOWED_TEXT_TYPES.includes(file.mimetype) || 
    ext === '.txt' || ext === '.vtt';
}

function isDocxFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  return file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx';
}

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (isAllowedFile(file)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, TXT, VTT, DOCX'));
    }
  }
});

// Extract text from DOCX file (simple extraction without external dependencies)
async function extractDocxText(filePath) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(filePath);
  const documentXml = zip.readAsText('word/document.xml');
  
  // Simple XML text extraction - get text between <w:t> tags
  const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const text = textMatches
    .map(match => match.replace(/<[^>]+>/g, ''))
    .join('');
  
  // Add paragraph breaks
  return text.replace(/([.!?])\s*/g, '$1\n');
}

// Analyze image with OCR
router.post('/analyze', upload.single('image'), async (req, res) => {
  if (!isOpenAIConfigured()) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const { projectId, analysisType = 'conversation' } = req.body;

  try {
    const filePath = req.file.path;
    let analysis;

    if (isImageFile(req.file)) {
      // Read image as base64
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = req.file.mimetype;

      // Analyze with GPT-4 Vision
      analysis = await analyzeImage(base64Image, mimeType, analysisType);
    } else if (isTextFile(req.file)) {
      // Read text content directly
      const textContent = fs.readFileSync(filePath, 'utf-8');
      analysis = await analyzeText(textContent, analysisType);
    } else if (isDocxFile(req.file)) {
      // Extract text from DOCX
      const textContent = await extractDocxText(filePath);
      analysis = await analyzeText(textContent, analysisType);
    } else {
      throw new Error('Unsupported file type');
    }

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
      
      // Note: Tasks are NOT auto-created anymore
      // User can choose to merge or create new via the UI buttons
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

// Get analysis history for a project (with option to include all projects)
router.get('/project/:projectId', (req, res) => {
  const { includeAll } = req.query;
  
  let analyses;
  if (includeAll === 'true') {
    // Get unique images from all projects (by filename)
    analyses = db.prepare(`
      SELECT * FROM image_analyses 
      GROUP BY filename
      ORDER BY createdAt DESC
    `).all();
  } else {
    analyses = db.prepare(`
      SELECT * FROM image_analyses 
      WHERE projectId = ? 
      ORDER BY createdAt DESC
    `).all(req.params.projectId);
  }
  
  res.json(analyses.map(a => ({
    ...a,
    tasks: a.tasks ? JSON.parse(a.tasks) : []
  })));
});

// Copy image history from one project to another
router.post('/copy-history', (req, res) => {
  const { fromProjectId, toProjectId } = req.body;
  
  if (!fromProjectId || !toProjectId) {
    return res.status(400).json({ error: 'fromProjectId and toProjectId required' });
  }
  
  const analyses = db.prepare('SELECT * FROM image_analyses WHERE projectId = ?').all(fromProjectId);
  
  const copyAnalysis = db.prepare(`
    INSERT INTO image_analyses (projectId, filename, analysisType, extractedText, summary, tasks, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let copied = 0;
  for (const analysis of analyses) {
    // Check if already exists in target
    const exists = db.prepare(
      'SELECT id FROM image_analyses WHERE projectId = ? AND filename = ?'
    ).get(toProjectId, analysis.filename);
    
    if (!exists) {
      copyAnalysis.run(
        toProjectId,
        analysis.filename,
        analysis.analysisType,
        analysis.extractedText,
        analysis.summary,
        analysis.tasks,
        analysis.createdAt
      );
      copied++;
    }
  }
  
  res.json({ copied, total: analyses.length });
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

// Normalize title for matching (remove punctuation, extra spaces, lowercase)
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/g, '') // remove trailing punctuation
    .replace(/['"]/g, '') // remove quotes
    .replace(/\s+/g, ' '); // normalize whitespace
}

// Save tasks from OCR with different modes
router.post('/save-tasks', (req, res) => {
  const { projectId, tasks, mode = 'merge' } = req.body;
  
  if (!projectId || !tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'projectId and tasks array are required' });
  }
  
  // Get all existing tasks for fuzzy matching
  const allExistingTasks = db.prepare('SELECT * FROM tasks WHERE projectId = ?').all(projectId);
  const existingTasksMap = new Map();
  for (const t of allExistingTasks) {
    existingTasksMap.set(normalizeTitle(t.title), t);
  }
  
  const insertTask = db.prepare(`
    INSERT INTO tasks (projectId, title, status, priority) VALUES (?, ?, ?, ?)
  `);
  const updateTaskStatus = db.prepare(`
    UPDATE tasks SET status = ? WHERE id = ?
  `);
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const task of tasks) {
    const title = typeof task === 'string' ? task : task.title;
    const status = (typeof task === 'object' && task.status === 'done') ? 'done' : 'pending';
    const priority = (typeof task === 'object' && ['low', 'medium', 'high'].includes(task.priority)) 
      ? task.priority 
      : 'medium';
    
    if (!title) continue;
    
    const normalizedTitle = normalizeTitle(title);
    const existingTask = existingTasksMap.get(normalizedTitle);
    
    if (mode === 'create_new') {
      // Always create new tasks with AI-determined priority
      insertTask.run(projectId, title.trim(), status, priority);
      created++;
    } else {
      // Merge mode: update existing or create new
      if (existingTask) {
        if (status === 'done' && existingTask.status !== 'done') {
          updateTaskStatus.run('done', existingTask.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        insertTask.run(projectId, title.trim(), status, priority);
        created++;
      }
    }
  }
  
  res.json({ 
    success: true, 
    stats: { created, updated, skipped, total: tasks.length },
    mode 
  });
});

// Re-analyze existing image
router.post('/reanalyze', async (req, res) => {
  if (!isOpenAIConfigured()) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  const { projectId, filename, analysisType = 'conversation' } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const imagePath = path.join(uploadsDir, 'images', filename);
  
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine MIME type from extension
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // Analyze with GPT-4 Vision
    const analysis = await analyzeImage(base64Image, mimeType, analysisType);

    // Update the database record if projectId provided
    if (projectId) {
      const existingAnalysis = db.prepare(
        'SELECT id FROM image_analyses WHERE projectId = ? AND filename = ?'
      ).get(projectId, filename);

      if (existingAnalysis) {
        db.prepare(`
          UPDATE image_analyses 
          SET analysisType = ?, extractedText = ?, summary = ?, tasks = ?, createdAt = datetime('now')
          WHERE id = ?
        `).run(
          analysisType,
          analysis.extractedText || null,
          analysis.summary || null,
          analysis.tasks ? JSON.stringify(analysis.tasks) : null,
          existingAnalysis.id
        );
      }
    }

    res.json({
      success: true,
      analysis: {
        ...analysis,
        filename
      }
    });

  } catch (err) {
    console.error('Re-analysis error:', err);
    res.status(500).json({ error: 'Re-analysis failed: ' + err.message });
  }
});

// Serve image file
router.get('/image/:filename', (req, res) => {
  const imagePath = path.join(uploadsDir, 'images', req.params.filename);
  
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  res.sendFile(imagePath);
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

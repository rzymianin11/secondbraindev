import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db, { uploadsDir } from '../db.js';
import { transcribeAudio, extractTasksFromTranscript, isOpenAIConfigured } from '../services/openai.js';

const router = Router();

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `recording-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/m4a'];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// List recordings by project
router.get('/project/:projectId', (req, res) => {
  const recordings = db.prepare(`
    SELECT * FROM recordings 
    WHERE projectId = ? 
    ORDER BY createdAt DESC
  `).all(req.params.projectId);
  res.json(recordings);
});

// Get single recording with tasks
router.get('/:id', (req, res) => {
  const recording = db.prepare(`
    SELECT * FROM recordings WHERE id = ?
  `).get(req.params.id);
  
  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }
  
  const tasks = db.prepare(`
    SELECT * FROM tasks WHERE recordingId = ? ORDER BY createdAt ASC
  `).all(req.params.id);
  
  res.json({ ...recording, tasks });
});

// Upload new recording
router.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  
  const { projectId, title, duration } = req.body;
  
  if (!projectId) {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Project ID is required' });
  }
  
  // Check project exists
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const result = db.prepare(`
    INSERT INTO recordings (projectId, title, filename, duration, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    projectId,
    title || `Recording ${new Date().toLocaleString()}`,
    req.file.filename,
    duration ? parseInt(duration) : null,
    'processing'
  );
  
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(result.lastInsertRowid);
  
  res.status(201).json(recording);
});

// Transcribe recording and extract tasks
router.post('/:id/transcribe', async (req, res) => {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
  
  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }
  
  if (!isOpenAIConfigured()) {
    return res.status(503).json({ error: 'OpenAI API key is not configured' });
  }
  
  const audioPath = path.join(uploadsDir, recording.filename);
  
  if (!fs.existsSync(audioPath)) {
    db.prepare('UPDATE recordings SET status = ? WHERE id = ?').run('failed', recording.id);
    return res.status(404).json({ error: 'Audio file not found' });
  }
  
  try {
    // Update status to processing
    db.prepare('UPDATE recordings SET status = ? WHERE id = ?').run('processing', recording.id);
    
    // Transcribe audio
    const transcript = await transcribeAudio(audioPath);
    
    // Extract tasks from transcript
    const extractedTasks = await extractTasksFromTranscript(transcript);
    
    // Update recording with transcript
    db.prepare(`
      UPDATE recordings SET transcript = ?, status = ? WHERE id = ?
    `).run(transcript, 'completed', recording.id);
    
    // Insert extracted tasks
    const insertTask = db.prepare(`
      INSERT INTO tasks (projectId, recordingId, title, priority)
      VALUES (?, ?, ?, ?)
    `);
    
    const createdTasks = [];
    for (const task of extractedTasks) {
      const result = insertTask.run(recording.projectId, recording.id, task.title, task.priority);
      createdTasks.push({
        id: result.lastInsertRowid,
        projectId: recording.projectId,
        recordingId: recording.id,
        title: task.title,
        priority: task.priority,
        status: 'pending'
      });
    }
    
    // Return updated recording with tasks
    const updatedRecording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(recording.id);
    
    res.json({ 
      ...updatedRecording, 
      tasks: createdTasks,
      message: `Transcribed successfully. Extracted ${createdTasks.length} tasks.`
    });
    
  } catch (error) {
    console.error('Transcription error:', error);
    db.prepare('UPDATE recordings SET status = ? WHERE id = ?').run('failed', recording.id);
    res.status(500).json({ error: 'Transcription failed: ' + error.message });
  }
});

// Delete recording
router.delete('/:id', (req, res) => {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
  
  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }
  
  // Delete audio file
  const audioPath = path.join(uploadsDir, recording.filename);
  if (fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
  }
  
  // Delete from database (tasks will be set to NULL due to ON DELETE SET NULL)
  db.prepare('DELETE FROM recordings WHERE id = ?').run(req.params.id);
  
  res.status(204).send();
});

// Check OpenAI status
router.get('/status/openai', (req, res) => {
  res.json({ configured: isOpenAIConfigured() });
});

export default router;

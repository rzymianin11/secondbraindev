import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List all projects
router.get('/', (req, res) => {
  const projects = db.prepare(`
    SELECT * FROM projects ORDER BY createdAt DESC
  `).all();
  res.json(projects);
});

// Get single project
router.get('/:id', (req, res) => {
  const project = db.prepare(`
    SELECT * FROM projects WHERE id = ?
  `).get(req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

// Create project
router.post('/', (req, res) => {
  const { name, description } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  const result = db.prepare(`
    INSERT INTO projects (name, description) VALUES (?, ?)
  `).run(name.trim(), description?.trim() || null);
  
  const project = db.prepare(`
    SELECT * FROM projects WHERE id = ?
  `).get(result.lastInsertRowid);
  
  res.status(201).json(project);
});

// Delete project
router.delete('/:id', (req, res) => {
  const result = db.prepare(`
    DELETE FROM projects WHERE id = ?
  `).run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.status(204).send();
});

export default router;

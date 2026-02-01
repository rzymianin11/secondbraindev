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

// Update project
router.patch('/:id', (req, res) => {
  const { name, description } = req.body;
  
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const updates = [];
  const params = [];
  
  if (name !== undefined) {
    if (!name.trim()) {
      return res.status(400).json({ error: 'Project name cannot be empty' });
    }
    updates.push('name = ?');
    params.push(name.trim());
  }
  
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description?.trim() || null);
  }
  
  if (updates.length === 0) {
    return res.json(project);
  }
  
  params.push(req.params.id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(updated);
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

// Archive project and create fresh copy
router.post('/:id/archive', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const archivedName = `[Archived ${now}] ${project.name}`;
  
  // Rename current project to archived
  db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(archivedName, req.params.id);
  
  // Create new fresh project with original name
  const result = db.prepare(`
    INSERT INTO projects (name, description) VALUES (?, ?)
  `).run(project.name, project.description);
  
  const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  
  // Count what was archived
  const tasksCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE projectId = ?').get(req.params.id);
  const decisionsCount = db.prepare('SELECT COUNT(*) as count FROM decisions WHERE projectId = ?').get(req.params.id);
  
  res.json({
    archived: {
      id: req.params.id,
      name: archivedName,
      tasks: tasksCount.count,
      decisions: decisionsCount.count
    },
    newProject
  });
});

export default router;

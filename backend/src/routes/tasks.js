import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List tasks by project
router.get('/project/:projectId', (req, res) => {
  const { status, priority } = req.query;
  
  let query = 'SELECT * FROM tasks WHERE projectId = ?';
  const params = [req.params.projectId];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  
  query += " ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, createdAt DESC";
  
  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

// Get single task
router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  res.json(task);
});

// Create task manually
router.post('/', (req, res) => {
  const { projectId, recordingId, decisionId, title, priority } = req.body;
  
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }
  
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }
  
  // Check project exists
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Validate priority
  const validPriorities = ['low', 'medium', 'high'];
  const taskPriority = validPriorities.includes(priority) ? priority : 'medium';
  
  const result = db.prepare(`
    INSERT INTO tasks (projectId, recordingId, decisionId, title, priority)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    projectId,
    recordingId || null,
    decisionId || null,
    title.trim(),
    taskPriority
  );
  
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

// Update task (status, priority, title)
router.patch('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const { status, priority, title } = req.body;
  const updates = [];
  const params = [];
  
  if (status !== undefined) {
    const validStatuses = ['pending', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, in_progress, or done' });
    }
    updates.push('status = ?');
    params.push(status);
  }
  
  if (priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be: low, medium, or high' });
    }
    updates.push('priority = ?');
    params.push(priority);
  }
  
  if (title !== undefined) {
    if (!title.trim()) {
      return res.status(400).json({ error: 'Task title cannot be empty' });
    }
    updates.push('title = ?');
    params.push(title.trim());
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid updates provided' });
  }
  
  params.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updatedTask);
});

// Delete task
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  res.status(204).send();
});

// Bulk update tasks (e.g., mark multiple as done)
router.patch('/bulk/update', (req, res) => {
  const { ids, status, priority } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Task IDs array is required' });
  }
  
  const updates = [];
  const params = [];
  
  if (status) {
    const validStatuses = ['pending', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    updates.push('status = ?');
    params.push(status);
  }
  
  if (priority) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    updates.push('priority = ?');
    params.push(priority);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid updates provided' });
  }
  
  const placeholders = ids.map(() => '?').join(', ');
  const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id IN (${placeholders})`;
  
  db.prepare(query).run(...params, ...ids);
  
  const updatedTasks = db.prepare(`SELECT * FROM tasks WHERE id IN (${placeholders})`).all(...ids);
  res.json(updatedTasks);
});

export default router;

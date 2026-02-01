import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Predefined tag colors
const TAG_COLORS = {
  architecture: '#8b5cf6',
  security: '#ef4444',
  performance: '#f59e0b',
  database: '#10b981',
  api: '#3b82f6',
  frontend: '#ec4899',
  devops: '#6366f1',
  testing: '#14b8a6',
  documentation: '#8b5cf6',
  refactoring: '#f97316'
};

// Get all tags for a project
router.get('/project/:projectId', (req, res) => {
  const tags = db.prepare(`
    SELECT t.*, COUNT(dt.decisionId) as usageCount
    FROM tags t
    LEFT JOIN decision_tags dt ON t.id = dt.tagId
    WHERE t.projectId = ?
    GROUP BY t.id
    ORDER BY usageCount DESC, t.name ASC
  `).all(req.params.projectId);
  
  res.json(tags);
});

// Get single tag
router.get('/:id', (req, res) => {
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  
  if (!tag) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  
  res.json(tag);
});

// Create tag
router.post('/', (req, res) => {
  const { projectId, name, color } = req.body;
  
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tag name is required' });
  }
  
  const tagName = name.trim().toLowerCase();
  
  // Check if tag already exists
  const existing = db.prepare('SELECT * FROM tags WHERE projectId = ? AND name = ?')
    .get(projectId, tagName);
  
  if (existing) {
    return res.json(existing); // Return existing tag
  }
  
  // Use predefined color or provided color or default
  const tagColor = color || TAG_COLORS[tagName] || '#667eea';
  
  const result = db.prepare(`
    INSERT INTO tags (projectId, name, color) VALUES (?, ?, ?)
  `).run(projectId, tagName, tagColor);
  
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tag);
});

// Update tag
router.patch('/:id', (req, res) => {
  const { name, color } = req.body;
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  
  if (!tag) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  
  const updates = [];
  const params = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim().toLowerCase());
  }
  
  if (color !== undefined) {
    updates.push('color = ?');
    params.push(color);
  }
  
  if (updates.length === 0) {
    return res.json(tag);
  }
  
  params.push(req.params.id);
  db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete tag
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  
  res.status(204).send();
});

// Add tag to decision
router.post('/decision/:decisionId', (req, res) => {
  const { tagId, tagName, projectId } = req.body;
  const { decisionId } = req.params;
  
  // Check decision exists
  const decision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
  if (!decision) {
    return res.status(404).json({ error: 'Decision not found' });
  }
  
  let tag;
  
  if (tagId) {
    // Use existing tag
    tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
  } else if (tagName && projectId) {
    // Create or get tag by name
    const name = tagName.trim().toLowerCase();
    tag = db.prepare('SELECT * FROM tags WHERE projectId = ? AND name = ?')
      .get(projectId, name);
    
    if (!tag) {
      const color = TAG_COLORS[name] || '#667eea';
      const result = db.prepare('INSERT INTO tags (projectId, name, color) VALUES (?, ?, ?)')
        .run(projectId, name, color);
      tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    }
  } else {
    return res.status(400).json({ error: 'Either tagId or (tagName + projectId) is required' });
  }
  
  // Check if already linked
  const existing = db.prepare('SELECT * FROM decision_tags WHERE decisionId = ? AND tagId = ?')
    .get(decisionId, tag.id);
  
  if (existing) {
    return res.json(tag);
  }
  
  // Link tag to decision
  db.prepare('INSERT INTO decision_tags (decisionId, tagId) VALUES (?, ?)').run(decisionId, tag.id);
  
  res.status(201).json(tag);
});

// Remove tag from decision
router.delete('/decision/:decisionId/tag/:tagId', (req, res) => {
  const { decisionId, tagId } = req.params;
  
  const result = db.prepare('DELETE FROM decision_tags WHERE decisionId = ? AND tagId = ?')
    .run(decisionId, tagId);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Tag not linked to this decision' });
  }
  
  res.status(204).send();
});

// Get tags for a decision
router.get('/decision/:decisionId', (req, res) => {
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN decision_tags dt ON t.id = dt.tagId
    WHERE dt.decisionId = ?
    ORDER BY t.name ASC
  `).all(req.params.decisionId);
  
  res.json(tags);
});

// Get predefined colors
router.get('/colors/predefined', (req, res) => {
  res.json(TAG_COLORS);
});

export default router;

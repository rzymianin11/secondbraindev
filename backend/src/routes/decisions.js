import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List decisions by project (ordered by createdAt desc)
router.get('/project/:projectId', (req, res) => {
  const decisions = db.prepare(`
    SELECT * FROM decisions 
    WHERE projectId = ? 
    ORDER BY createdAt DESC
  `).all(req.params.projectId);
  res.json(decisions);
});

// Get single decision with its links
router.get('/:id', (req, res) => {
  const decision = db.prepare(`
    SELECT * FROM decisions WHERE id = ?
  `).get(req.params.id);
  
  if (!decision) {
    return res.status(404).json({ error: 'Decision not found' });
  }
  
  const links = db.prepare(`
    SELECT * FROM links WHERE decisionId = ?
  `).all(req.params.id);
  
  res.json({ ...decision, links });
});

// Create decision for a project
router.post('/', (req, res) => {
  const { projectId, title, description, reason, consequences, links } = req.body;
  
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Decision title is required' });
  }
  
  // Check project exists
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Use transaction to insert decision and links
  const insertDecision = db.prepare(`
    INSERT INTO decisions (projectId, title, description, reason, consequences)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertLink = db.prepare(`
    INSERT INTO links (decisionId, type, reference) VALUES (?, ?, ?)
  `);
  
  const transaction = db.transaction(() => {
    const result = insertDecision.run(
      projectId,
      title.trim(),
      description?.trim() || null,
      reason?.trim() || null,
      consequences?.trim() || null
    );
    
    const decisionId = result.lastInsertRowid;
    
    // Insert links if provided
    if (links && Array.isArray(links)) {
      for (const link of links) {
        if (link.type && link.reference) {
          insertLink.run(decisionId, link.type, link.reference);
        }
      }
    }
    
    return decisionId;
  });
  
  const decisionId = transaction();
  
  // Fetch the created decision with links
  const decision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(decisionId);
  const decisionLinks = db.prepare('SELECT * FROM links WHERE decisionId = ?').all(decisionId);
  
  res.status(201).json({ ...decision, links: decisionLinks });
});

// Add link to a decision
router.post('/:id/links', (req, res) => {
  const { type, reference } = req.body;
  
  if (!type || !reference) {
    return res.status(400).json({ error: 'Link type and reference are required' });
  }
  
  const validTypes = ['commit', 'pr', 'task', 'file', 'note'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid link type. Must be one of: ${validTypes.join(', ')}` });
  }
  
  // Check decision exists
  const decision = db.prepare('SELECT id FROM decisions WHERE id = ?').get(req.params.id);
  if (!decision) {
    return res.status(404).json({ error: 'Decision not found' });
  }
  
  const result = db.prepare(`
    INSERT INTO links (decisionId, type, reference) VALUES (?, ?, ?)
  `).run(req.params.id, type, reference);
  
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(link);
});

// Delete decision
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM decisions WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Decision not found' });
  }
  res.status(204).send();
});

// Delete link
router.delete('/links/:linkId', (req, res) => {
  const result = db.prepare('DELETE FROM links WHERE id = ?').run(req.params.linkId);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Link not found' });
  }
  res.status(204).send();
});

export default router;

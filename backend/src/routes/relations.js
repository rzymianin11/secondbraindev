import { Router } from 'express';
import db from '../db.js';

const router = Router();

const RELATION_TYPES = ['supersedes', 'relates', 'blocks', 'implements'];

// Get all relations for a project (for graph)
router.get('/project/:projectId', (req, res) => {
  const relations = db.prepare(`
    SELECT r.*, 
           d1.title as fromTitle, 
           d2.title as toTitle
    FROM decision_relations r
    JOIN decisions d1 ON r.fromDecisionId = d1.id
    JOIN decisions d2 ON r.toDecisionId = d2.id
    WHERE d1.projectId = ?
    ORDER BY r.createdAt DESC
  `).all(req.params.projectId);
  
  res.json(relations);
});

// Get relations for a specific decision
router.get('/decision/:decisionId', (req, res) => {
  const outgoing = db.prepare(`
    SELECT r.*, d.title as toTitle, d.id as toId
    FROM decision_relations r
    JOIN decisions d ON r.toDecisionId = d.id
    WHERE r.fromDecisionId = ?
  `).all(req.params.decisionId);
  
  const incoming = db.prepare(`
    SELECT r.*, d.title as fromTitle, d.id as fromId
    FROM decision_relations r
    JOIN decisions d ON r.fromDecisionId = d.id
    WHERE r.toDecisionId = ?
  `).all(req.params.decisionId);
  
  res.json({ outgoing, incoming });
});

// Create relation
router.post('/', (req, res) => {
  const { fromDecisionId, toDecisionId, relationType } = req.body;
  
  if (!fromDecisionId || !toDecisionId) {
    return res.status(400).json({ error: 'Both fromDecisionId and toDecisionId are required' });
  }
  
  if (fromDecisionId === toDecisionId) {
    return res.status(400).json({ error: 'Cannot create relation to self' });
  }
  
  if (!relationType || !RELATION_TYPES.includes(relationType)) {
    return res.status(400).json({ 
      error: `Invalid relation type. Must be one of: ${RELATION_TYPES.join(', ')}` 
    });
  }
  
  // Check both decisions exist
  const fromDecision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(fromDecisionId);
  const toDecision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(toDecisionId);
  
  if (!fromDecision) {
    return res.status(404).json({ error: 'Source decision not found' });
  }
  if (!toDecision) {
    return res.status(404).json({ error: 'Target decision not found' });
  }
  
  // Check if relation already exists
  const existing = db.prepare(`
    SELECT * FROM decision_relations 
    WHERE fromDecisionId = ? AND toDecisionId = ?
  `).get(fromDecisionId, toDecisionId);
  
  if (existing) {
    // Update relation type if different
    if (existing.relationType !== relationType) {
      db.prepare('UPDATE decision_relations SET relationType = ? WHERE id = ?')
        .run(relationType, existing.id);
      return res.json({ ...existing, relationType });
    }
    return res.json(existing);
  }
  
  const result = db.prepare(`
    INSERT INTO decision_relations (fromDecisionId, toDecisionId, relationType)
    VALUES (?, ?, ?)
  `).run(fromDecisionId, toDecisionId, relationType);
  
  const relation = db.prepare('SELECT * FROM decision_relations WHERE id = ?')
    .get(result.lastInsertRowid);
  
  res.status(201).json(relation);
});

// Delete relation
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM decision_relations WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Relation not found' });
  }
  
  res.status(204).send();
});

// Get graph data for a project (nodes + edges)
router.get('/graph/:projectId', (req, res) => {
  const { projectId } = req.params;
  
  // Get all decisions as nodes
  const decisions = db.prepare(`
    SELECT d.id, d.title, d.description, d.createdAt
    FROM decisions d
    WHERE d.projectId = ?
    ORDER BY d.createdAt ASC
  `).all(projectId);
  
  // Get tags for each decision
  const nodes = decisions.map(decision => {
    const tags = db.prepare(`
      SELECT t.id, t.name, t.color
      FROM tags t
      JOIN decision_tags dt ON t.id = dt.tagId
      WHERE dt.decisionId = ?
    `).all(decision.id);
    
    return { ...decision, tags };
  });
  
  // Get all relations as edges
  const edges = db.prepare(`
    SELECT r.id, r.fromDecisionId as source, r.toDecisionId as target, r.relationType
    FROM decision_relations r
    JOIN decisions d ON r.fromDecisionId = d.id
    WHERE d.projectId = ?
  `).all(projectId);
  
  res.json({ nodes, edges });
});

// Get relation types
router.get('/types', (req, res) => {
  res.json(RELATION_TYPES.map(type => ({
    value: type,
    label: {
      supersedes: 'Supersedes (replaces)',
      relates: 'Relates to',
      blocks: 'Blocks',
      implements: 'Implements'
    }[type]
  })));
});

export default router;

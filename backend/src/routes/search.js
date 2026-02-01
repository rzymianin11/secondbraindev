import { Router } from 'express';
import db from '../db.js';
import { 
  searchDecisions, 
  generateAnswer, 
  isEmbeddingsAvailable,
  embedDecision,
  embedProjectDecisions
} from '../services/embeddings.js';

const router = Router();

// Smart search with AI
router.post('/', async (req, res) => {
  const { projectId, query } = req.body;
  
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }
  
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  // Check if AI search is available
  if (!isEmbeddingsAvailable()) {
    // Fall back to simple text search
    const results = db.prepare(`
      SELECT id, title, description, reason, consequences, createdAt
      FROM decisions
      WHERE projectId = ? AND (
        title LIKE ? OR
        description LIKE ? OR
        reason LIKE ? OR
        consequences LIKE ?
      )
      ORDER BY createdAt DESC
      LIMIT 10
    `).all(
      projectId,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`
    );
    
    return res.json({
      results: results.map(r => ({ ...r, score: 1 })),
      answer: null,
      mode: 'text'
    });
  }
  
  try {
    // Semantic search
    const results = await searchDecisions(projectId, query, 5);
    
    // Generate AI answer if we have results
    let answer = null;
    if (results.length > 0) {
      answer = await generateAnswer(query, results);
    }
    
    // Add tags to results
    const resultsWithTags = results.map(r => {
      const tags = db.prepare(`
        SELECT t.id, t.name, t.color
        FROM tags t
        JOIN decision_tags dt ON t.id = dt.tagId
        WHERE dt.decisionId = ?
      `).all(r.id);
      return { ...r, tags };
    });
    
    res.json({
      results: resultsWithTags,
      answer,
      mode: 'semantic'
    });
    
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed: ' + err.message });
  }
});

// Simple text search (fallback)
router.get('/text', (req, res) => {
  const { projectId, q } = req.query;
  
  if (!projectId || !q) {
    return res.status(400).json({ error: 'projectId and q query params are required' });
  }
  
  const results = db.prepare(`
    SELECT id, title, description, reason, consequences, createdAt
    FROM decisions
    WHERE projectId = ? AND (
      title LIKE ? OR
      description LIKE ? OR
      reason LIKE ? OR
      consequences LIKE ?
    )
    ORDER BY createdAt DESC
    LIMIT 20
  `).all(
    projectId,
    `%${q}%`,
    `%${q}%`,
    `%${q}%`,
    `%${q}%`
  );
  
  res.json(results);
});

// Embed a single decision
router.post('/embed/:decisionId', async (req, res) => {
  if (!isEmbeddingsAvailable()) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }
  
  const decision = db.prepare('SELECT * FROM decisions WHERE id = ?').get(req.params.decisionId);
  
  if (!decision) {
    return res.status(404).json({ error: 'Decision not found' });
  }
  
  try {
    await embedDecision(decision);
    res.json({ success: true, message: 'Decision embedded successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to embed: ' + err.message });
  }
});

// Embed all decisions in a project
router.post('/embed-project/:projectId', async (req, res) => {
  if (!isEmbeddingsAvailable()) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }
  
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  try {
    const result = await embedProjectDecisions(req.params.projectId);
    res.json({ 
      success: true, 
      message: `Embedded ${result.embedded} of ${result.total} decisions`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to embed project: ' + err.message });
  }
});

// Check search status
router.get('/status', (req, res) => {
  res.json({
    aiSearchAvailable: isEmbeddingsAvailable(),
    textSearchAvailable: true
  });
});

export default router;

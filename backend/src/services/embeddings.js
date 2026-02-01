import OpenAI from 'openai';
import db from '../db.js';

let openai = null;

function getClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Generate embedding for text using OpenAI
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateEmbedding(text) {
  const client = getClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Similarity score (0-1)
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Store embedding for a decision
 * @param {number} decisionId - Decision ID
 * @param {number[]} embedding - Embedding vector
 */
export function storeEmbedding(decisionId, embedding) {
  const buffer = Buffer.from(new Float32Array(embedding).buffer);
  db.prepare('UPDATE decisions SET embedding = ? WHERE id = ?').run(buffer, decisionId);
}

/**
 * Get embedding from database
 * @param {number} decisionId - Decision ID
 * @returns {number[]|null} - Embedding vector or null
 */
export function getEmbedding(decisionId) {
  const row = db.prepare('SELECT embedding FROM decisions WHERE id = ?').get(decisionId);
  if (!row || !row.embedding) return null;
  
  return Array.from(new Float32Array(row.embedding.buffer));
}

/**
 * Generate and store embedding for a decision
 * @param {object} decision - Decision object with title, description, reason, consequences
 */
export async function embedDecision(decision) {
  const text = [
    decision.title,
    decision.description,
    decision.reason,
    decision.consequences
  ].filter(Boolean).join('\n\n');
  
  if (!text.trim()) return null;
  
  try {
    const embedding = await generateEmbedding(text);
    storeEmbedding(decision.id, embedding);
    return embedding;
  } catch (err) {
    console.error(`Failed to embed decision ${decision.id}:`, err.message);
    return null;
  }
}

/**
 * Search decisions by semantic similarity
 * @param {number} projectId - Project ID
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<Array>} - Matching decisions with scores
 */
export async function searchDecisions(projectId, query, limit = 5) {
  const client = getClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // Get all decisions with embeddings for this project
  const decisions = db.prepare(`
    SELECT id, title, description, reason, consequences, embedding, createdAt
    FROM decisions 
    WHERE projectId = ? AND embedding IS NOT NULL
  `).all(projectId);
  
  // Calculate similarity scores
  const results = decisions
    .map(decision => {
      const embedding = Array.from(new Float32Array(decision.embedding.buffer));
      const score = cosineSimilarity(queryEmbedding, embedding);
      return {
        id: decision.id,
        title: decision.title,
        description: decision.description,
        reason: decision.reason,
        consequences: decision.consequences,
        createdAt: decision.createdAt,
        score
      };
    })
    .filter(d => d.score > 0.3) // Minimum similarity threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return results;
}

/**
 * Generate an answer from search results using GPT
 * @param {string} query - User's question
 * @param {Array} decisions - Relevant decisions
 * @returns {Promise<string>} - Generated answer
 */
export async function generateAnswer(query, decisions) {
  const client = getClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }
  
  if (decisions.length === 0) {
    return null;
  }
  
  const context = decisions.map((d, i) => `
Decision ${i + 1}: ${d.title}
${d.description || ''}
${d.reason ? `Reason: ${d.reason}` : ''}
${d.consequences ? `Consequences: ${d.consequences}` : ''}
  `).join('\n---\n');
  
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant that answers questions about technical decisions made in a software project. 
Use the provided decision context to answer the user's question. 
Be concise but informative. If the context doesn't contain relevant information, say so.
Answer in the same language as the question.`
      },
      {
        role: 'user',
        content: `Context (relevant decisions):\n${context}\n\nQuestion: ${query}`
      }
    ],
    temperature: 0.5,
    max_tokens: 500
  });
  
  return response.choices[0]?.message?.content || null;
}

/**
 * Check if embeddings are available (OpenAI configured)
 */
export function isEmbeddingsAvailable() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Embed all decisions in a project that don't have embeddings yet
 * @param {number} projectId - Project ID
 */
export async function embedProjectDecisions(projectId) {
  const decisions = db.prepare(`
    SELECT id, title, description, reason, consequences
    FROM decisions 
    WHERE projectId = ? AND embedding IS NULL
  `).all(projectId);
  
  let embedded = 0;
  for (const decision of decisions) {
    const result = await embedDecision(decision);
    if (result) embedded++;
  }
  
  return { total: decisions.length, embedded };
}

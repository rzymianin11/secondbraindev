import { Router } from 'express';
import db from '../db.js';
import { isOpenAIConfigured } from '../services/openai.js';
import OpenAI from 'openai';

const router = Router();

let openai = null;

function getClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Ask the AI assistant
router.post('/ask', async (req, res) => {
  const { projectId, question } = req.body;
  
  if (!projectId || !question) {
    return res.status(400).json({ error: 'projectId and question are required' });
  }
  
  if (!isOpenAIConfigured()) {
    return res.status(503).json({ error: 'OpenAI API not configured' });
  }
  
  try {
    // Gather project context
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get tasks grouped by priority and status
    const tasks = db.prepare(`
      SELECT * FROM tasks WHERE projectId = ? ORDER BY 
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        createdAt DESC
    `).all(projectId);
    
    const pendingTasks = tasks.filter(t => t.status !== 'done');
    const doneTasks = tasks.filter(t => t.status === 'done');
    const highPriority = pendingTasks.filter(t => t.priority === 'high');
    const mediumPriority = pendingTasks.filter(t => t.priority === 'medium');
    const lowPriority = pendingTasks.filter(t => t.priority === 'low');
    
    // Get recent decisions for context
    const decisions = db.prepare(`
      SELECT title, description, reason FROM decisions 
      WHERE projectId = ? 
      ORDER BY createdAt DESC 
      LIMIT 5
    `).all(projectId);
    
    // Build context
    const context = `
Project: ${project.name}
${project.description ? `Description: ${project.description}` : ''}

TASKS OVERVIEW:
- Total pending: ${pendingTasks.length}
- Completed: ${doneTasks.length}
- High priority: ${highPriority.length}
- Medium priority: ${mediumPriority.length}
- Low priority: ${lowPriority.length}

HIGH PRIORITY TASKS (Do First):
${highPriority.length > 0 ? highPriority.map(t => `- ${t.title}`).join('\n') : '- None'}

MEDIUM PRIORITY TASKS (Do Next):
${mediumPriority.length > 0 ? mediumPriority.map(t => `- ${t.title}`).join('\n') : '- None'}

LOW PRIORITY TASKS (Do Later):
${lowPriority.length > 0 ? lowPriority.map(t => `- ${t.title}`).join('\n') : '- None'}

${decisions.length > 0 ? `
RECENT DECISIONS:
${decisions.map(d => `- ${d.title}${d.reason ? `: ${d.reason}` : ''}`).join('\n')}
` : ''}
`.trim();
    
    const client = getClient();
    
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_VISION_MODEL || 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant for developers. You help them manage their tasks and priorities.
Your role is to:
- Give practical advice on what to work on next
- Help prioritize tasks
- Identify potential blockers or dependencies
- Give encouragement and actionable suggestions

Keep responses concise but helpful. Use bullet points when listing things.
Respond in the same language as the user's question.`
        },
        {
          role: 'user',
          content: `Here's the current state of the project:\n\n${context}\n\nUser question: ${question}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    const answer = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    res.json({
      answer,
      context: {
        totalPending: pendingTasks.length,
        highPriority: highPriority.length,
        completed: doneTasks.length
      }
    });
    
  } catch (err) {
    console.error('Assistant error:', err);
    res.status(500).json({ error: 'Failed to get response: ' + err.message });
  }
});

// Ask AI about a specific task
router.post('/ask-task', async (req, res) => {
  const { projectId, task, question } = req.body;
  
  if (!task || !question) {
    return res.status(400).json({ error: 'task and question are required' });
  }
  
  if (!isOpenAIConfigured()) {
    return res.status(503).json({ error: 'OpenAI API not configured' });
  }
  
  try {
    const client = getClient();
    
    const taskContext = `
Task: ${task.title}
Status: ${task.status}
Priority: ${task.priority}
${task.notes ? `Notes: ${task.notes}` : ''}
`.trim();
    
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_VISION_MODEL || 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant for developers. You help them complete specific tasks.
Your role is to:
- Give practical, actionable advice
- Break down complex tasks into steps
- Identify potential issues
- Suggest best practices
- Provide code snippets or commands when relevant

Keep responses concise but helpful. Use bullet points when listing things.
Respond in the same language as the user's question.`
        },
        {
          role: 'user',
          content: `Here's the task I'm working on:\n\n${taskContext}\n\nMy question: ${question}`
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });
    
    const answer = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    res.json({ answer });
    
  } catch (err) {
    console.error('Task assistant error:', err);
    res.status(500).json({ error: 'Failed to get response: ' + err.message });
  }
});

export default router;

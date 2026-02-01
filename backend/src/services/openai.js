import OpenAI from 'openai';
import fs from 'fs';

// Lazy initialization - only create client when needed
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
 * Transcribe audio file using OpenAI Whisper
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Transcription text
 */
export async function transcribeAudio(audioPath) {
  const client = getClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const audioFile = fs.createReadStream(audioPath);
  
  const transcription = await client.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'text'
  });

  return transcription;
}

/**
 * Extract tasks from transcript using GPT
 * @param {string} transcript - Transcription text
 * @returns {Promise<Array<{title: string, priority: string}>>} - Array of tasks
 */
export async function extractTasksFromTranscript(transcript) {
  const client = getClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a task extraction assistant. Analyze the transcript of a conversation or meeting and extract concrete, actionable tasks.

Rules:
- Extract only clear, specific tasks that were mentioned or implied
- Each task should be a single, actionable item
- Assign priority based on urgency/importance mentioned in the conversation:
  - "high": urgent, critical, blocking, ASAP
  - "medium": important but not urgent (default)
  - "low": nice-to-have, someday, low priority
- If no clear tasks are found, return an empty array
- Keep task titles concise but descriptive (max 100 chars)

Return ONLY valid JSON array, no markdown, no explanation.
Format: [{"title": "Task description", "priority": "low|medium|high"}]`
      },
      {
        role: 'user',
        content: `Extract tasks from this transcript:\n\n${transcript}`
      }
    ],
    temperature: 0.3,
    max_tokens: 1000
  });

  const content = response.choices[0]?.message?.content?.trim();
  
  try {
    const tasks = JSON.parse(content);
    if (!Array.isArray(tasks)) {
      return [];
    }
    // Validate and sanitize tasks
    return tasks
      .filter(t => t.title && typeof t.title === 'string')
      .map(t => ({
        title: t.title.slice(0, 200),
        priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium'
      }));
  } catch (e) {
    console.error('Failed to parse GPT response:', content);
    return [];
  }
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

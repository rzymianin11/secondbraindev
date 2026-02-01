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
 * Analyze image with GPT-4 Vision (OCR + understanding)
 * @param {string} base64Image - Base64 encoded image
 * @param {string} mimeType - Image MIME type
 * @param {string} analysisType - Type of analysis: 'conversation', 'document', 'screenshot', 'whiteboard'
 * @returns {Promise<{extractedText: string, summary: string, tasks: string[]}>}
 */
export async function analyzeImage(base64Image, mimeType, analysisType = 'conversation') {
  const client = getClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const prompts = {
    conversation: `Analyze this image of a conversation (chat, messages, email, etc.).

Extract and return:
1. extractedText: The full text content visible in the image, preserving the conversation structure
2. summary: A brief summary of what the conversation is about and key points discussed
3. tasks: Any action items, TODOs, or tasks mentioned or implied in the conversation

Be thorough with text extraction - capture all visible text.`,

    document: `Analyze this document image.

Extract and return:
1. extractedText: All text content from the document
2. summary: What this document is about and its key points
3. tasks: Any action items or tasks mentioned`,

    screenshot: `Analyze this screenshot.

Extract and return:
1. extractedText: All visible text in the screenshot
2. summary: What this screenshot shows and its context
3. tasks: Any relevant action items visible`,

    whiteboard: `Analyze this whiteboard/diagram image.

Extract and return:
1. extractedText: All text, labels, and annotations visible
2. summary: What the whiteboard/diagram represents and its key concepts
3. tasks: Any action items or TODOs noted`
  };

  const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
  
  const response = await client.chat.completions.create({
    model: visionModel,
    messages: [
      {
        role: 'system',
        content: `You are an OCR and image analysis assistant. Analyze images and extract information.
Always respond with valid JSON in this exact format:
{
  "extractedText": "full extracted text here",
  "summary": "brief summary here",
  "tasks": ["task 1", "task 2"]
}

If no tasks are found, return an empty array for tasks.
If text extraction fails, describe what you see in extractedText.
Always respond in the same language as the content in the image.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompts[analysisType] || prompts.conversation
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          }
        ]
      }
    ],
    max_tokens: 4000,
    temperature: 0.2
  });

  const content = response.choices[0]?.message?.content?.trim();

  try {
    // Try to parse as JSON
    const result = JSON.parse(content);
    return {
      extractedText: result.extractedText || '',
      summary: result.summary || '',
      tasks: Array.isArray(result.tasks) ? result.tasks : []
    };
  } catch (e) {
    // If JSON parsing fails, return the raw content
    console.error('Failed to parse Vision response as JSON:', e.message);
    return {
      extractedText: content,
      summary: '',
      tasks: []
    };
  }
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

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
    model: 'gpt-4.1-mini',
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
    conversation: `Analyze this image of a conversation or task list.

IMPORTANT: Look at EACH line of text and check if it has a LINE DRAWN THROUGH IT (strikethrough).
- Lines WITH a strikethrough = already done/completed
- Lines WITHOUT any line through them = still pending/active

Extract and return:
1. extractedText: The full text content visible
2. summary: Brief summary of the content
3. tasks: Each item as a task with correct status:
   - status: "done" if text has a LINE THROUGH IT
   - status: "pending" if text is CLEAR (no line through it)
   - priority: "high"/"medium"/"low" based on urgency`,

    document: `Analyze this document image.

IMPORTANT: Check each line for STRIKETHROUGH (line drawn through the text).
- Strikethrough = done
- No strikethrough = pending

Extract:
1. extractedText: All text from the document
2. summary: What this document is about
3. tasks: Items with status "done" (if crossed out) or "pending" (if clear)`,

    screenshot: `Analyze this screenshot.

IMPORTANT: Check each task/item for STRIKETHROUGH.
- Line through text = status: "done"  
- Clear text = status: "pending"

Extract:
1. extractedText: All visible text
2. summary: What this shows
3. tasks: With correct done/pending status based on strikethrough`,

    whiteboard: `Analyze this whiteboard/diagram.

IMPORTANT: Check for STRIKETHROUGH on each item.
- Crossed out = done
- Not crossed out = pending

Extract:
1. extractedText: All text and labels
2. summary: What it represents
3. tasks: With done/pending status based on visual strikethrough`
  };

  const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
  
  const response = await client.chat.completions.create({
    model: visionModel,
    messages: [
      {
        role: 'system',
        content: `You are an OCR and image analysis assistant specialized in detecting task completion status from images.

Always respond with valid JSON in this exact format:
{
  "extractedText": "full extracted text here",
  "summary": "brief summary here",
  "tasks": [
    {"title": "task description", "status": "pending", "priority": "medium"},
    {"title": "completed task", "status": "done", "priority": "high"}
  ]
}

CRITICAL - STRIKETHROUGH DETECTION:
Examine EACH line of text carefully. A strikethrough/crossed-out line has:
- A horizontal line drawn THROUGH THE MIDDLE of the text
- The line goes across the words, making them look "cancelled"
- This is different from underline (which is BELOW the text)

For EACH task/item you extract:
- If there is a LINE THROUGH THE TEXT → status: "done"
- If the text is CLEAR with NO line through it → status: "pending"

Most items in a todo list are typically crossed out (done). 
Only items WITHOUT any line through them are still pending.

PRIORITY assignment:
- "high": urgent, critical, blocking, ASAP, bugs, security, deadlines
- "medium": normal work items, standard features (default)
- "low": nice-to-have, improvements, documentation, cleanup

If no tasks are found, return an empty array for tasks.
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
 * Analyze text content (for txt, vtt, docx files)
 * @param {string} textContent - The text content to analyze
 * @param {string} analysisType - Type of analysis: 'conversation', 'document', 'screenshot', 'whiteboard'
 * @returns {Promise<{extractedText: string, summary: string, tasks: Array}>}
 */
export async function analyzeText(textContent, analysisType = 'conversation') {
  const client = getClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const prompts = {
    conversation: `Analyze this text from a conversation or meeting transcript.
Extract any actionable tasks, decisions, or important items mentioned.`,

    document: `Analyze this document text.
Extract the main content, summarize it, and identify any tasks or action items.`,

    screenshot: `Analyze this text content.
Extract and organize the information, identifying any tasks or actionable items.`,

    whiteboard: `Analyze this text (possibly from a whiteboard or notes).
Extract ideas, tasks, and action items.`
  };

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You are a text analysis assistant that extracts tasks and summarizes content.

Always respond with valid JSON in this exact format:
{
  "extractedText": "the original text (can be shortened if very long)",
  "summary": "brief summary of what the text is about",
  "tasks": [
    {"title": "task description", "status": "pending", "priority": "medium"},
    {"title": "another task", "status": "done", "priority": "high"}
  ]
}

For STATUS:
- "done": if the task is explicitly marked as complete, finished, or done
- "pending": if the task is still to be done (default)

For PRIORITY:
- "high": urgent, critical, blocking, ASAP, bugs, security, deadlines
- "medium": normal work items, standard features (default)
- "low": nice-to-have, improvements, documentation, cleanup

If no clear tasks are found, return an empty array for tasks.
Always respond in the same language as the content.`
      },
      {
        role: 'user',
        content: `${prompts[analysisType] || prompts.conversation}\n\nText to analyze:\n\n${textContent}`
      }
    ],
    max_tokens: 4000,
    temperature: 0.2
  });

  const content = response.choices[0]?.message?.content?.trim();

  try {
    const result = JSON.parse(content);
    return {
      extractedText: result.extractedText || textContent.slice(0, 2000),
      summary: result.summary || '',
      tasks: Array.isArray(result.tasks) ? result.tasks : []
    };
  } catch (e) {
    console.error('Failed to parse text analysis response as JSON:', e.message);
    return {
      extractedText: textContent.slice(0, 2000),
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

import { GoogleGenAI } from '@google/genai';
import { LlmProvider, normalizeProviderError } from './llm-provider.js';

export class GeminiLlmProvider extends LlmProvider {
  constructor({ apiKey }) {
    super({ providerId: 'google' });

    if (!apiKey) {
      const error = new Error('GEMINI_API_KEY is required for Gemini tasks.');
      error.status = 503;
      error.code = 'GEMINI_NOT_CONFIGURED';
      throw error;
    }

    if (/xxxx|your_|placeholder/i.test(apiKey) || !apiKey.startsWith('AI')) {
      const error = new Error(
        'GEMINI_API_KEY in backend/.env is invalid. Add a real Google AI API key and restart the backend.',
      );
      error.status = 503;
      error.code = 'GEMINI_AUTH_INVALID';
      throw error;
    }

    this.client = new GoogleGenAI({ apiKey });
  }

  async generateText({ model, systemInstruction, messages = [], userMessage, maxOutputTokens, tools = [] }) {
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: buildContents(messages, userMessage),
        config: {
          systemInstruction,
          maxOutputTokens,
          tools,
        },
      });

      const text = extractResponseText(response);

      return { text, response };
    } catch (error) {
      throw normalizeProviderError(error, {
        provider: 'gemini',
        defaultCode: 'GEMINI_REQUEST_FAILED',
      });
    }
  }

  async *streamText({ model, systemInstruction, messages = [], userMessage, maxOutputTokens, tools = [] }) {
    try {
      const response = await this.client.models.generateContentStream({
        model,
        contents: buildContents(messages, userMessage),
        config: {
          systemInstruction,
          maxOutputTokens,
          tools,
        },
      });

      let fullText = '';
      let finalChunk = null;

      for await (const chunk of response) {
        finalChunk = chunk;
        const text = typeof chunk?.text === 'function' ? chunk.text() : chunk?.text ?? '';
        if (text) {
          fullText += text;
          yield { type: 'text', text };
        }
      }

      yield {
        type: 'done',
        text: fullText,
        response: finalChunk,
      };
    } catch (error) {
      throw normalizeProviderError(error, {
        provider: 'gemini',
        defaultCode: 'GEMINI_REQUEST_FAILED',
      });
    }
  }
}

function buildContents(messages, userMessage) {
  const history = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  return [...history, { role: 'user', parts: [{ text: userMessage }] }];
}

function extractResponseText(response) {
  if (typeof response?.text === 'function') {
    const text = response.text();
    if (String(text ?? '').trim()) {
      return text.trim();
    }
  }

  if (typeof response?.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }

  const text = (response?.candidates ?? [])
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => part?.text ?? '')
    .join('\n')
    .trim();

  return text;
}

let defaultProvider = null;

export function getGeminiLlmProvider() {
  if (!defaultProvider) {
    defaultProvider = new GeminiLlmProvider({
      apiKey: process.env.GEMINI_API_KEY?.trim(),
    });
  }

  return defaultProvider;
}

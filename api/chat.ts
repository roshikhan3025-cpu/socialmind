// ============================================================
// SocialMind — Multi-Provider AI Chat Proxy
// Supports: 4everland, Groq, Google Gemini with parallel handling
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';

type AIProvider = '4everland' | 'groq' | 'gemini';

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  provider?: AIProvider;
  apiKey?: string;
}

// Provider API endpoints and headers
const PROVIDER_CONFIGS: Record<AIProvider, { baseUrl: string; headerKey: string }> = {
  '4everland': {
    baseUrl: 'https://ai.api.4everland.org/api/v1',
    headerKey: 'Authorization',
  },
  'groq': {
    baseUrl: 'https://api.groq.com/openai/v1',
    headerKey: 'Authorization',
  },
  'gemini': {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    headerKey: 'x-goog-api-key',
  },
};

function getAuthHeader(provider: AIProvider, apiKey: string): Record<string, string> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  if (provider === 'gemini') {
    // Gemini uses query parameter, not header
    return {};
  }
  
  return {
    [config.headerKey]: `Bearer ${apiKey}`,
  };
}

async function callProvider(
  provider: AIProvider,
  { messages, model, temperature, top_p, max_tokens, stream }: ChatRequest,
  apiKey: string,
) {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(provider, apiKey),
  };

  let body: Record<string, unknown>;
  let endpoint: string;

  if (provider === 'gemini') {
    // Google Gemini API format
    endpoint = `${config.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    body = {
      contents: messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        temperature,
        topP: top_p,
        maxOutputTokens: max_tokens,
      },
    };
  } else {
    // 4everland and Groq use OpenAI-compatible format
    endpoint = `${config.baseUrl}/chat/completions`;
    body = {
      model,
      messages,
      stream: stream ?? true,
      temperature: temperature ?? 1,
      top_p: top_p ?? 1,
      max_tokens: max_tokens ?? 4096,
    };
  }

  return fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model, temperature, top_p, max_tokens, stream, provider, apiKey }: ChatRequest = req.body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    if (!provider || !['4everland', 'groq', 'gemini'].includes(provider)) {
      return res.status(400).json({ error: 'Valid provider required (4everland, groq, gemini)' });
    }
    if (!apiKey) {
      return res.status(400).json({ error: `${provider} API key is required` });
    }

    // Call the selected provider
    const response = await callProvider(
      provider,
      { messages, model, temperature, top_p, max_tokens, stream },
      apiKey,
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[${provider}] API error:`, errorBody);
      return res.status(response.status).json({ error: `${provider} API error: ${errorBody}` });
    }

    if (stream !== false) {
      // Stream SSE response through
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body?.getReader();
      if (!reader) {
        return res.status(500).json({ error: 'No response body' });
      }

      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (error) {
        console.error('Stream error:', error);
      } finally {
        res.end();
      }
    } else {
      // Non-streaming response
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (error) {
    console.error('Chat proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

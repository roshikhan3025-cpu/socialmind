// ============================================================
// SocialMind — AI Chat Proxy (hides 4everland API key)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne } from '../lib/db.js';
import { verifyToken } from './auth.js';

function getUserId(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7))?.userId || null;
}

const PROVIDER_BASES: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  azure: '', // Dynamic
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Fetch AI settings from agent config
  const agentRow = await queryOne<{ config: any }>('SELECT config FROM agents WHERE user_id = $1', [userId]);
  const agentConfig = agentRow?.config ? (typeof agentRow.config === 'string' ? JSON.parse(agentRow.config) : agentRow.config) : null;
  const aiSettings = agentConfig?.aiSettings;

  let apiBase = PROVIDER_BASES[aiSettings?.provider || 'openrouter'] || aiSettings?.baseUrl || 'https://openrouter.ai/api/v1';
  let apiKey = aiSettings?.apiKey || process.env.FOUREVERLAND_API_KEY || process.env.OPENROUTER_API_KEY;

  if (aiSettings?.provider === 'azure') {
    apiBase = aiSettings.baseUrl || ''; // User must provide full endpoint
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'AI API key not configured. Please set it in Settings.' });
  }

  try {
    const { messages, model, temperature, top_p, max_tokens, stream } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = JSON.stringify({
      model: model || 'anthropic/claude-sonnet-4',
      messages,
      stream: stream ?? true,
      temperature: temperature ?? 1,
      top_p: top_p ?? 1,
      max_tokens: max_tokens ?? 4096,
    });

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: errorBody });
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
      } catch {
        // Client disconnected
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

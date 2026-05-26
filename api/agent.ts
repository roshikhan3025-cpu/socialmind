import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne, queryAll, ensureSchema } from '../lib/db.js';
import { generateContent, selectContentType } from '../lib/content-generator.js';
import { postToPlatform } from '../lib/social-poster.js';
import type { AgentConfig } from '../src/types/agent.js';
import crypto from 'crypto';

const ALL_PLATFORMS = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'bluesky', 'discord', 'threads'];

function getUserId(_req: VercelRequest): string | null {
  return 'guest-user';
}

async function handleConfig(req: VercelRequest, res: VercelResponse, userId: string) {
  switch (req.method) {
    case 'GET': {
      const row = await queryOne<{ config: unknown; status: string }>('SELECT config, status FROM agents WHERE user_id = $1', [userId]);
      if (!row) return res.status(200).json({ agent: null });
      const agent = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      agent.status = row.status;
      return res.status(200).json({ agent });
    }
    case 'POST': {
      const config = req.body;
      const now = Date.now();
      const agentId = config.id || crypto.randomUUID();
      const status = config.status || 'setup';
      await query(
        `INSERT INTO agents (id, user_id, config, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (user_id) DO UPDATE SET config = $3, status = $4, updated_at = $5`,
        [agentId, userId, JSON.stringify(config), status, now]
      );
      return res.status(200).json({ agent: { ...config, id: agentId, userId, status } });
    }
    case 'PATCH': {
      const existing = await queryOne<{ id: string; config: unknown; status: string }>('SELECT id, config, status FROM agents WHERE user_id = $1', [userId]);
      if (!existing) return res.status(404).json({ error: 'No agent configuration found' });
      const currentConfig = typeof existing.config === 'string' ? JSON.parse(existing.config) : existing.config;
      const updates = req.body;
      const merged = { ...currentConfig, ...updates };
      const now = Date.now();
      await query('UPDATE agents SET config = $1, status = $2, updated_at = $3 WHERE user_id = $4',
        [JSON.stringify(merged), updates.status || existing.status, now, userId]);
      return res.status(200).json({ agent: { ...merged, status: updates.status || existing.status } });
    }
    case 'DELETE': {
      await query('DELETE FROM agents WHERE user_id = $1', [userId]);
      return res.status(200).json({ success: true });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handlePosts(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const posts = await queryAll(
    `SELECT id, platform, content, post_type, post_url, external_post_id, engagement, status, error, created_at
     FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [userId, limit, offset]);
  const countRow = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM posts WHERE user_id = $1', [userId]);
  const total = parseInt(countRow?.count || '0');
  return res.status(200).json({
    posts: posts.map((p: Record<string, unknown>) => ({
      id: p.id, platform: p.platform, content: p.content, postType: p.post_type,
      postUrl: p.post_url, externalPostId: p.external_post_id, engagement: p.engagement,
      status: p.status, error: p.error, createdAt: Number(p.created_at),
    })),
    total, hasMore: offset + limit < total,
  });
}

async function handlePostNow(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { platform, content: customContent } = req.body as { platform?: string; content?: string };

  const agentRow = await queryOne<{ config: unknown; status: string; id: string }>(
    'SELECT id, config, status FROM agents WHERE user_id = $1', [userId]);
  if (!agentRow) return res.status(404).json({ error: 'No agent configured.' });

  const agent: AgentConfig = typeof agentRow.config === 'string'
    ? JSON.parse(agentRow.config) : agentRow.config as AgentConfig;
  agent.status = agentRow.status as AgentConfig['status'];
  agent.id = agentRow.id;

  const connections = await queryAll<{ platform: string; connected: boolean; handle: string; display_name: string }>(
    'SELECT platform, connected, handle, display_name FROM platform_connections WHERE user_id = $1 AND connected = true', [userId]);
  for (const conn of connections) {
    const p = conn.platform as keyof typeof agent.platforms;
    if (agent.platforms?.[p]) {
      agent.platforms[p].connected = true;
      agent.platforms[p].handle = conn.handle;
      agent.platforms[p].displayName = conn.display_name;
    }
  }

  const targetPlatforms: string[] = platform
    ? [platform]
    : ALL_PLATFORMS.filter(p => agent.platforms?.[p as keyof typeof agent.platforms]?.connected);

  if (targetPlatforms.length === 0) return res.status(400).json({ error: 'No connected platforms found.' });

  const results: Array<{ platform: string; success: boolean; content: string; postUrl?: string; error?: string }> = [];
  for (const p of targetPlatforms) {
    if (!agent.platforms?.[p as keyof typeof agent.platforms]?.connected) {
      results.push({ platform: p, success: false, content: '', error: `${p} not connected` });
      continue;
    }
    try {
      let postContent: string;
      if (customContent) { postContent = customContent; }
      else {
        const contentType = selectContentType(agent.schedule?.[p as keyof typeof agent.platforms]?.contentMix || { original: 100, reply: 0, quote: 0, thread: 0 });
        postContent = (await generateContent(agent, p as any, contentType)).text;
      }
      const postResult = await postToPlatform(postContent, p, userId);
      await query(
        `INSERT INTO posts (id, user_id, agent_id, platform, content, post_type, post_url, external_post_id, status, error, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [crypto.randomUUID(), userId, agent.id || null, p, postContent, 'original',
         postResult.postUrl || null, postResult.postId || null,
         postResult.success ? 'posted' : 'failed', postResult.error || null, Date.now()]);
      results.push({ platform: p, success: postResult.success, content: postContent, postUrl: postResult.postUrl, error: postResult.error });
    } catch (error) { results.push({ platform: p, success: false, content: '', error: String(error) }); }
  }
  return res.status(200).json({ results });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureSchema();
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const action = req.query.action as string || 'config';
  try {
    switch (action) {
      case 'config': return handleConfig(req, res, userId);
      case 'posts': return handlePosts(req, res, userId);
      case 'post-now': return handlePostNow(req, res, userId);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('Agent API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryAll, queryOne, ensureSchema } from '../lib/db.js';
import type { AgentConfig } from '../src/types/agent.js';
import { generateContent, selectContentType } from '../lib/content-generator.js';
import { postToPlatform } from '../lib/social-poster.js';
import { verifyToken } from './auth.js';
import crypto from 'crypto';

const ALL_PLATFORMS = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'bluesky', 'discord', 'threads'];

async function buildAgentConfig(agentRow: { user_id: string; config: unknown; status: string; id: string }): Promise<AgentConfig & { userId: string }> {
  const agent: AgentConfig = typeof agentRow.config === 'string' ? JSON.parse(agentRow.config) : agentRow.config as AgentConfig;
  agent.status = agentRow.status as AgentConfig['status'];
  agent.id = agentRow.id;
  agent.userId = agentRow.user_id;

  const dbConnections = await queryAll<{
    platform: string; connected: boolean; handle: string; display_name: string;
  }>('SELECT platform, connected, handle, display_name FROM platform_connections WHERE user_id = $1 AND connected = true', [agentRow.user_id]);

  for (const conn of dbConnections) {
    const p = conn.platform as keyof typeof agent.platforms;
    if (agent.platforms && agent.platforms[p]) {
      agent.platforms[p].connected = true;
      agent.platforms[p].handle = conn.handle;
      agent.platforms[p].displayName = conn.display_name;
    }
  }

  return agent as AgentConfig & { userId: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureSchema();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  let isCron = false;
  let requestUserId: string | null = null;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) { isCron = true; }
  else if (authHeader?.startsWith('Bearer ')) { const d = verifyToken(authHeader.slice(7)); if (d) requestUserId = d.userId; }
  if (!isCron && !requestUserId && !cronSecret) isCron = true;

  if (!isCron && !requestUserId) return res.status(401).json({ error: 'Unauthorized' });

  const force = req.query.force === 'true' || req.body?.force === true;
  const minIntervalMs = Math.max(60000, parseInt(req.query.minInterval as string || '1800000') || 1800000);

  try {
    let agentRows: Array<{ user_id: string; config: unknown; status: string; id: string }>;
    if (requestUserId) {
      const row = await queryOne<{ user_id: string; config: unknown; status: string; id: string }>('SELECT id, user_id, config, status FROM agents WHERE user_id = $1', [requestUserId]);
      agentRows = row ? [row] : [];
    } else {
      agentRows = await queryAll("SELECT id, user_id, config, status FROM agents WHERE status = 'active'");
    }

    if (agentRows.length === 0) {
      return res.status(200).json({ message: 'No active agents found', processed: 0, results: [] });
    }

    const results: Array<{ userId: string; platform: string; success: boolean; error?: string; postUrl?: string; content?: string }> = [];

    for (const agentRow of agentRows) {
      const agent = await buildAgentConfig(agentRow);

      if (agent.status !== 'active' && !force) {
        results.push({ userId: agentRow.user_id, platform: 'all', success: false, error: `Agent status is "${agent.status}", not active` });
        continue;
      }

      for (const platform of ALL_PLATFORMS) {
        const platConfig = agent.platforms?.[platform as keyof typeof agent.platforms];
        if (!platConfig?.connected) continue;

        if (!force) {
          const sched = agent.schedule?.[platform as keyof typeof agent.platforms];
          if (!sched?.enabled) continue;
        }

        const lastPost = await queryOne<{ created_at: string }>(
          'SELECT created_at FROM posts WHERE user_id = $1 AND platform = $2 ORDER BY created_at DESC LIMIT 1',
          [agentRow.user_id, platform]
        );
        if (lastPost && Date.now() - Number(lastPost.created_at) < minIntervalMs) {
          results.push({
            userId: agentRow.user_id, platform, success: false,
            error: `Skipped: posted ${Math.round((Date.now() - Number(lastPost.created_at)) / 60000)}m ago (min: ${Math.round(minIntervalMs / 60000)}m)`,
          });
          continue;
        }

        try {
          const contentType = selectContentType(
            agent.schedule?.[platform as keyof typeof agent.platforms]?.contentMix || { original: 100, reply: 0, quote: 0, thread: 0 }
          );
          const content = await generateContent(agent, platform as any, contentType);

          let imageUrl: string | undefined;
          if (platform === 'instagram' && agent.imageLibrary && agent.imageLibrary.length > 0) {
            const randomImg = agent.imageLibrary[Math.floor(Math.random() * agent.imageLibrary.length)];
            imageUrl = randomImg.url;
          }

          const postResult = await postToPlatform(content.text, platform, agentRow.user_id, imageUrl);

          await query(
            `INSERT INTO posts (id, user_id, agent_id, platform, content, post_type, post_url, external_post_id, status, error, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [crypto.randomUUID(), agentRow.user_id, agent.id || null, platform, content.text, contentType,
             postResult.postUrl || null, postResult.postId || null, postResult.success ? 'posted' : 'failed', postResult.error || null, Date.now()]
          );

          results.push({
            userId: agentRow.user_id, platform,
            success: postResult.success,
            error: postResult.error,
            postUrl: postResult.postUrl,
            content: content.text,
          });
        } catch (error) {
          results.push({ userId: agentRow.user_id, platform, success: false, error: String(error) });
        }
      }
    }

    return res.status(200).json({
      message: 'Posting engine completed',
      processed: agentRows.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}

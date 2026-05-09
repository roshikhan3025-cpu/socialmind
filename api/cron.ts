// ============================================================
// SocialMind — Autonomous Posting Engine
// Called by GitHub Actions cron, dashboard auto-post hook, or manually.
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryAll, queryOne } from '../lib/db.js';
import type { AgentConfig, Platform } from '../src/types/agent.js';
import { generateContent, selectContentType } from '../lib/content-generator.js';
import { postToPlatform } from '../lib/social-poster.js';
import { verifyToken } from './auth.js';
import crypto from 'crypto';

/**
 * Build a complete AgentConfig with platform connections.
 * Merges connections from BOTH:
 *  1. The platform_connections DB table
 *  2. The agent config JSON itself (wizard may store connectedAccountId directly)
 */
async function buildAgentConfig(agentRow: { user_id: string; config: unknown; status: string; id: string }): Promise<AgentConfig> {
  const agent: AgentConfig = typeof agentRow.config === 'string' ? JSON.parse(agentRow.config) : agentRow.config as AgentConfig;
  agent.status = agentRow.status as AgentConfig['status'];
  agent.id = agentRow.id;
  agent.userId = agentRow.user_id;
  if (!agent.platforms) agent.platforms = { twitter: { connected: false }, facebook: { connected: false }, instagram: { connected: false } };

  // Source 1: platform_connections table (any row, not just connected=true,
  // because the callback might have failed to set connected=true)
  const dbConnections = await queryAll<{
    platform: string; connected: boolean; connected_account_id: string; handle: string; display_name: string;
  }>('SELECT platform, connected, connected_account_id, handle, display_name FROM platform_connections WHERE user_id = $1', [agentRow.user_id]);

  for (const conn of dbConnections) {
    const p = conn.platform as Platform;
    if (!agent.platforms[p]) agent.platforms[p] = { connected: false };
    // If DB says connected, use it
    if (conn.connected && conn.connected_account_id) {
      agent.platforms[p].connected = true;
      agent.platforms[p].connectedAccountId = conn.connected_account_id;
      agent.platforms[p].handle = conn.handle;
      agent.platforms[p].displayName = conn.display_name;
    }
  }

  // Source 2: Agent config JSON fallback
  const rawConfig = typeof agentRow.config === 'string' ? JSON.parse(agentRow.config) : agentRow.config;
  const rawPlatform = (rawConfig as Record<string, unknown>)?.platforms as Record<string, Record<string, unknown>> | undefined;
  for (const p of ['twitter', 'facebook', 'instagram'] as Platform[]) {
    if (agent.platforms[p]?.connected && agent.platforms[p]?.connectedAccountId) continue;
    if (rawPlatform?.[p]?.connected && rawPlatform[p].connectedAccountId) {
      agent.platforms[p].connected = true;
      agent.platforms[p].connectedAccountId = rawPlatform[p].connectedAccountId as string;
      agent.platforms[p].handle = (rawPlatform[p].handle as string) || undefined;
    }
  }

  // Source 3: Verify account IDs against Composio — auto-fix stale/expired connections
  const composioKey = process.env.COMPOSIO_API_KEY;
  if (composioKey) {
    for (const p of ['twitter', 'facebook', 'instagram'] as Platform[]) {
      if (!agent.platforms[p]?.connected || !agent.platforms[p]?.connectedAccountId) continue;
      try {
        const checkRes = await fetch(`https://backend.composio.dev/api/v1/connectedAccounts/${agent.platforms[p].connectedAccountId}`, {
          headers: { 'x-api-key': composioKey },
        });
        const checkData = checkRes.ok ? await checkRes.json() : null;
        if (!checkData || checkData.status !== 'ACTIVE') {
          // Stale account — find any ACTIVE connection for this platform
          const searchRes = await fetch(
            `https://backend.composio.dev/api/v1/connectedAccounts?appNames=${p}&status=ACTIVE&limit=1`,
            { headers: { 'x-api-key': composioKey } },
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const items = searchData.items || searchData || [];
            if (items.length > 0) {
              agent.platforms[p].connectedAccountId = items[0].id;
            } else {
              agent.platforms[p].connected = false;
            }
          }
        }
      } catch { /* keep existing */ }
    }
  }

  return agent;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: CRON_SECRET for GitHub Actions, or user JWT for dashboard auto-post
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  let isCron = false;
  let requestUserId: string | null = null;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) { isCron = true; }
  else if (authHeader?.startsWith('Bearer ')) { const d = verifyToken(authHeader.slice(7)); if (d) requestUserId = d.userId; }
  if (!isCron && !requestUserId && !cronSecret) isCron = true; // dev mode

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

      for (const platform of ['twitter', 'facebook', 'instagram'] as Platform[]) {
        const platConfig = agent.platforms?.[platform];
        if (!platConfig?.connected || !platConfig?.connectedAccountId) continue;

        // Schedule check
        if (!force) {
          const sched = agent.schedule?.[platform];
          if (!sched?.enabled) continue;
        }

        // Anti-duplicate: check last post time
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
            agent.schedule?.[platform]?.contentMix || { original: 100, reply: 0, quote: 0, thread: 0 }
          );
          const content = await generateContent(agent, platform, contentType);
          
          let imageUrl: string | undefined;
          if (platform === 'instagram' && agent.imageLibrary && agent.imageLibrary.length > 0) {
            const randomImg = agent.imageLibrary[Math.floor(Math.random() * agent.imageLibrary.length)];
            imageUrl = randomImg.url;
          }

          const postResult = await postToPlatform(content.text, platform, agent, imageUrl);

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

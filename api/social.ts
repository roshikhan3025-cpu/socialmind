import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne, queryAll } from '../lib/db.js';
import crypto from 'crypto';

const ZERNIO_API_BASE = 'https://zernio.com/api/v1';
const ALL_PLATFORMS = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'bluesky', 'discord', 'threads'];

function getUserId(_req: VercelRequest): string | null {
  return 'guest-user';
}

function getApiKey(): string {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error('ZERNIO_API_KEY not configured');
  return key;
}

async function zernioFetch(path: string, options: RequestInit = {}): Promise<any> {
  const apiKey = getApiKey();
  const url = path.startsWith('http') ? path : `${ZERNIO_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zernio API error (${res.status}): ${body}`);
  }
  return res.json();
}

async function getOrCreateZernioProfile(userId: string): Promise<string> {
  const row = await queryOne<{ config: unknown }>(
    'SELECT config FROM agents WHERE user_id = $1', [userId]
  );
  if (row) {
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
    if (config.zernioProfileId) return config.zernioProfileId;
  }

  const data = await zernioFetch('/profiles', {
    method: 'POST',
    body: JSON.stringify({
      name: `SocialMind Agent (${userId})`,
      description: 'Auto-managed by SocialMind',
    }),
  });

  const profileId = data.profile?._id || data._id;
  if (!profileId) throw new Error('Failed to create Zernio profile');

  if (row) {
    await query(
      `UPDATE agents SET config = jsonb_set(COALESCE(config::jsonb, '{}'::jsonb), '{zernioProfileId}', to_jsonb($1::text)) WHERE user_id = $2`,
      [profileId, userId]
    );
  }

  return profileId;
}

async function listZernioAccounts(): Promise<Array<{ _id: string; platform: string; name: string; handle: string }>> {
  const data = await zernioFetch('/accounts');
  return data.accounts || [];
}

async function handleConnect(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { platform } = req.body;
  if (!platform || !ALL_PLATFORMS.includes(platform)) return res.status(400).json({ error: 'Invalid platform' });
  if (!process.env.ZERNIO_API_KEY) return res.status(500).json({ error: 'ZERNIO_API_KEY not configured' });

  try {
    const profileId = await getOrCreateZernioProfile(userId);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';

    const data = await zernioFetch(`/connect/${platform}?profileId=${profileId}&redirect_url=${encodeURIComponent(`${appUrl}/api/social?action=callback&platform=${platform}`)}`);

    const authUrl = data.authUrl || data.url;
    if (!authUrl) return res.status(500).json({ error: 'Zernio did not return an authorization URL' });

    const zernioState = data.state || crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO oauth_states (state, user_id, platform, created_at) VALUES ($1, $2, $3, $4)`,
      [zernioState, userId, platform, Date.now()]
    );

    return res.status(200).json({ authUrl, platform });
  } catch (error) {
    console.error('Zernio connect error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to connect platform' });
  }
}

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { platform, state, error: oauthError } = req.query;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';

  if (oauthError) return res.redirect(`${appUrl}/?error=${oauthError}`);
  if (!platform || !state) return res.redirect(`${appUrl}/?error=missing_params`);

  const platformStr = String(platform);
  const stateStr = String(state);

  try {
    const stateRow = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM oauth_states WHERE state = $1 AND platform = $2',
      [stateStr, platformStr]
    );
    if (!stateRow) return res.redirect(`${appUrl}/?error=invalid_state`);

    await query('DELETE FROM oauth_states WHERE state = $1', [stateStr]);

    const accounts = await listZernioAccounts();
    const connected = accounts.find((a: any) => a.platform === platformStr);

    const id = crypto.randomUUID();
    const now = Date.now();

    await query(
      `INSERT INTO platform_connections (id, user_id, platform, connected, zernio_account_id, handle, display_name, connected_at, created_at)
       VALUES ($1, $2, $3, true, $4, $5, $6, $7, $7)
       ON CONFLICT (user_id, platform) DO UPDATE SET
         connected = true, zernio_account_id = $4, handle = $5, display_name = $6, connected_at = $7`,
      [id, stateRow.user_id, platformStr,
       connected?._id || null, connected?.handle || null, connected?.name || null, now]
    );

    return res.redirect(`${appUrl}/?connected=${platformStr}`);
  } catch (error) {
    console.error('Zernio callback error:', error);
    return res.redirect(`${appUrl}/?error=connection_failed&platform=${platformStr}`);
  }
}

async function handleDisconnect(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { platform } = req.body;
  if (!platform || !ALL_PLATFORMS.includes(platform)) return res.status(400).json({ error: 'Invalid platform' });

  await query(
    'UPDATE platform_connections SET connected = false, zernio_account_id = NULL, handle = NULL, display_name = NULL, avatar_url = NULL, connected_at = NULL WHERE user_id = $1 AND platform = $2',
    [userId, platform]
  );

  return res.status(200).json({ success: true, platform });
}

async function handleStatus(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const rows = await queryAll<{
    platform: string; connected: boolean; handle: string; display_name: string; avatar_url: string; connected_at: number;
  }>('SELECT platform, connected, handle, display_name, avatar_url, connected_at FROM platform_connections WHERE user_id = $1', [userId]);

  const result: Record<string, unknown> = {};
  for (const p of ALL_PLATFORMS) {
    const row = rows.find(r => r.platform === p);
    result[p] = row
      ? {
          connected: row.connected,
          handle: row.handle,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          connectedAt: row.connected_at ? Number(row.connected_at) : undefined,
        }
      : { connected: false };
  }
  return res.status(200).json(result);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string || 'status';

  if (action === 'callback') return handleCallback(req, res);

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    switch (action) {
      case 'connect': return handleConnect(req, res, userId);
      case 'disconnect': return handleDisconnect(req, res, userId);
      case 'status': return handleStatus(req, res, userId);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('Social API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}

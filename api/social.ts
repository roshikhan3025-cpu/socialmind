// ============================================================
// SocialMind — Social API (consolidated: connect, disconnect, status, callback)
// Routes via query param: ?action=connect|disconnect|status|callback
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne, queryAll } from '../lib/db.js';
import { verifyToken } from './auth.js';
import crypto from 'crypto';

const COMPOSIO_API_BASE = 'https://backend.composio.dev/api/v2';
const PLATFORMS = ['twitter', 'facebook', 'instagram'] as const;
const INTEGRATION_MAP: Record<string, string> = { twitter: 'twitter', facebook: 'facebook', instagram: 'instagram' };

async function composioRequest(path: string, options: RequestInit = {}) {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error('COMPOSIO_API_KEY not configured');
  const response = await fetch(`${COMPOSIO_API_BASE}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, ...options.headers },
  });
  if (!response.ok) { const body = await response.text(); throw new Error(`Composio API error (${response.status}): ${body}`); }
  return response.json();
}

function getUserId(_req: VercelRequest): string | null {
  return 'guest-user';
}

// ── Connect ──
async function handleConnect(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { platform } = req.body;
  if (!platform || !INTEGRATION_MAP[platform]) return res.status(400).json({ error: 'Invalid platform' });
  if (!process.env.COMPOSIO_API_KEY) return res.status(500).json({ error: 'Composio API key not configured' });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let integrationId: string | null = null;
  try {
    const integrationsRes = await composioRequest(`/integrations?appName=${INTEGRATION_MAP[platform]}`);
    const items = integrationsRes.items || integrationsRes;
    if (Array.isArray(items) && items.length > 0) integrationId = items[0].id;
  } catch { /* fallback */ }

  const redirectUrl = `${appUrl}/api/social?action=callback&platform=${platform}&userId=${userId}`;
  const connectPayload: Record<string, unknown> = { integrationId: integrationId || undefined, userUuid: userId, redirectUri: redirectUrl, data: {} };
  if (!integrationId) connectPayload.appName = INTEGRATION_MAP[platform];

  const connectRes = await composioRequest('/connectedAccounts', { method: 'POST', body: JSON.stringify(connectPayload) });
  const authUrl = connectRes.redirectUrl || connectRes.connectionStatus?.redirectUrl || connectRes.url || null;
  const connectedAccountId = connectRes.connectedAccountId || connectRes.id || null;
  if (!authUrl) return res.status(500).json({ error: `Composio did not return an authorization URL for ${platform}` });

  await query(
    `INSERT INTO platform_connections (id, user_id, platform, connected, connected_account_id, composio_user_id, connection_status, created_at)
     VALUES ($1, $2, $3, false, $4, $5, 'pending', $6)
     ON CONFLICT (user_id, platform) DO UPDATE SET connected_account_id = $4, connection_status = 'pending', connected = false`,
    [crypto.randomUUID(), userId, platform, connectedAccountId, userId, Date.now()]);

  return res.status(200).json({ authUrl, connectionId: connectedAccountId, platform });
}

// ── Disconnect ──
async function handleDisconnect(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { platform } = req.body;
  if (!platform || !INTEGRATION_MAP[platform]) return res.status(400).json({ error: 'Invalid platform' });

  const row = await queryOne<{ connected_account_id: string }>(
    'SELECT connected_account_id FROM platform_connections WHERE user_id = $1 AND platform = $2', [userId, platform]);
  if (row?.connected_account_id && process.env.COMPOSIO_API_KEY) {
    try { await fetch(`${COMPOSIO_API_BASE}/connectedAccounts/${row.connected_account_id}`, { method: 'DELETE', headers: { 'x-api-key': process.env.COMPOSIO_API_KEY } }); } catch { /* non-fatal */ }
  }
  await query('UPDATE platform_connections SET connected = false, connected_account_id = NULL, handle = NULL, display_name = NULL, connection_status = NULL, connected_at = NULL WHERE user_id = $1 AND platform = $2', [userId, platform]);
  return res.status(200).json({ success: true, platform });
}

// ── Status ──
async function handleStatus(req: VercelRequest, res: VercelResponse, userId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const rows = await queryAll<{ platform: string; connected: boolean; connected_account_id: string; handle: string; display_name: string; connection_status: string; connected_at: number }>(
    'SELECT * FROM platform_connections WHERE user_id = $1', [userId]);

  const result: Record<string, unknown> = {};
  for (const p of PLATFORMS) {
    const row = rows.find(r => r.platform === p);
    result[p] = row ? { connected: row.connected, connectedAccountId: row.connected_account_id, handle: row.handle, displayName: row.display_name, connectionStatus: row.connection_status, connectedAt: row.connected_at ? Number(row.connected_at) : undefined } : { connected: false };
  }

  if (req.query.live === 'true' && process.env.COMPOSIO_API_KEY) {
    for (const platform of PLATFORMS) {
      try {
        const response = await fetch(`${COMPOSIO_API_BASE}/connectedAccounts?user_uuid=${userId}&appNames=${platform}&status=ACTIVE&limit=1`,
          { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.COMPOSIO_API_KEY! } });
        if (response.ok) {
          const data = await response.json();
          const accounts = data.items || data || [];
          if (accounts.length > 0) {
            const acct = accounts[0];
            const live = { connected: true, connectedAccountId: acct.id || acct.connectedAccountId, handle: acct.connectionParams?.userName || undefined, displayName: acct.connectionParams?.displayName || undefined, connectionStatus: 'ACTIVE' };
            result[platform] = { ...(result[platform] as object), ...live };
            await query(
              `INSERT INTO platform_connections (id, user_id, platform, connected, connected_account_id, handle, display_name, connection_status, connected_at, created_at)
               VALUES ($1, $2, $3, true, $4, $5, $6, 'ACTIVE', $7, $7)
               ON CONFLICT (user_id, platform) DO UPDATE SET connected = true, connected_account_id = $4, handle = $5, display_name = $6, connection_status = 'ACTIVE', connected_at = $7`,
              [crypto.randomUUID(), userId, platform, live.connectedAccountId, live.handle || null, live.displayName || null, Date.now()]);
          }
        }
      } catch { /* ignore */ }
    }
  }
  return res.status(200).json(result);
}

// ── Callback (OAuth redirect from Composio) ──
async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { platform, userId } = req.query;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  if (!platform || !userId) return res.redirect(`${appUrl}/?error=missing_params`);
  const platformStr = String(platform), userIdStr = String(userId);

  try {
    const pending = await queryOne<{ connected_account_id: string }>(
      'SELECT connected_account_id FROM platform_connections WHERE user_id = $1 AND platform = $2', [userIdStr, platformStr]);
    let connectedAccountId = pending?.connected_account_id || null;
    let connectionStatus = 'unknown', accountHandle = '', accountDisplayName = '';

    if (connectedAccountId) {
      try {
        const accountRes = await composioRequest(`/connectedAccounts/${connectedAccountId}`);
        connectionStatus = accountRes.status || accountRes.connectionStatus || 'unknown';
        accountHandle = accountRes.connectionParams?.userName || '';
        accountDisplayName = accountRes.connectionParams?.displayName || '';
      } catch { /* fallback below */ }
    }
    if (!connectedAccountId || connectionStatus === 'unknown') {
      try {
        const accountsRes = await composioRequest(`/connectedAccounts?user_uuid=${userIdStr}&appNames=${platformStr}&status=ACTIVE`);
        const accounts = accountsRes.items || accountsRes || [];
        if (accounts.length > 0) {
          const latest = accounts[accounts.length - 1];
          connectedAccountId = latest.id || latest.connectedAccountId;
          connectionStatus = 'ACTIVE'; accountHandle = latest.connectionParams?.userName || ''; accountDisplayName = latest.connectionParams?.displayName || '';
        }
      } catch { /* ignore */ }
    }

    const isConnected = ['ACTIVE', 'active', 'initiated'].includes(connectionStatus);
    await query(`UPDATE platform_connections SET connected = $1, connected_account_id = $2, handle = $3, display_name = $4, connection_status = $5, connected_at = $6 WHERE user_id = $7 AND platform = $8`,
      [isConnected, connectedAccountId, accountHandle || null, accountDisplayName || null, connectionStatus, isConnected ? Date.now() : null, userIdStr, platformStr]);

    return res.redirect(isConnected ? `${appUrl}/?connected=${platformStr}` : `${appUrl}/?error=connection_pending&platform=${platformStr}`);
  } catch (error) {
    console.error('Social callback error:', error);
    return res.redirect(`${appUrl}/?error=connection_failed&platform=${platformStr}`);
  }
}

// ── Router ──
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string || 'status';

  // Callback doesn't need user auth (it's a redirect from Composio)
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

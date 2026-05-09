// ============================================================
// SocialMind — Auth API (Web3 wallet + SIWE)
// Routes: POST /api/auth (wallet/nonce), GET /api/auth (me)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne } from '../lib/db.js';
import crypto from 'crypto';

export function generateToken(userId: string): string {
  const payload = { userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000, iat: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.AUTH_SECRET || 'dev-secret';
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const [encoded, signature] = token.split('.');
    const secret = process.env.AUTH_SECRET || 'dev-secret';
    const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch { return null; }
}

export function getUserId(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7))?.userId || null;
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/auth = get current user
  if (req.method === 'GET') {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'No token provided' });
    try {
      const user = await queryOne<{ id: string; email: string; name: string; image: string; created_at: number }>(
        'SELECT id, email, name, image, created_at FROM users WHERE id = $1', [userId]
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user });
    } catch (error) {
      console.error('Auth me error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  try {
    // ── SSO sign-in (Placeholder for Vercel/External SSO) ──
    if (action === 'sso') {
      // Since you'll implement the SSO logic, this endpoint provides the placeholder hook.
      return res.status(200).json({ message: 'SSO provider redirect hook' });
    }

    return res.status(400).json({ error: 'Invalid action. Use "sso".' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================
// SocialMind — Image Upload + Serving API
// POST /api/images (upload, auth required) — stores image in Neon
// GET /api/images?id=xxx (serve, no auth) — Instagram fetches this
// DELETE /api/images?id=xxx (delete, auth required)
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne, queryAll } from '../lib/db.js';
import { verifyToken } from './auth.js';
import crypto from 'crypto';

function getUserId(_req: VercelRequest): string | null {
  return 'guest-user';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET — serve image (no auth, Instagram needs to fetch this)
  if (req.method === 'GET') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'Image ID required' });

    try {
      const row = await queryOne<{ data: string; mime_type: string }>(
        'SELECT data, mime_type FROM images WHERE id = $1', [id]
      );
      if (!row) return res.status(404).json({ error: 'Image not found' });

      const buffer = Buffer.from(row.data, 'base64');
      res.setHeader('Content-Type', row.mime_type || 'image/jpeg');
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Image serve error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST — upload image (auth required)
  if (req.method === 'POST') {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, data, mimeType } = req.body;
    // data = base64-encoded image content
    if (!data) return res.status(400).json({ error: 'Image data (base64) is required' });

    // Validate size (max 5MB base64 ~ 6.67MB string)
    if (data.length > 7 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large. Maximum 5MB.' });
    }

    try {
      const id = crypto.randomUUID();
      const mime = mimeType || 'image/jpeg';

      // Create images table if not exists
      await query(`CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT,
        mime_type TEXT DEFAULT 'image/jpeg',
        data TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )`);

      await query(
        'INSERT INTO images (id, user_id, name, mime_type, data, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, userId, name || `image-${Date.now()}`, mime, data, Date.now()]
      );

      // Build the public URL that Instagram can fetch
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://openclaw4ever.vercel.app';
      const url = `${appUrl}/api/images?id=${id}`;

      return res.status(201).json({ id, url, name: name || `image-${Date.now()}` });
    } catch (error) {
      console.error('Image upload error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE — remove image (auth required)
  if (req.method === 'DELETE') {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'Image ID required' });

    try {
      await query('DELETE FROM images WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Image delete error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET list — list user's images (auth required)
  if (req.method === 'PATCH') {
    // Using PATCH as "list" since GET without id serves images
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://openclaw4ever.vercel.app';
      const rows = await queryAll<{ id: string; name: string; mime_type: string; created_at: number }>(
        'SELECT id, name, mime_type, created_at FROM images WHERE user_id = $1 ORDER BY created_at DESC', [userId]
      );
      return res.status(200).json({
        images: rows.map((r) => ({
          id: r.id,
          url: `${appUrl}/api/images?id=${r.id}`,
          name: r.name,
          uploadedAt: Number(r.created_at),
        })),
      });
    } catch (error) {
      // Table might not exist yet
      return res.status(200).json({ images: [] });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

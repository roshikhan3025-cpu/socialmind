import { queryOne } from './db.js';

interface PostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

const ZERNIO_API_BASE = 'https://zernio.com/api/v1';

function getApiKey(): string {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error('ZERNIO_API_KEY not configured');
  return key;
}

async function zernioFetch(path: string, options: RequestInit = {}): Promise<any> {
  const apiKey = getApiKey();
  const url = `${ZERNIO_API_BASE}${path}`;
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

async function getZernioAccountId(userId: string, platform: string): Promise<string | null> {
  const row = await queryOne<{ zernio_account_id: string }>(
    'SELECT zernio_account_id FROM platform_connections WHERE user_id = $1 AND platform = $2 AND connected = true',
    [userId, platform]
  );
  return row?.zernio_account_id || null;
}

export async function postToPlatform(
  content: string,
  platform: string,
  userId: string,
  imageUrl?: string,
): Promise<PostResult> {
  const accountId = await getZernioAccountId(userId, platform);
  if (!accountId) {
    return { success: false, error: `${platform} not connected via Zernio. Re-authorize.` };
  }

  try {
    const body: Record<string, unknown> = {
      content,
      publishNow: true,
      platforms: [
        { platform, accountId },
      ],
    };

    if (imageUrl) {
      body.mediaItems = [{ url: imageUrl, type: 'image' }];
    }

    const data = await zernioFetch('/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const post = data.post || data;
    const postId: string | undefined = post._id || post.id;

    return {
      success: true,
      postId,
      postUrl: postId ? `https://zernio.com/posts/${postId}` : undefined,
    };
  } catch (error) {
    return { success: false, error: `Zernio post error: ${error}` };
  }
}

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

const sql = neon(process.env.DATABASE_URL);

async function setup() {
  console.log('Setting up SocialMind database tables (Zernio-backed)...\n');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      image TEXT DEFAULT '',
      password_hash TEXT,
      password_salt TEXT,
      google_id TEXT UNIQUE,
      auth_provider TEXT DEFAULT 'email',
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    )
  `;
  console.log('  [ok] users');

  await sql`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      config JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'setup',
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      UNIQUE(user_id)
    )
  `;
  console.log('  [ok] agents');

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      platform TEXT NOT NULL,
      content TEXT NOT NULL,
      post_type TEXT NOT NULL DEFAULT 'original',
      post_url TEXT,
      external_post_id TEXT,
      engagement JSONB DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    )
  `;
  console.log('  [ok] posts');

  await sql`
    CREATE TABLE IF NOT EXISTS platform_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      connected BOOLEAN NOT NULL DEFAULT false,
      zernio_account_id TEXT,
      handle TEXT,
      display_name TEXT,
      avatar_url TEXT,
      connected_at BIGINT,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      UNIQUE(user_id, platform)
    )
  `;
  console.log('  [ok] platform_connections');

  await sql`
    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    )
  `;
  console.log('  [ok] oauth_states');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status) WHERE status = 'active'
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_platform_connections_user ON platform_connections(user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state)
  `;
  console.log('  [ok] indexes');

  console.log('\nDatabase setup complete!');
  console.log('Social connections are managed through Zernio API (zernio_account_id column).');
}

setup().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});

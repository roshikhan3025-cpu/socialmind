// ============================================================
// SocialMind — Neon Postgres Database Connection
// Uses @neondatabase/serverless for HTTP-based queries.
// ============================================================
import { neon } from '@neondatabase/serverless';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sql: any = null;
let schemaEnsured = false;

function getSql() {
  if (_sql) return _sql;
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!databaseUrl) {
    throw new Error('Database connection string not found. Please ensure DATABASE_URL or POSTGRES_URL is set.');
  }
  _sql = neon(databaseUrl);
  return _sql;
}

export async function ensureSchema() {
  if (schemaEnsured) return;
  await query(`CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'setup',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    UNIQUE(user_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    platform TEXT NOT NULL,
    content TEXT NOT NULL,
    post_type TEXT NOT NULL DEFAULT 'original',
    post_url TEXT,
    external_post_id TEXT,
    engagement JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  )`);
  await query(`CREATE TABLE IF NOT EXISTS platform_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    connected BOOLEAN NOT NULL DEFAULT false,
    zernio_account_id TEXT,
    handle TEXT,
    display_name TEXT,
    avatar_url TEXT,
    connected_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    UNIQUE(user_id, platform)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  )`);
  schemaEnsured = true;
}

/**
 * Execute a parameterized SQL query.
 * Uses neon's sql.query() method for conventional parameterized queries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(queryText: string, params: any[] = []): Promise<Record<string, unknown>[]> {
  const sql = getSql();
  // neon v1.x: use sql.query() for parameterized string queries
  if (typeof sql.query === 'function') {
    return sql.query(queryText, params);
  }
  // fallback for older versions
  return sql(queryText, params);
}

/** Run a query and return the first row or null */
export async function queryOne<T = Record<string, unknown>>(
  queryText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[] = [],
): Promise<T | null> {
  const rows = await query(queryText, params);
  return (rows[0] as T) || null;
}

/** Run a query and return all rows */
export async function queryAll<T = Record<string, unknown>>(
  queryText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[] = [],
): Promise<T[]> {
  const rows = await query(queryText, params);
  return rows as T[];
}

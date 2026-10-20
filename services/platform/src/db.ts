import pg from 'pg';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const supabaseRootCa = readFileSync(
  fileURLToPath(new URL('../../../packages/certs/supabase-prod-ca-2021.crt', import.meta.url)),
  'utf8',
);

function connectionOptions(connectionString: string): {
  connectionString: string;
  ssl?: { ca: string; rejectUnauthorized: true };
} {
  const url = new URL(connectionString);
  const isSupabaseHost =
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.pooler.supabase.com');

  if (!isSupabaseHost) return { connectionString };

  // pg 8.23 treats sslmode=require as certificate-verifying mode by default.
  // Supabase uses its own root CA, so pass the verified CA explicitly and
  // remove URL SSL parameters that would override the node-postgres ssl object.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslfactory', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }

  return {
    connectionString: url.toString(),
    ssl: { ca: supabaseRootCa, rejectUnauthorized: true },
  };
}

export function createPool(
  connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL,
): Pool {
  if (!connectionString) throw new Error('DATABASE_URL or POSTGRES_URL is required.');
  const serverless = Boolean(process.env.VERCEL || process.env.VERCEL_URL);
  return new pg.Pool({
    ...connectionOptions(connectionString),
    max: serverless ? 1 : 12,
    connectionTimeoutMillis: serverless ? 10000 : 5000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: serverless,
  });
}

export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type Connection = Pick<PoolClient, 'query'>;
export async function rows<T extends QueryResultRow = QueryResultRow>(
  db: Connection,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await db.query<T>(sql, values)).rows;
}
export async function one<T extends QueryResultRow = QueryResultRow>(
  db: Connection,
  sql: string,
  values: unknown[] = [],
): Promise<T | undefined> {
  return (await rows<T>(db, sql, values))[0];
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, code, message);
};
export function integer(value: unknown, label: string, min = 0, max = 1_000_000_000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    return fail(
      422,
      'VALIDATION_ERROR',
      `${label} must be a whole number between ${min} and ${max}.`,
    );
  return value;
}
export function string(value: unknown, label: string, min = 1, max = 1000): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max)
    return fail(422, 'VALIDATION_ERROR', `${label} is invalid.`);
  return value.trim();
}

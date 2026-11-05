import { timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import type { ProviderSource } from './providerRegistry.ts';
import { runRecovery } from './worker.ts';

const LOCK_NAMESPACE = 7;
const LOCK_ID = 20_261_105;

export function isAuthorizedCronRequest(
  authorization: string | undefined,
  secret: string | undefined,
  production: boolean,
): boolean {
  if (!secret) return !production;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization ?? '');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Keep one database session pinned for a cross-instance lock while the bounded worker uses the pool. */
export async function runScheduledRecovery(
  pool: Pool,
  provider: ProviderSource,
  execute: (pool: Pool, provider: ProviderSource) => Promise<void> = runRecovery,
): Promise<{ status: 'completed' | 'already_running' }> {
  const client = await pool.connect();
  let locked = false;
  let discardClient = false;
  let failure: unknown;
  let result: { status: 'completed' | 'already_running' } = { status: 'already_running' };

  try {
    const lock = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      [LOCK_NAMESPACE, LOCK_ID],
    );
    locked = lock.rows[0]?.acquired === true;
    if (locked) {
      await execute(pool, provider);
      result = { status: 'completed' };
    }
  } catch (error) {
    failure = error;
    discardClient = true;
  }

  if (locked) {
    try {
      const unlock = await client.query<{ unlocked: boolean }>(
        'SELECT pg_advisory_unlock($1, $2) AS unlocked',
        [LOCK_NAMESPACE, LOCK_ID],
      );
      if (unlock.rows[0]?.unlocked !== true) {
        discardClient = true;
        if (failure === undefined)
          failure = new Error('Scheduled worker lock could not be released.');
      }
    } catch {
      discardClient = true;
      if (failure === undefined)
        failure = new Error('Scheduled worker lock could not be released.');
    }
  }

  client.release(discardClient);
  if (failure !== undefined) throw failure;
  return result;
}

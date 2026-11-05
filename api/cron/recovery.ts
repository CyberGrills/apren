import type { IncomingMessage } from 'node:http';
import type { Pool } from 'pg';
import { createPool } from '../../backend/platform/src/db.ts';
import { ProviderRegistry } from '../../backend/platform/src/providerRegistry.ts';
import {
  isAuthorizedCronRequest,
  runScheduledRecovery,
} from '../../backend/platform/src/scheduledWorker.ts';

type CronRequest = Pick<IncomingMessage, 'method' | 'headers'>;
type CronResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): CronResponse;
  json(body: unknown): unknown;
};

export default async function handler(req: CronRequest, res: CronResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  const production =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const configuredSecret = process.env.CRON_SECRET;
  if (!isAuthorizedCronRequest(req.headers.authorization, configuredSecret, production)) {
    return res.status(configuredSecret ? 401 : 503).json({
      error: { code: configuredSecret ? 'UNAUTHORIZED' : 'CRON_SECRET_NOT_CONFIGURED' },
    });
  }

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return res.status(503).json({ error: { code: 'DATABASE_NOT_CONFIGURED' } });
  }

  let pool: Pool | undefined;
  try {
    // One connection is pinned for the advisory lock; the worker needs a second connection.
    pool = createPool(undefined, { max: 2 });
    const result = await runScheduledRecovery(pool, new ProviderRegistry());
    return res.status(result.status === 'already_running' ? 202 : 200).json({
      data: {
        ...result,
        completedAt: result.status === 'completed' ? new Date().toISOString() : null,
      },
    });
  } catch {
    console.error(
      '7even scheduled recovery failed:',
      'See the error category in the function logs; details are intentionally withheld.',
    );
    return res.status(500).json({ error: { code: 'SCHEDULED_RECOVERY_FAILED' } });
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }
}

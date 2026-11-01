import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { one, rows, transaction, fail, string } from './db.ts';
import type * as C from '@7even/contracts';

export function mountDemoMarketplace(app: Express, pool: Pool, actor: (res: Response) => C.SessionUser): void {
  const route = (method: 'get' | 'post', path: string, handler: (req: any, res: Response) => Promise<unknown>) =>
    app[method](path, async (req, res) => res.json({ data: await handler(req, res) }));
  route('get', '/api/demo/catalog', async (req) => rows(pool,
    'SELECT item_id AS id,kind,title,city,state,unit_price_minor AS "unitPriceMinor",unit_label AS "unitLabel",item_type AS "itemType" FROM seven.demo_catalog_items WHERE is_active AND ($1::text IS NULL OR kind=$1) ORDER BY kind,city,title',
    [req.query.kind ? z.enum(['STAY','DINING','EXPERIENCE']).parse(req.query.kind) : null]));
  route('get', '/api/demo/wallet', async (_req, res) => {
    const user = actor(res);
    return transaction(pool, async (db) => {
      const created = await one(db, 'INSERT INTO seven.demo_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING RETURNING user_id', [user.id]);
      if (created) await db.query("INSERT INTO seven.demo_wallet_entries(entry_id,user_id,entry_type,amount_minor,balance_after_minor,reference,idempotency_key,description) VALUES(gen_random_uuid(),$1,'INITIAL_CREDIT',50000000000,50000000000,'DEMO-INITIAL-'||$1::text,'initial-demo-credit','Initial test credits — no cash value')", [user.id]);
      const account = await one(db, 'SELECT balance_minor FROM seven.demo_wallets WHERE user_id=$1', [user.id]);
      const entries = await rows(db, 'SELECT entry_id AS id,entry_type AS type,amount_minor AS "amountMinor",balance_after_minor AS "balanceAfterMinor",reference,description,created_at AS "createdAt" FROM seven.demo_wallet_entries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [user.id]);
      return { balanceMinor: String(account?.balance_minor ?? '0'), currency: 'NGN', fundedAmountMinor: '50000000000', cashValue: false, withdrawable: false, transferable: false, entries };
    });
  });
  route('get', '/api/demo/bookings', async (_req, res) => {
    const user = actor(res);
    return rows(pool, 'SELECT booking_id AS id,reference,item_id AS "itemId",kind,item_title AS title,city,start_date AS "startDate",end_date AS "endDate",quantity,total_minor AS "totalMinor",status,created_at AS "createdAt" FROM seven.demo_bookings WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [user.id]);
  });
}

import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { one, rows, transaction, fail, string } from './db.ts';
import type * as C from '@7even/contracts';


const bookingView = (row: Record<string, unknown>) => ({
  id: String(row.booking_id), reference: String(row.reference), itemId: String(row.item_id),
  kind: String(row.kind), title: String(row.item_title), city: String(row.city),
  startDate: String(row.start_date).slice(0, 10),
  endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
  quantity: Number(row.quantity), totalMinor: String(row.total_minor),
  status: String(row.status), createdAt: new Date(String(row.created_at)).toISOString(),
});

export function mountDemoMarketplace(app: Express, pool: Pool, actor: (res: Response) => C.SessionUser, environment: string): void {
  if (environment === 'production') return;
  const route = (method: 'get' | 'post', path: string, handler: (req: any, res: Response) => Promise<unknown>) =>
    app[method](path, async (req, res) => res.json({ data: await handler(req, res) }));
  route('get', '/api/demo/catalog', async (req) => rows(pool,
    'SELECT item_id AS id,kind,title,city,state,unit_price_minor AS "unitPriceMinor",unit_label AS "unitLabel",item_type AS "itemType" FROM seven.demo_catalog_items WHERE is_active AND ($1::text IS NULL OR kind=$1) ORDER BY kind,city,title',
    [req.query.kind ? z.enum(['STAY','DINING','EXPERIENCE']).parse(req.query.kind) : null]));
  route('get', '/api/demo/wallet', async (_req, res) => {
    const user = actor(res);
    return transaction(pool, async (db) => {
      const created = await one(db, 'INSERT INTO seven.demo_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING RETURNING user_id', [user.id]);
      if (created) await db.query("INSERT INTO seven.demo_wallet_entries(entry_id,user_id,entry_type,amount_minor,balance_after_minor,reference,idempotency_key,description) VALUES(gen_random_uuid(),$1,'INITIAL_CREDIT',50000000000,50000000000,'DEMO-INITIAL-'||($1::uuid)::text,'initial-demo-credit','Initial test credits — no cash value')", [user.id]);
      const account = await one(db, 'SELECT balance_minor FROM seven.demo_wallets WHERE user_id=$1', [user.id]);
      const entries = await rows(db, 'SELECT entry_id AS id,entry_type AS type,amount_minor AS "amountMinor",balance_after_minor AS "balanceAfterMinor",reference,description,created_at AS "createdAt" FROM seven.demo_wallet_entries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [user.id]);
      return { balanceMinor: String(account?.balance_minor ?? '0'), currency: 'NGN', fundedAmountMinor: '50000000000', cashValue: false, withdrawable: false, transferable: false, entries };
    });
  });
  route('get', '/api/demo/bookings', async (_req, res) => {
    const user = actor(res);
    return rows(pool, 'SELECT booking_id AS id,reference,item_id AS "itemId",kind,item_title AS title,city,start_date AS "startDate",end_date AS "endDate",quantity,total_minor AS "totalMinor",status,created_at AS "createdAt" FROM seven.demo_bookings WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [user.id]);
  });
  route('post', '/api/demo/bookings', async (req, res) => {
    const user = actor(res);
    const input = z.strictObject({
      itemId: z.string().regex(/^demo-(?:\d{3}|dining-\d{3}|experience-\d{3})$/),
      startDate: z.iso.date(),
      endDate: z.iso.date().optional(),
      quantity: z.int().min(1).max(20),
    }).parse(req.body);
    const key = string(req.get('Idempotency-Key'), 'Idempotency key', 8, 200);
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return transaction(pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id + ':demo:' + key]);
      const previous = await one(db, 'SELECT * FROM seven.demo_bookings WHERE user_id=$1 AND idempotency_key=$2', [user.id, key]);
      if (previous) {
        if (previous.payload_hash !== hash) return fail(409, 'IDEMPOTENCY_CONFLICT', 'This key was used for a different demo booking.');
        return bookingView(previous);
      }
      const item = await one(db, 'SELECT * FROM seven.demo_catalog_items WHERE item_id=$1 AND is_active', [input.itemId]);
      if (!item) return fail(404, 'DEMO_ITEM_NOT_FOUND', 'Demo option not found.');
      const start = new Date(input.startDate + 'T00:00:00Z');
      const end = input.endDate ? new Date(input.endDate + 'T00:00:00Z') : null;
      let nights = 1;
      if (item.kind === 'STAY') {
        if (!end || end <= start) return fail(422, 'INVALID_DATES', 'Choose a checkout date after check-in.');
        nights = Math.round((end.getTime() - start.getTime()) / 86400000);
        if (nights > 30) return fail(422, 'INVALID_DATES', 'Demo stays are limited to 30 nights.');
      } else if (end) return fail(422, 'INVALID_DATES', 'Dining and experiences use one service date.');
      const total = BigInt(item.unit_price_minor) * BigInt(input.quantity) * BigInt(nights);
      const created = await one(db, 'INSERT INTO seven.demo_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING RETURNING user_id', [user.id]);
      if (created) await db.query("INSERT INTO seven.demo_wallet_entries(entry_id,user_id,entry_type,amount_minor,balance_after_minor,reference,idempotency_key,description) VALUES($1,$2,'INITIAL_CREDIT',50000000000,50000000000,$3,'initial-demo-credit','Initial test credits — no cash value')", [randomUUID(), user.id, 'DCR-' + randomUUID()]);
      const account = await one(db, 'SELECT balance_minor FROM seven.demo_wallets WHERE user_id=$1 FOR UPDATE', [user.id]);
      if (!account || BigInt(account.balance_minor) < total) return fail(409, 'DEMO_WALLET_INSUFFICIENT', 'Your demo wallet has insufficient test credits.');
      const balance = BigInt(account.balance_minor) - total;
      const bookingId = randomUUID();
      const bookingRef = '7D-' + randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase();
      await db.query('UPDATE seven.demo_wallets SET balance_minor=$2,updated_at=now() WHERE user_id=$1', [user.id, balance.toString()]);
      const booking = await one(db, 'INSERT INTO seven.demo_bookings(booking_id,user_id,item_id,kind,item_title,city,start_date,end_date,quantity,unit_price_minor,total_minor,reference,idempotency_key,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *', [bookingId, user.id, item.item_id, item.kind, item.title, item.city, input.startDate, input.endDate ?? null, input.quantity, item.unit_price_minor, total.toString(), bookingRef, key, hash]);
      await db.query("INSERT INTO seven.demo_wallet_entries(entry_id,user_id,booking_id,entry_type,amount_minor,balance_after_minor,reference,idempotency_key,description) VALUES($1,$2,$3,'DEBIT',$4,$5,$6,$7,$8)", [randomUUID(), user.id, bookingId, total.toString(), balance.toString(), bookingRef, 'debit:' + key, 'Demo booking: ' + item.title]);
      return bookingView(booking!);
    });
  });

  route('post', '/api/demo/bookings/:id/cancel', async (req, res) => {
    const user = actor(res);
    const bookingId = z.uuid().parse(req.params.id);
    string(req.get('Idempotency-Key'), 'Idempotency key', 8, 200);
    return transaction(pool, async (db) => {
      const booking = await one(db, 'SELECT * FROM seven.demo_bookings WHERE booking_id=$1 AND user_id=$2 FOR UPDATE', [bookingId, user.id]);
      if (!booking) return fail(404, 'NOT_FOUND', 'Demo booking not found.');
      if (booking.status === 'CANCELLED') return booking;
      const account = await one(db, 'SELECT balance_minor FROM seven.demo_wallets WHERE user_id=$1 FOR UPDATE', [user.id]);
      if (!account) return fail(409, 'DEMO_WALLET_MISSING', 'Demo wallet not found.');
      const balance = BigInt(account.balance_minor) + BigInt(booking.total_minor);
      await db.query('UPDATE seven.demo_wallets SET balance_minor=$2,updated_at=now() WHERE user_id=$1', [user.id, balance.toString()]);
      const updated = await one(db, "UPDATE seven.demo_bookings SET status='CANCELLED',cancelled_at=now() WHERE booking_id=$1 RETURNING *", [bookingId]);
      await db.query("INSERT INTO seven.demo_wallet_entries(entry_id,user_id,booking_id,entry_type,amount_minor,balance_after_minor,reference,idempotency_key,description) VALUES($1,$2,$3,'REFUND',$4,$5,$6,$7,$8)", [randomUUID(), user.id, bookingId, booking.total_minor, balance.toString(), 'DRF-' + randomUUID(), 'refund:' + bookingId, 'Demo refund: ' + booking.item_title]);
      return updated;
    });
  });

}

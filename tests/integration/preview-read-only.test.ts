import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type { Pool } from 'pg';
import { createApp } from '../../services/platform/src/app.ts';
import type { PaymentProvider } from '../../services/platform/src/provider.ts';

const origin = 'https://preview-guard.seven.test';

test('read-only previews reject mutations before effects without disabling search or production', {
  timeout: 20000,
}, async (t) => {
  const environmentKeys = [
    'SEVEN_PREVIEW_READ_ONLY',
    'VERCEL_ENV',
    'OPENAI_API_KEY',
    'CRYPTO_ENABLED',
    'FLUTTERWAVE_WEBHOOK_SCHEME',
  ] as const;
  const previous = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of environmentKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  process.env.SEVEN_PREVIEW_READ_ONLY = 'true';
  process.env.VERCEL_ENV = 'preview';
  process.env.CRYPTO_ENABLED = 'false';
  process.env.FLUTTERWAVE_WEBHOOK_SCHEME = 'v3-verif-hash';
  delete process.env.OPENAI_API_KEY;

  const queries: string[] = [];
  const pool = {
    query: async (sql: string) => {
      queries.push(sql);
      assert.match(sql, /INSERT INTO seven\.account_rate_limits/);
      return { rows: [{ request_count: 1 }] };
    },
  } as unknown as Pool;
  let providerCalls = 0;
  const unexpectedProviderCall = async (): Promise<never> => {
    providerCalls += 1;
    assert.fail('Preview boundary tests must never call a payment provider.');
  };
  const provider: PaymentProvider = {
    mode: 'paystack',
    checkout: unexpectedProviderCall,
    verify: unexpectedProviderCall,
    refund: unexpectedProviderCall,
    refundStatus: unexpectedProviderCall,
    settlements: unexpectedProviderCall,
    subaccount: unexpectedProviderCall,
  };
  async function listen(environment: 'preview' | 'production') {
    const { app } = createApp({ pool, provider, environment, publicOrigin: origin });
    const server = await new Promise<Server>((resolve, reject) => {
      const listening = app.listen(0, '127.0.0.1', (error?: Error) =>
        error ? reject(error) : resolve(listening),
      );
      listening.once('error', reject);
    });
    t.after(
      () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  async function request(base: string, path: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  const preview = await listen('preview');

  await t.test(
    'account, booking, payment, refund and operations requests cannot reach their handlers',
    async () => {
      const id = '1c9c45da-655f-4076-bfbc-4ea5ff6b8205';
      for (const path of [
        '/auth/register',
        '/auth/login',
        '/auth/recovery',
        '/auth/recovery/complete',
        '/auth/logout',
        '/quotes',
        '/reservations',
        `/reservations/${id}/actions`,
        `/reservations/${id}/checkout`,
        '/payments/verify',
        `/reservations/${id}/refunds`,
        '/admin/reconcile',
      ]) {
        const result = await request(preview, path, 'POST', {});
        assert.equal(result.status, 503, path);
        assert.equal(result.body.error?.code, 'PREVIEW_READ_ONLY', path);
      }
      assert.deepEqual(queries, []);
      assert.equal(providerCalls, 0);
    },
  );

  await t.test(
    'both webhook routes return retryable rejection for delayed, out-of-order and duplicate events',
    async () => {
      for (const providerId of ['flutterwave', 'paystack']) {
        for (const [id, successful] of [
          [202, true],
          [101, false],
          [202, true],
        ] as const) {
          const result = await request(preview, `/webhooks/${providerId}`, 'POST', {
            event: successful
              ? providerId === 'flutterwave'
                ? 'charge.completed'
                : 'charge.success'
              : 'charge.failed',
            data: {
              id,
              tx_ref: 'seven-preview-fixture',
              reference: 'seven-preview-fixture',
              status: successful ? 'successful' : 'failed',
            },
          });
          assert.equal(result.status, 503, `${providerId}: ${id}/${successful}`);
          assert.equal(result.body.error?.code, 'PREVIEW_READ_ONLY');
        }
      }
      assert.deepEqual(queries, []);
      assert.equal(providerCalls, 0);
    },
  );

  await t.test(
    'GET and the AI handler remain reachable while Origin validation is retained',
    async () => {
      const live = await request(preview, '/health/live');
      assert.equal(live.status, 200);
      assert.equal(live.body.data.status, 'ok');
      const session = await request(preview, '/auth/session');
      assert.equal(session.status, 200);
      assert.equal(session.body.data.user, null);
      const ai = await request(preview, '/ai/interpret-search', 'POST', {
        message: 'Hotels in Lagos',
      });
      assert.equal(ai.status, 503);
      assert.equal(ai.body.error?.code, 'AI_NOT_CONFIGURED');
      assert.equal(
        queries.length,
        1,
        'Only the exempt AI handler may update its shared rate limit.',
      );
      const wrongOrigin = await fetch(`${preview}/api/auth/login`, {
        method: 'POST',
        headers: { Origin: 'https://other.seven.test', 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(wrongOrigin.status, 403);
      assert.equal((await wrongOrigin.json()).error?.code, 'ORIGIN_REJECTED');
      assert.equal(providerCalls, 0);
    },
  );

  await t.test(
    'production ignores the preview flag and reaches normal mutation validation',
    async () => {
      process.env.VERCEL_ENV = 'production';
      const production = await listen('production');
      const result = await request(production, '/auth/login', 'POST', {});
      assert.equal(result.status, 422);
      assert.equal(result.body.error?.code, 'VALIDATION_ERROR');
      assert.equal(queries.length, 1);
      assert.equal(providerCalls, 0);
    },
  );
});

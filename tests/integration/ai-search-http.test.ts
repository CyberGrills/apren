import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../../services/platform/src/app.ts';
import { digestToken } from '../../services/platform/src/auth.ts';
import { createPool, one } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';

test('AI search HTTP boundary validates requests and shares its PostgreSQL limit across apps', {
  skip: !process.env.TEST_DATABASE_URL || !process.env.TEST_RUNTIME_DATABASE_URL,
  timeout: 60000,
}, async () => {
  const ownerUrl = process.env.TEST_DATABASE_URL!;
  const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL!;
  for (const value of [ownerUrl, runtimeUrl]) {
    const url = new URL(value);
    assert.doesNotMatch(url.hostname, /(?:^|\.)supabase\.co$|(?:^|\.)pooler\.supabase\.com$/i);
    assert.match(decodeURIComponent(url.pathname.slice(1)), /_test_db$/);
  }
  const target = (value: string) => {
    const url = new URL(value);
    return [
      url.hostname,
      url.port || '5432',
      url.pathname,
      ...['host', 'port', 'database', 'dbname'].map((key) => url.searchParams.get(key) ?? ''),
    ];
  };
  assert.deepEqual(target(runtimeUrl), target(ownerUrl));
  const pool = createPool(ownerUrl);
  const appPool = createPool(runtimeUrl);
  const servers: Server[] = [];
  const ips = [0, 1].map(
    () => `2001:db8:${randomUUID().replaceAll('-', '').slice(0, 24).match(/.{4}/g)!.join(':')}`,
  );
  const hashes = ips.map((ip) => digestToken(`ai-search:ip:${ip}`));
  const previous = Object.fromEntries(
    ['OPENAI_API_KEY', 'OPENAI_MODEL', 'VERCEL'].map((key) => [key, process.env[key]]),
  );
  const realFetch = globalThis.fetch;
  let fixtureReady = false;
  let providerCalls = 0;
  try {
    const identity =
      'SELECT current_database() AS name,inet_server_addr()::text AS address,inet_server_port() AS port';
    const owner = await one(pool, identity);
    assert.match(String(owner?.name), /_test_db$/);
    assert.equal(owner?.name, decodeURIComponent(new URL(ownerUrl).pathname.slice(1)));
    assert.deepEqual(await one(appPool, identity), owner);
    const role = await one(
      appPool,
      `SELECT rolsuper,rolbypassrls,
      pg_has_role(current_user,'seven_app','USAGE') AS app_access FROM pg_roles WHERE rolname=current_user`,
    );
    assert.deepEqual(role, { rolsuper: false, rolbypassrls: false, app_access: true });
    await migrate(pool);
    fixtureReady = true;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    process.env.VERCEL = '1';
    const origin = 'http://localhost:5177';
    const bases: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const runtime = createApp({
        pool: appPool,
        provider: new MockProvider(),
        environment: 'test',
        publicOrigin: origin,
      });
      const server = await new Promise<Server>((resolve) => {
        const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      servers.push(server);
      bases.push(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    }
    const intent = {
      city: 'Lagos',
      checkInDate: '2030-11-01',
      checkOutDate: '2030-11-03',
      rooms: 2,
      amenities: ['Wi-Fi', 'Pool'],
      maxBudgetNaira: '1250.50',
      clarification: null,
    };
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (bases.some((base) => url.startsWith(`${base}/`))) return realFetch(input, init);
      assert.equal(
        url,
        'https://api.openai.com/v1/responses',
        'Unexpected external transport is forbidden.',
      );
      providerCalls += 1;
      assert.equal(JSON.parse(String(init?.body)).model, 'test-only-explicit-model');
      return new Response(JSON.stringify({ output_text: JSON.stringify(intent) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const post = async (index: number, body: unknown, ip = ips[0]!, requestOrigin = origin) => {
      const response = await fetch(`${bases[index]}/api/ai/interpret-search`, {
        method: 'POST',
        headers: {
          Origin: requestOrigin,
          'Content-Type': 'application/json',
          'x-vercel-forwarded-for': ip,
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    const input = {
      message: 'Two rooms in Lagos for two nights under 1250.50 Naira, with Wi-Fi and a pool.',
    };
    for (const configuration of [
      {},
      { OPENAI_API_KEY: 'test-only-not-a-real-key' },
      { OPENAI_MODEL: 'test-only-explicit-model' },
    ]) {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_MODEL;
      Object.assign(process.env, configuration);
      const unavailable = await post(0, input);
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.body.error.code, 'AI_NOT_CONFIGURED');
    }
    assert.equal(providerCalls, 0);
    process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
    process.env.OPENAI_MODEL = 'test-only-explicit-model';
    const malformed = await post(0, { message: 7 });
    assert.equal(malformed.status, 422);
    assert.equal(malformed.body.error.code, 'VALIDATION_ERROR');
    const rejected = await post(0, input, ips[0], 'https://untrusted.example.test');
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.error.code, 'ORIGIN_REJECTED');
    assert.equal(providerCalls, 0);
    const success = await post(0, input);
    assert.equal(success.status, 200);
    assert.deepEqual(success.body.data, {
      intent,
      provider: 'openai',
      model: 'test-only-explicit-model',
      searchParams: {
        kind: 'STAY',
        rooms: '2',
        city: 'Lagos',
        startDate: '2030-11-01',
        endDate: '2030-11-03',
        amenities: 'Wi-Fi,Pool',
        maxBaseTotalMinor: '125050',
      },
    });
    const attempts = await Promise.all(
      Array.from({ length: 21 }, (_, index) => post(index % 2, input, ips[1])),
    );
    assert.equal(attempts.filter((attempt) => attempt.status === 200).length, 20);
    const limited = attempts.filter((attempt) => attempt.status === 429);
    assert.equal(limited.length, 1);
    assert.equal(limited[0]?.body.error.code, 'RATE_LIMITED');
    assert.equal(providerCalls, 21, 'The rejected request must not reach the billable provider.');
    const counters = await pool.query(
      'SELECT scope_hash,request_count FROM seven.account_rate_limits WHERE scope_hash=ANY($1::varchar[])',
      [hashes],
    );
    assert.equal(counters.rows.length, 2);
    assert.equal(counters.rows.find((row) => row.scope_hash === hashes[0])?.request_count, 4);
    assert.equal(counters.rows.find((row) => row.scope_hash === hashes[1])?.request_count, 21);
  } finally {
    globalThis.fetch = realFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      await Promise.all(
        servers.map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
      );
      if (fixtureReady)
        await pool.query(
          'DELETE FROM seven.account_rate_limits WHERE scope_hash=ANY($1::varchar[])',
          [hashes],
        );
    } finally {
      await Promise.all([appPool.end(), pool.end()]);
    }
  }
});

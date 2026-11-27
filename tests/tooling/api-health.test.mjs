import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../backend/api/[...path].ts';

function makeResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('liveness responds without database configuration and is not cacheable', async () => {
  const response = makeResponse();
  await handler({ method: 'GET', url: '/api/health/live' }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { data: { status: 'ok' } });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('readiness missing-database response is not cacheable', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPostgresUrl = process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;

  try {
    const response = makeResponse();
    await handler({ method: 'GET', url: '/api/health/ready' }, response);

    assert.equal(response.statusCode, 503);
    assert.equal(response.body?.error?.code, 'DATABASE_NOT_CONFIGURED');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousPostgresUrl === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgresUrl;
  }
});

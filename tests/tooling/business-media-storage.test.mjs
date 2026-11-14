import assert from 'node:assert/strict';
import test from 'node:test';
import { businessMediaStorageFetch } from '../../backend/platform/src/businessMedia.ts';

async function withStorageEnvironment(fetchImpl, run) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://storage.example.test';
  process.env.SUPABASE_SECRET_KEY = 'unit-test-only-secret';
  globalThis.fetch = fetchImpl;

  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
  }
}

test('private business-media requests attach service credentials and reject redirects', async () => {
  await withStorageEnvironment(async (_input, init = {}) => {
    return new Response(null, { status: 204 });
  }, async () => {
    let captured;
    globalThis.fetch = async (input, init = {}) => {
      captured = { input, init };
      return new Response(null, { status: 204 });
    };

    const response = await businessMediaStorageFetch(
      'https://storage.example.test/storage/v1/object/sign/private/photo.jpg',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );

    assert.equal(response.status, 204);
    assert.equal(captured.init.redirect, 'error');
    const headers = new Headers(captured.init.headers);
    assert.equal(headers.get('apikey'), 'unit-test-only-secret');
    assert.equal(headers.get('authorization'), 'Bearer unit-test-only-secret');
    assert.equal(headers.get('content-type'), 'application/json');
  });
});

test('private business-media storage redirect failures propagate without following the destination', async () => {
  await withStorageEnvironment(async (_input, init = {}) => {
    assert.equal(init.redirect, 'error');
    throw new TypeError('redirect rejected by fetch');
  }, async () => {
    await assert.rejects(
      businessMediaStorageFetch('https://storage.example.test/storage/v1/object/private/photo.jpg'),
      /redirect rejected by fetch/,
    );
  });
});

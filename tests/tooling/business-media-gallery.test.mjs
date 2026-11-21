import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { businessMediaGalleries } from '../../backend/platform/src/businessMedia.ts';

const businessA = '11111111-1111-4111-8111-111111111111';
const businessB = '22222222-2222-4222-8222-222222222222';

async function withStorageEnvironment(run) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://storage.example.test';
  process.env.SUPABASE_SECRET_KEY = 'unit-test-only-secret';
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

function mediaRow(businessId, filename, isCover = false) {
  return {
    business_id: businessId,
    storage_path: businessId + '/' + filename,
    alt_text: filename + ' alt',
    caption: filename + ' caption',
    is_cover: isCover,
  };
}

test('directory galleries use one ranked database query for all businesses on the page', async () => {
  await withStorageEnvironment(async () => {
    const calls = [];
    const pool = {
      async query(sql, values) {
        calls.push({ sql, values });
        return {
          rows: [
            mediaRow(businessA, 'cover.jpg', true),
            mediaRow(businessA, 'room.jpg'),
            mediaRow(businessB, 'lobby.webp', true),
          ],
        };
      },
    };
    globalThis.fetch = async (_input, init = {}) => {
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      const headers = new Headers(init.headers);
      assert.equal(headers.get('authorization'), 'Bearer unit-test-only-secret');
      return new Response(
        JSON.stringify({ signedURL: '/object/sign/business-property-photos/signed.jpg' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const galleries = await businessMediaGalleries(pool, [businessA, businessB, businessA]);

    assert.equal(calls.length, 1, 'A directory page must not issue one gallery query per business.');
    assert.match(calls[0].sql, /ANY\(\$1::uuid\[\]\)/);
    assert.match(calls[0].sql, /row_number\(\) OVER \(PARTITION BY business_id/);
    assert.match(calls[0].sql, /gallery_rank <= 12/);
    assert.deepEqual(calls[0].values, [[businessA, businessB]]);
    assert.equal(galleries.get(businessA).length, 2);
    assert.equal(galleries.get(businessB).length, 1);
    assert.equal(galleries.get(businessA)[0].isCover, true);
    assert.match(galleries.get(businessA)[0].imageUrl, /^https:\/\/storage\.example\.test\/storage\/v1/);
  });
});

test('signed URL requests stay within the bounded Storage concurrency', async () => {
  await withStorageEnvironment(async () => {
    const media = Array.from({ length: 24 }, (_, index) =>
      mediaRow(index < 12 ? businessA : businessB, 'photo-' + index + '.jpg', index === 0 || index === 12),
    );
    const pool = {
      async query() {
        return { rows: media };
      },
    };
    let active = 0;
    let maximumActive = 0;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return new Response(
          JSON.stringify({ signedURL: '/object/sign/business-property-photos/photo.jpg' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      } finally {
        active -= 1;
      }
    };

    const galleries = await businessMediaGalleries(pool, [businessA, businessB]);

    assert.equal(calls, 24);
    assert.ok(maximumActive <= 8, 'Storage signing must not exceed eight concurrent requests.');
    assert.equal(galleries.get(businessA).length, 12);
    assert.equal(galleries.get(businessB).length, 12);
  });
});

test('a failed signed-image request does not blank other approved photos', async () => {
  await withStorageEnvironment(async () => {
    const pool = {
      async query() {
        return {
          rows: [
            mediaRow(businessA, 'good.jpg', true),
            mediaRow(businessA, 'bad.jpg'),
          ],
        };
      },
    };
    const previousWarn = console.warn;
    console.warn = () => {};
    globalThis.fetch = async (input) => {
      if (String(input).includes('bad.jpg')) throw new TypeError('simulated storage failure');
      return new Response(
        JSON.stringify({ signedURL: '/object/sign/business-property-photos/good.jpg' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    try {
      const galleries = await businessMediaGalleries(pool, [businessA]);
      assert.equal(galleries.get(businessA).length, 1);
      assert.match(galleries.get(businessA)[0].imageUrl, /good\.jpg$/);
    } finally {
      console.warn = previousWarn;
    }
  });
});

test('a missing optional gallery relation is reported but does not fail directory rendering', async () => {
  await withStorageEnvironment(async () => {
    const previousWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
      const pool = {
        async query() {
          const error = new Error('relation missing');
          error.code = '42P01';
          throw error;
        },
      };
      const galleries = await businessMediaGalleries(pool, [businessA, businessB]);
      assert.deepEqual(galleries.get(businessA), []);
      assert.deepEqual(galleries.get(businessB), []);
      assert.equal(warnings.length, 1);
      assert.equal(warnings[0][1].code, '42P01');
    } finally {
      console.warn = previousWarn;
    }
  });
});

test('empty directory pages do not query the gallery table', async () => {
  const pool = {
    async query() {
      assert.fail('No database query is expected for an empty directory page.');
    },
  };
  const galleries = await businessMediaGalleries(pool, []);
  assert.equal(galleries.size, 0);
});

test('the public directory calls the batch gallery helper once per result page', () => {
  const source = readFileSync(
    new URL('../../backend/platform/src/app.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /businessMediaGalleries\(\s*pool,\s*businesses\.map\(\(business\) => business\.id\)/);
  assert.doesNotMatch(source, /Promise\.all\(businesses\.map\(async \(business\)/);
});

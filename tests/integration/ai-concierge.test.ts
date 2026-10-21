import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'pg';
import { rateLimitAiSearch } from '../../services/platform/src/accounts.ts';
import { ApiError } from '../../services/platform/src/db.ts';
import {
  hotelSearchIntentSchema,
  interpretHotelSearch,
  isOpenAIConfigured,
  toHotelSearchParams,
} from '../../services/platform/src/aiConcierge.ts';

test('hotel search intent schema rejects extra fields and invalid room counts', () => {
  assert.equal(
    hotelSearchIntentSchema.safeParse({
      city: 'Lagos',
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-03',
      rooms: 1,
      amenities: [],
      maxBudgetNaira: null,
      clarification: null,
      availability: true,
    }).success,
    false,
  );
  assert.equal(
    hotelSearchIntentSchema.safeParse({
      city: null,
      checkInDate: null,
      checkOutDate: null,
      rooms: 11,
      amenities: [],
      maxBudgetNaira: null,
      clarification: null,
    }).success,
    false,
  );
  assert.equal(
    hotelSearchIntentSchema.safeParse({
      city: 'Lagos',
      checkInDate: '2026-02-31',
      checkOutDate: '2026-03-03',
      rooms: 1,
      amenities: [],
      maxBudgetNaira: null,
      clarification: null,
    }).success,
    false,
  );
});

test('hotel search parameters convert Naira to exact kobo and preserve deterministic filters', () => {
  const params = toHotelSearchParams({
    city: 'Lagos',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-03',
    rooms: 2,
    amenities: ['Wi-Fi', 'Pool'],
    maxBudgetNaira: '1250.50',
    clarification: null,
  });
  assert.equal(params.get('kind'), 'STAY');
  assert.equal(params.get('city'), 'Lagos');
  assert.equal(params.get('rooms'), '2');
  assert.equal(params.get('startDate'), '2026-11-01');
  assert.equal(params.get('endDate'), '2026-11-03');
  assert.equal(params.get('amenities'), 'Wi-Fi,Pool');
  assert.equal(params.get('maxBaseTotalMinor'), '125050');
});

test('OpenAI intent parser uses Responses API, strict schema, and validates model output', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  process.env.OPENAI_MODEL = 'gpt-6-luna';
  try {
    let captured: { url: string; init?: RequestInit } | undefined;
    const result = await interpretHotelSearch(
      'Two nights in Lagos, one room, under ₦50,000',
      async (input, init) => {
        captured = { url: String(input), init };
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              city: 'Lagos',
              checkInDate: '2026-11-01',
              checkOutDate: '2026-11-03',
              rooms: 1,
              amenities: [],
              maxBudgetNaira: '50000',
              clarification: null,
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );
    assert.equal(captured?.url, 'https://api.openai.com/v1/responses');
    assert.ok(captured?.init?.headers);
    assert.equal(
      (captured.init.headers as Record<string, string>).Authorization,
      'Bearer test-only-not-a-real-key',
    );
    const request = JSON.parse(String(captured?.init?.body)) as {
      store: boolean;
      text: { format: { type: string; strict: boolean } };
    };
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, 'json_schema');
    assert.equal(request.text.format.strict, true);
    assert.equal(result.city, 'Lagos');
    assert.equal(result.maxBudgetNaira, '50000');
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test('billable AI hotel search uses a shared per-IP PostgreSQL rate limit', async () => {
  let requestCount = 0;
  const pool = {
    query: async (sql: string) => {
      assert.match(sql, /seven\.account_rate_limits/);
      requestCount += 1;
      return { rows: [{ request_count: requestCount }] };
    },
  } as unknown as Pool;

  for (let i = 0; i < 20; i += 1) {
    await rateLimitAiSearch(pool, '203.0.113.10');
  }
  await assert.rejects(
    () => rateLimitAiSearch(pool, '203.0.113.10'),
    (error: unknown) =>
      error instanceof ApiError && error.status === 429 && error.code === 'RATE_LIMITED',
  );
  assert.equal(requestCount, 21);
});

test('hotel intent parsing requires explicit configuration and validates incomplete provider output', async (t) => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const intent = {
    city: 'Lagos',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-03',
    rooms: 1,
    amenities: [],
    maxBudgetNaira: '50000.01',
    clarification: null,
  };
  const result = (value: unknown) => async () =>
    new Response(
      JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
      }),
    );
  try {
    await t.test('no key or model means no outbound provider request', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_MODEL;
      assert.equal(isOpenAIConfigured(), false);
      const neverFetch = async () => {
        throw new Error('Unexpected outbound request.');
      };
      await assert.rejects(() => interpretHotelSearch('Lagos stay', neverFetch), /OPENAI_API_KEY/);
      process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
      assert.equal(isOpenAIConfigured(), false);
      await assert.rejects(() => interpretHotelSearch('Lagos stay', neverFetch), /OPENAI_MODEL/);
      process.env.OPENAI_MODEL = 'test-hotel-parser';
      assert.equal(isOpenAIConfigured(), true);
    });
    await t.test('missing dates require clarification even if the model omits it', async () => {
      const parsed = await interpretHotelSearch(
        'Lagos stay',
        result({ ...intent, checkInDate: null }),
      );
      assert.equal(parsed.checkInDate, null);
      assert.ok(parsed.clarification);
    });
    await t.test('checkout before check-in is cleared and requires clarification', async () => {
      const parsed = await interpretHotelSearch(
        'Lagos stay',
        result({ ...intent, checkOutDate: '2026-10-31' }),
      );
      assert.equal(parsed.checkOutDate, null);
      assert.ok(parsed.clarification);
    });
    await t.test('valid Responses API output preserves exact monetary strings', async () => {
      const parsed = await interpretHotelSearch('Lagos stay', result(intent));
      assert.equal(toHotelSearchParams(parsed).get('maxBaseTotalMinor'), '5000001');
    });
    await t.test('malformed and extra output fields are rejected', async () => {
      await assert.rejects(() =>
        interpretHotelSearch('Lagos stay', result({ ...intent, rooms: 0 })),
      );
      await assert.rejects(() =>
        interpretHotelSearch('Lagos stay', result({ ...intent, available: true })),
      );
      await assert.rejects(
        () => interpretHotelSearch('Lagos stay', async () => new Response('{}')),
        /structured output/,
      );
    });
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

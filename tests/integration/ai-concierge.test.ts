import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hotelSearchIntentSchema,
  interpretHotelSearch,
  toHotelSearchParams,
} from '../../services/platform/src/aiConcierge.ts';

test('hotel search intent schema rejects extra fields and invalid room counts', () => {
  assert.equal(hotelSearchIntentSchema.safeParse({
    city: 'Lagos',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-03',
    rooms: 1,
    amenities: [],
    maxBudgetNaira: null,
    clarification: null,
    availability: true,
  }).success, false);
  assert.equal(hotelSearchIntentSchema.safeParse({
    city: null,
    checkInDate: null,
    checkOutDate: null,
    rooms: 11,
    amenities: [],
    maxBudgetNaira: null,
    clarification: null,
  }).success, false);
  assert.equal(hotelSearchIntentSchema.safeParse({
    city: 'Lagos',
    checkInDate: '2026-02-31',
    checkOutDate: '2026-03-03',
    rooms: 1,
    amenities: [],
    maxBudgetNaira: null,
    clarification: null,
  }).success, false);
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
    const result = await interpretHotelSearch('Two nights in Lagos, one room, under ₦50,000', async (input, init) => {
      captured = { url: String(input), init };
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          city: 'Lagos',
          checkInDate: '2026-11-01',
          checkOutDate: '2026-11-03',
          rooms: 1,
          amenities: [],
          maxBudgetNaira: '50000',
          clarification: null,
        }),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    assert.equal(captured?.url, 'https://api.openai.com/v1/responses');
    assert.equal((captured?.init?.headers as Record<string, string>).Authorization, 'Bearer test-only-not-a-real-key');
    const request = JSON.parse(String(captured?.init?.body)) as { store: boolean; text: { format: { type: string; strict: boolean } } };
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

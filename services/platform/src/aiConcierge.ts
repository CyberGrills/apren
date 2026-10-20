import { z } from 'zod';

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date.').nullable();
const budgetNaira = z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/).nullable();

export const hotelSearchIntentSchema = z.strictObject({
  city: z.string().trim().min(1).max(160).nullable(),
  checkInDate: localDate,
  checkOutDate: localDate,
  rooms: z.number().int().min(1).max(10),
  amenities: z.array(z.string().trim().min(1).max(80)).max(10),
  maxBudgetNaira: budgetNaira,
  clarification: z.string().trim().max(240).nullable(),
});

export type HotelSearchIntent = z.infer<typeof hotelSearchIntentSchema>;

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'city',
    'checkInDate',
    'checkOutDate',
    'rooms',
    'amenities',
    'maxBudgetNaira',
    'clarification',
  ],
  properties: {
    city: { type: ['string', 'null'] },
    checkInDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    checkOutDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    rooms: { type: 'integer', minimum: 1, maximum: 10 },
    amenities: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    maxBudgetNaira: { type: ['string', 'null'], pattern: '^(0|[1-9]\\d{0,8})(\\.\\d{1,2})?$' },
    clarification: { type: ['string', 'null'] },
  },
} as const;

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function lagosDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function responseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid OpenAI response.');
  const body = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof body.output_text === 'string') return body.output_text;
  const texts = (body.output ?? []).flatMap((item) =>
    (item.content ?? [])
      .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
      .map((part) => part.text as string),
  );
  if (texts.length === 0) throw new Error('OpenAI returned no structured output.');
  return texts.join('');
}

export async function interpretHotelSearch(
  message: string,
  fetcher: typeof fetch = fetch,
): Promise<HotelSearchIntent> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna';
  const today = lagosDate();
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 400,
      instructions: [
        'You are the 7even hotel search intent parser.',
        'Convert the guest request into only the requested structured search fields.',
        `The current date in Africa/Lagos is ${today}.`,
        'Resolve relative dates against that date. Dates must be valid YYYY-MM-DD calendar dates.',
        'Never invent a city, date, amenity, budget, or number of rooms.',
        'If a field was not stated or cannot be confidently inferred, use null for nullable fields.',
        'Default rooms to 1 only when the guest did not specify a room count.',
        'Budget must be a numeric Naira amount as a string, without currency symbols or separators.',
        'If check-in or check-out is missing or invalid, set clarification to a concise question; otherwise use null.',
        'This is intent extraction only. Do not claim any hotel is available or booked.',
      ].join(' '),
      input: message,
      text: {
        format: {
          type: 'json_schema',
          name: 'hotel_search_intent',
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    // Do not pass provider response bodies, credentials, or internal details to callers.
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }
  const payload: unknown = await response.json();
  const parsed = JSON.parse(responseText(payload)) as unknown;
  const intent = hotelSearchIntentSchema.parse(parsed);
  if (intent.checkInDate && intent.checkOutDate && intent.checkOutDate <= intent.checkInDate) {
    return {
      ...intent,
      checkOutDate: null,
      clarification: 'What date would you like to check out?',
    };
  }
  return intent;
}

export function toHotelSearchParams(intent: HotelSearchIntent): URLSearchParams {
  const params = new URLSearchParams({ kind: 'STAY', rooms: String(intent.rooms) });
  if (intent.city) params.set('city', intent.city);
  if (intent.checkInDate) params.set('startDate', intent.checkInDate);
  if (intent.checkOutDate) params.set('endDate', intent.checkOutDate);
  if (intent.amenities.length) params.set('amenities', intent.amenities.join(','));
  if (intent.maxBudgetNaira !== null) {
    const [whole, fraction = ''] = intent.maxBudgetNaira.split('.');
    const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    params.set('maxBaseTotalMinor', minor.toString());
  }
  return params;
}

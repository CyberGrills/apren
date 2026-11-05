import type { ApiEnvelope, ApiErrorBody, ApiValidationIssue } from '@7even/contracts';
let csrfToken: string | null = null;
export function setCsrfToken(value: string | null) {
  csrfToken = value;
}
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]>;
  formErrors?: string[];
  issues?: ApiValidationIssue[];
  requestId?: string;
  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
    this.formErrors = body.formErrors;
    this.issues = body.issues;
    this.requestId = body.requestId;
  }
}
export interface ApiOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  keepalive?: boolean;
}
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (csrfToken && method !== 'GET') headers.set('X-CSRF-Token', csrfToken);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    signal: options.signal,
    keepalive: options.keepalive,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorBody | null;
  if (!response.ok) {
    if (
      response.status === 401 &&
      body &&
      'error' in body &&
      body.error.code === 'AUTHENTICATION_REQUIRED'
    )
      window.dispatchEvent(new Event('seven:session-expired'));
    throw new ApiError(
      response.status,
      body && 'error' in body
        ? body.error
        : {
            code: 'REQUEST_FAILED',
            message:
              response.status === 429
                ? 'Too many requests. Please wait a moment.'
                : 'We could not complete that request. Please try again.',
          },
    );
  }
  if (!body || !('data' in body)) throw new Error('The server returned an unreadable response.');
  if (method !== 'GET') window.dispatchEvent(new Event('seven:changed'));
  return body.data;
}

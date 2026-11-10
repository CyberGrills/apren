/**
 * Helpers for authenticated private-object requests.
 * Never forward service credentials across redirects and never buffer an
 * untrusted object body beyond its declared application limit.
 */
export function fetchPrivateStorage(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, { ...init, redirect: 'error' });
}

export async function readBoundedResponseBody(
  response: Response,
  maxBytes: number,
  errorCode = 'RESPONSE_BODY_TOO_LARGE',
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBytes must be a non-negative safe integer.');
  }

  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const declaredBytes = Number(declaredLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      try { await response.body?.cancel(); } catch { /* preserve the size error */ }
      throw new Error(errorCode);
    }
  }

  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (value.byteLength > maxBytes - totalBytes) {
        try { await reader.cancel(); } catch { /* preserve the size error */ }
        throw new Error(errorCode);
      }
      totalBytes += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

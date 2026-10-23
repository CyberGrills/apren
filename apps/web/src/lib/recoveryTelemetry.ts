import { api } from './api.ts';

export type RecoveryEvent =
  | 'ROOM_VIEW'
  | 'BOOKING_START'
  | 'CHECKOUT_VIEW'
  | 'ABANDON'
  | 'PAYMENT_FAILED';

type RecoveryReason = 'PRICE' | 'DATES' | 'POLICY' | 'PAYMENT' | 'QUESTION' | 'UNKNOWN';

let fallbackSessionId: string | null = null;

function sessionId(): string {
  try {
    const key = 'seven.recovery.session.v1';
    const existing = sessionStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    fallbackSessionId ??= crypto.randomUUID();
    return fallbackSessionId;
  }
}

/** Pseudonymous, best-effort funnel telemetry. Never sends names, phone numbers, email or payment data. */
export async function recordRecoveryEvent(input: {
  offeringId: string;
  event: RecoveryEvent;
  amountMinor?: string;
  reason?: RecoveryReason;
  keepalive?: boolean;
}): Promise<void> {
  try {
    await api('/recovery/events', {
      method: 'POST',
      keepalive: input.keepalive ?? false,
      body: {
        eventId: crypto.randomUUID(),
        sessionId: sessionId(),
        offeringId: input.offeringId,
        event: input.event,
        ...(input.amountMinor !== undefined ? { amountMinor: input.amountMinor } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        occurredAt: new Date().toISOString(),
        contactChannel: 'NONE',
        contactConsent: false,
      },
    });
  } catch {
    // Telemetry must never interrupt browsing or booking.
  }
}

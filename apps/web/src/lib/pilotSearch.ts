export interface PilotSearchInput {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  budgetNaira?: string;
  rooms?: string;
}

/**
 * Build the existing discovery route's supported query shape.
 * Live hotel inventory filters by city and Nigerian state; q is used only
 * by the explicitly directory-only fallback in ExplorePage.
 */
export function buildPilotSearchParams(input: PilotSearchInput): URLSearchParams {
  const parts = input.destination.split(',').map((part) => part.trim()).filter(Boolean);
  const city = (parts[0] ?? '').slice(0, 160);
  const state = parts.length > 1 ? parts.slice(1).join(', ').slice(0, 100) : '';
  const query = new URLSearchParams({ kind: 'STAY', city });
  if (state) query.set('state', state);
  if (input.destination.trim()) query.set('q', input.destination.trim().slice(0, 160));
  if (input.checkIn) query.set('startDate', input.checkIn);
  if (input.checkOut) query.set('endDate', input.checkOut);

  const budget = input.budgetNaira?.trim() ?? '';
  if (budget && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(budget)) {
    const minor = Math.round(Number(budget) * 100);
    if (Number.isSafeInteger(minor) && minor > 0) {
      query.set('maxBaseTotalMinor', String(minor));
    }
  }
  const rooms = Number(input.rooms ?? '1');
  query.set('rooms', String(Number.isInteger(rooms) && rooms >= 1 && rooms <= 100 ? rooms : 1));
  return query;
}

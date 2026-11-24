/** Helpers for the single "Where" search box. Pure, so they can be unit tested. */

export interface WhereSelection {
  state: string;
  city: string;
}

export function describeWhere(state: string, city: string): string {
  if (!city) return state;
  return state ? `${city}, ${state}` : city;
}

/** Typed text that exactly matches a state is a state; anything else is a place name. */
export function whereFromText(text: string, stateNames: readonly string[]): WhereSelection {
  const value = text.trim();
  if (!value) return { state: '', city: '' };
  const key = value.toLocaleLowerCase('en-NG');
  const state = stateNames.find((name) => name.toLocaleLowerCase('en-NG') === key);
  return state ? { state, city: '' } : { state: '', city: value };
}

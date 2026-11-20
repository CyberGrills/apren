/** Text matching for place names. Pure functions, so they can be unit tested without a browser. */

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en-NG')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

interface Searchable {
  name: string;
  area?: string | null;
}

/**
 * Filters and ranks places for a typed query: exact name first, then names starting with the
 * query, then words starting with it, then names containing it, then area matches.
 * Ties keep the original order.
 */
export function searchLocations<T extends Searchable>(
  items: readonly T[],
  query: string,
  limit = 50,
): T[] {
  const needle = normalizeSearchText(query);
  if (!needle) return items.slice(0, limit);
  const ranked: { item: T; rank: number; index: number }[] = [];
  for (const [index, item] of items.entries()) {
    const name = normalizeSearchText(item.name);
    let rank = -1;
    if (name === needle) rank = 0;
    else if (name.startsWith(needle)) rank = 1;
    else if (name.split(' ').some((word) => word.startsWith(needle))) rank = 2;
    else if (name.includes(needle)) rank = 3;
    else if (item.area && normalizeSearchText(item.area).includes(needle)) rank = 4;
    if (rank >= 0) ranked.push({ item, rank, index });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map((entry) => entry.item);
}

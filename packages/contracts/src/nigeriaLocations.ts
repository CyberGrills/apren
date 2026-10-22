export interface NigeriaState {
  code: string;
  slug: string;
  name: string;
  capital: string;
}

export const nigeriaStates: readonly NigeriaState[] = [
  { code: '45', slug: 'abia', name: 'Abia', capital: 'Umuahia' },
  { code: '35', slug: 'adamawa', name: 'Adamawa', capital: 'Yola' },
  { code: '21', slug: 'akwa-ibom', name: 'Akwa Ibom', capital: 'Uyo' },
  { code: '25', slug: 'anambra', name: 'Anambra', capital: 'Awka' },
  { code: '46', slug: 'bauchi', name: 'Bauchi', capital: 'Bauchi' },
  { code: '52', slug: 'bayelsa', name: 'Bayelsa', capital: 'Yenagoa' },
  { code: '26', slug: 'benue', name: 'Benue', capital: 'Makurdi' },
  { code: '27', slug: 'borno', name: 'Borno', capital: 'Maiduguri' },
  { code: '22', slug: 'cross-river', name: 'Cross River', capital: 'Calabar' },
  { code: '36', slug: 'delta', name: 'Delta', capital: 'Asaba' },
  { code: '53', slug: 'ebonyi', name: 'Ebonyi', capital: 'Abakaliki' },
  { code: '37', slug: 'edo', name: 'Edo', capital: 'Benin City' },
  { code: '54', slug: 'ekiti', name: 'Ekiti', capital: 'Ado-Ekiti' },
  { code: '47', slug: 'enugu', name: 'Enugu', capital: 'Enugu' },
  {
    code: '11',
    slug: 'fct',
    name: 'Federal Capital Territory (Abuja)',
    capital: 'Abuja',
  },
  { code: '55', slug: 'gombe', name: 'Gombe', capital: 'Gombe' },
  { code: '28', slug: 'imo', name: 'Imo', capital: 'Owerri' },
  { code: '39', slug: 'jigawa', name: 'Jigawa', capital: 'Dutse' },
  { code: '23', slug: 'kaduna', name: 'Kaduna', capital: 'Kaduna' },
  { code: '29', slug: 'kano', name: 'Kano', capital: 'Kano' },
  { code: '24', slug: 'katsina', name: 'Katsina', capital: 'Katsina' },
  { code: '40', slug: 'kebbi', name: 'Kebbi', capital: 'Birnin Kebbi' },
  { code: '41', slug: 'kogi', name: 'Kogi', capital: 'Lokoja' },
  { code: '30', slug: 'kwara', name: 'Kwara', capital: 'Ilorin' },
  { code: '05', slug: 'lagos', name: 'Lagos', capital: 'Ikeja' },
  { code: '56', slug: 'nasarawa', name: 'Nasarawa', capital: 'Lafia' },
  { code: '31', slug: 'niger', name: 'Niger', capital: 'Minna' },
  { code: '16', slug: 'ogun', name: 'Ogun', capital: 'Abeokuta' },
  { code: '48', slug: 'ondo', name: 'Ondo', capital: 'Akure' },
  { code: '42', slug: 'osun', name: 'Osun', capital: 'Osogbo' },
  { code: '32', slug: 'oyo', name: 'Oyo', capital: 'Ibadan' },
  { code: '49', slug: 'plateau', name: 'Plateau', capital: 'Jos' },
  { code: '50', slug: 'rivers', name: 'Rivers', capital: 'Port Harcourt' },
  { code: '51', slug: 'sokoto', name: 'Sokoto', capital: 'Sokoto' },
  { code: '43', slug: 'taraba', name: 'Taraba', capital: 'Jalingo' },
  { code: '44', slug: 'yobe', name: 'Yobe', capital: 'Damaturu' },
  { code: '57', slug: 'zamfara', name: 'Zamfara', capital: 'Gusau' },
];

export function normalizeNigeriaLocation(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findNigeriaState(value: string | null | undefined): NigeriaState | undefined {
  if (!value) return undefined;
  const key = normalizeNigeriaLocation(value).replace(/ state$/, '');
  if (
    ['fct', 'abuja', 'federal capital territory', 'federal capital territory abuja'].includes(key)
  ) {
    return nigeriaStates.find((state) => state.code === '11');
  }
  return nigeriaStates.find(
    (state) =>
      state.code === key ||
      normalizeNigeriaLocation(state.name) === key ||
      normalizeNigeriaLocation(state.slug) === key,
  );
}

export function nigeriaStateDataPath(stateOrCode: string): string {
  const state = findNigeriaState(stateOrCode);
  if (!state) throw new RangeError('Choose a Nigerian state or FCT.');
  return `/data/nigeria/${state.slug}.json`;
}

export type NigeriaLocationRow = [
  id: number,
  name: string,
  areaCode: string,
  population: number,
  aliases: string,
];

export interface NigeriaStateLocationData {
  stateCode: string;
  areas: Record<string, string>;
  places: NigeriaLocationRow[];
}

export interface NigeriaLocation {
  id: string;
  name: string;
  stateCode: string;
  state: string;
  area: string;
  aliases: string[];
  population: number;
}

export function decodeNigeriaStateLocations(data: NigeriaStateLocationData): NigeriaLocation[] {
  const state = findNigeriaState(data.stateCode);
  if (!state) throw new RangeError('The location file has an unknown Nigerian state.');
  return data.places.map(([id, name, areaCode, population, aliases]) => ({
    id: `geonames:${id}`,
    name,
    stateCode: state.code,
    state: state.name,
    area: data.areas[areaCode] ?? '',
    aliases: aliases ? aliases.split('|') : [],
    population,
  }));
}

function deduplicateNigeriaCities(locations: readonly NigeriaLocation[]): NigeriaLocation[] {
  const cities = new Map<string, NigeriaLocation>();
  for (const location of locations) {
    const key = `${location.stateCode}:${normalizeNigeriaLocation(location.name)}`;
    const current = cities.get(key);
    if (!current || location.population > current.population) cities.set(key, location);
  }
  return [...cities.values()];
}

export function uniqueNigeriaCities(locations: readonly NigeriaLocation[]): NigeriaLocation[] {
  return deduplicateNigeriaCities(locations).sort((a, b) => a.name.localeCompare(b.name));
}

export function searchNigeriaLocations(
  locations: readonly NigeriaLocation[],
  query: string,
  limit = 8,
): NigeriaLocation[] {
  const key = normalizeNigeriaLocation(query);
  const tokens = key.split(' ').filter(Boolean);
  const ranked: { location: NigeriaLocation; score: number }[] = [];
  for (const location of locations) {
    const name = normalizeNigeriaLocation(location.name);
    const aliases = location.aliases.map(normalizeNigeriaLocation);
    const context = normalizeNigeriaLocation(`${location.name} ${location.area} ${location.state}`);
    let score = 5;
    if (!key) score = 0;
    else if (name === key) score = 0;
    else if (aliases.includes(key)) score = 1;
    else if (name.startsWith(key)) score = 2;
    else if (aliases.some((alias) => alias.startsWith(key))) score = 3;
    else if (tokens.every((token) => context.includes(token))) score = 4;
    else continue;
    ranked.push({ location, score });
  }
  ranked.sort(
    (a, b) =>
      a.score - b.score ||
      Number(b.location.id === 'geonames:2319480') - Number(a.location.id === 'geonames:2319480') ||
      b.location.population - a.location.population ||
      a.location.name.localeCompare(b.location.name) ||
      a.location.id.localeCompare(b.location.id),
  );
  return deduplicateNigeriaCities(ranked.map(({ location }) => location)).slice(
    0,
    Math.max(0, limit),
  );
}

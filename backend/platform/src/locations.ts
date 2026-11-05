import { readFile } from 'node:fs/promises';
import {
  decodeNigeriaStateLocations,
  nigeriaStateDataPath,
  nigeriaStates,
  searchNigeriaLocations,
  type NigeriaLocation,
  type NigeriaStateLocationData,
} from '@7even/contracts';

interface LocationMetadata {
  city: string;
  state?: string | null;
}

export function retainedLocationState(
  input: LocationMetadata,
  previous?: LocationMetadata,
): string | null {
  if (input.state !== undefined) return input.state;
  if (
    previous &&
    input.city.trim().toLocaleLowerCase('en-NG') === previous.city.trim().toLocaleLowerCase('en-NG')
  )
    return previous.state ?? null;
  return null;
}

let locations: Promise<NigeriaLocation[]> | undefined;

export async function findLocations(
  query: string,
  state: string,
  limit: number,
): Promise<NigeriaLocation[]> {
  locations ??= Promise.all(
    nigeriaStates.map(async (entry) => {
      const file = new URL(`../../../apps/web/public${nigeriaStateDataPath(entry.code)}`, import.meta.url);
      const data = JSON.parse(await readFile(file, 'utf8')) as NigeriaStateLocationData;
      return decodeNigeriaStateLocations(data);
    }),
  ).then((groups) => groups.flat());
  const all = await locations;
  return searchNigeriaLocations(
    state ? all.filter((location) => location.state === state) : all,
    query,
    limit,
  );
}

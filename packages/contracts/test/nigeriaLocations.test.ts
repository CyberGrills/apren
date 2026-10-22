import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  decodeNigeriaStateLocations,
  findNigeriaState,
  type NigeriaLocation,
  type NigeriaStateLocationData,
  nigeriaStateDataPath,
  nigeriaStates,
  normalizeNigeriaLocation,
  searchNigeriaLocations,
  uniqueNigeriaCities,
} from '../src/nigeriaLocations.ts';

test('Nigeria state choices cover 36 states and FCT with stable aliases', () => {
  assert.equal(nigeriaStates.length, 37);
  assert.equal(new Set(nigeriaStates.map((state) => state.code)).size, 37);
  assert.equal(findNigeriaState('akwa-ibom')?.name, 'Akwa Ibom');
  assert.equal(findNigeriaState('Akwa Ibom State')?.code, '21');
  assert.equal(findNigeriaState('Abuja')?.code, '11');
  assert.equal(findNigeriaState('FCT')?.code, '11');
  assert.equal(findNigeriaState('Federal Capital Territory (Abuja)')?.code, '11');
  assert.equal(findNigeriaState('not a state'), undefined);
  assert.equal(nigeriaStateDataPath('21'), '/data/nigeria/akwa-ibom.json');
  assert.throws(() => nigeriaStateDataPath('../other'));
});

const sample: NigeriaStateLocationData = {
  stateCode: '21',
  areas: { '3031': 'Uyo' },
  places: [
    [2319480, 'Uyo', '3031', 436606, 'Ujo'],
    [1, 'Éket', '', 100, 'Eket'],
    [2, 'Éket', '3031', 0, 'Eket'],
  ],
};

test('decoding preserves source identity and display names while city choices deduplicate', () => {
  const locations = decodeNigeriaStateLocations(sample);
  assert.equal(locations[0]?.id, 'geonames:2319480');
  assert.equal(locations[0]?.state, 'Akwa Ibom');
  assert.equal(locations[0]?.area, 'Uyo');
  assert.equal(locations[1]?.name, 'Éket');
  assert.equal(uniqueNigeriaCities(locations).length, 2);
  assert.deepEqual(
    uniqueNigeriaCities(locations).map(({ name }) => name),
    ['Éket', 'Uyo'],
  );
  assert.equal(normalizeNigeriaLocation('  Éket—Town '), 'eket town');
  assert.equal(searchNigeriaLocations(locations, '')[0]?.name, 'Uyo');
  assert.equal(searchNigeriaLocations(locations, 'ujo')[0]?.name, 'Uyo');
  assert.equal(searchNigeriaLocations(locations, 'eket')[0]?.name, 'Éket');
  assert.equal(searchNigeriaLocations(locations, 'uyo akwa ibom')[0]?.name, 'Uyo');
  assert.equal(searchNigeriaLocations(locations, 'missing').length, 0);
  assert.equal(searchNigeriaLocations(locations, '', 1).length, 1);
  assert.throws(() => decodeNigeriaStateLocations({ ...sample, stateCode: '00' }));
});

test('the shipped catalog covers settlements and neighborhood areas in every state without unknown states', async () => {
  const ids = new Set<string>();
  const all: NigeriaLocation[] = [];
  let count = 0;
  for (const state of nigeriaStates) {
    const url = new URL(
      `../../../apps/web/public${nigeriaStateDataPath(state.code)}`,
      import.meta.url,
    );
    const data = JSON.parse(await readFile(url, 'utf8')) as NigeriaStateLocationData;
    assert.equal(data.stateCode, state.code);
    const locations = decodeNigeriaStateLocations(data);
    all.push(...locations);
    assert.ok(locations.length > 0, `${state.name} has no locations`);
    for (const location of locations) {
      assert.equal(location.stateCode, state.code);
      assert.ok(location.name.trim());
      assert.ok(!ids.has(location.id), `duplicate source ID ${location.id}`);
      ids.add(location.id);
      count += 1;
    }
  }
  assert.ok(count > 60_000, `unexpected nationwide coverage: ${count}`);
  assert.ok(ids.has('geonames:2319480'), 'Uyo is missing');
  assert.ok(ids.has('geonames:2352778'), 'Abuja is missing');
  assert.ok(ids.has('geonames:2332459'), 'Lagos is missing');
  assert.ok(!ids.has('geonames:2321393'), 'A record without a resolved state was included');
  assert.equal(searchNigeriaLocations(all, '')[0]?.name, 'Uyo');
  assert.equal(searchNigeriaLocations(all, 'Abuja')[0]?.stateCode, '11');
  assert.equal(searchNigeriaLocations(all, 'Lagos')[0]?.name, 'Lagos');
  assert.equal(searchNigeriaLocations(all, 'Victoria Island')[0]?.name, 'Victoria Island');
  assert.equal(searchNigeriaLocations(all, 'Victoria Island')[0]?.state, 'Lagos');
  assert.equal(searchNigeriaLocations(all, 'Uyogh')[0]?.state, 'Benue');
  assert.ok(searchNigeriaLocations(all, 'Abakpa').length > 1, 'Names across states were merged');
  const provenance = JSON.parse(
    await readFile(
      new URL('../../../apps/web/public/data/nigeria/provenance.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(provenance.includedLocations, count);
  assert.equal(provenance.includedPopulatedPlaces + provenance.additionalSourceAreas.length, count);
  assert.equal(provenance.additionalSourceAreas[0]?.id, '2566582');
  assert.equal(provenance.statesAndFct, 37);
  assert.equal(provenance.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  assert.ok(provenance.excludedUnresolvedStates > 0);
  assert.ok(provenance.includedFeatures.includes('PPLX'));
  assert.ok(provenance.dataBytes < 3_000_000, 'The catalog exceeded the client delivery budget');
});

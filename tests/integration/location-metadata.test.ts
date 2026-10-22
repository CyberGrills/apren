import assert from 'node:assert/strict';
import test from 'node:test';
import { nigeriaStateInput, offeringInput } from '@7even/contracts';
import { retainedLocationState } from '../../services/platform/src/locations.ts';

test('an omitted state survives a city label normalization but clears when the city changes', () => {
  const previous = { city: 'Uyo', state: 'Akwa Ibom' };
  assert.equal(retainedLocationState({ city: ' uYO ' }, previous), 'Akwa Ibom');
  assert.equal(retainedLocationState({ city: 'Lagos' }, previous), null);
  assert.equal(retainedLocationState({ city: 'Uyo' }), null);
  assert.equal(retainedLocationState({ city: 'Uyo', state: null }, previous), null);
  assert.equal(retainedLocationState({ city: 'Oke', state: 'Ogun' }, previous), 'Ogun');
});

test('state metadata accepts canonical aliases while legacy offering inputs may omit it', () => {
  assert.equal(nigeriaStateInput.parse('akwa-ibom'), 'Akwa Ibom');
  assert.equal(nigeriaStateInput.parse('fct'), 'Federal Capital Territory (Abuja)');
  assert.equal(nigeriaStateInput.parse('  '), null);
  assert.equal(nigeriaStateInput.parse(undefined), undefined);
  assert.equal(nigeriaStateInput.safeParse('Unknown State').success, false);
  assert.equal(nigeriaStateInput.safeParse(['Lagos', 'Ogun']).success, false);
  assert.equal(offeringInput.safeParse({
    title: 'A legacy offering', description: 'An existing city-only location remains accepted.',
    kind: 'STAY', city: 'Unclassified place', address: 'A legacy street address',
    priceMinor: '100000', capacity: 1,
  }).success, true);
});

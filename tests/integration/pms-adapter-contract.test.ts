import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPmsConnectionReady,
  assertReadOnlyMethod,
  createReadOnlyPmsAdapter,
  inventoryFreshness,
  PmsAdapterError,
  validatePmsSnapshot,
  type PmsReadSnapshot,
} from '../../services/platform/src/pmsAdapter.ts';

const ready = {
  provider: 'cloudbeds' as const,
  partnerAuthorizationConfirmed: true,
  apiAccessApproved: true,
  credentialsConfigured: true,
  externalPropertyId: 'test-property-id',
};
const fixture: PmsReadSnapshot = {
  provider: 'cloudbeds',
  externalPropertyId: 'test-property-id',
  fetchedAt: '2026-10-27T08:00:00.000Z',
  sourceUpdatedAt: '2026-10-27T07:55:00.000Z',
  mode: 'OBSERVATION_ONLY',
  roomTypes: [{ externalRoomTypeId: 'room-a', name: 'Synthetic room fixture', maxOccupancy: 2 }],
  ratePlans: [{
    externalRatePlanId: 'rate-a', roomTypeId: 'room-a', name: 'Synthetic rate fixture',
    currency: 'NGN', amountMinor: 25000000, refundable: true,
    cancellationPolicyText: 'Fixture only; not hotel-confirmed.',
  }],
  nightlyInventory: [{
    roomTypeId: 'room-a', ratePlanId: 'rate-a', date: '2026-11-01',
    availableRooms: 2, amountMinor: 25000000, currency: 'NGN',
    restrictions: { closedToArrival: false, closedToDeparture: false, minimumStayNights: 1, maximumStayNights: null },
  }],
};
function assertPmsError(code: string, operation: () => unknown): void {
  assert.throws(operation, (error: unknown) => error instanceof PmsAdapterError && error.code === code);
}

test('unconfirmed provider fails closed', () => {
  assertPmsError('PMS_PROVIDER_UNCONFIRMED', () => assertPmsConnectionReady({
    provider: 'unconfirmed', partnerAuthorizationConfirmed: false,
    apiAccessApproved: false, credentialsConfigured: false,
  }));
});
test('authorization, API access, credentials and property mapping are required', () => {
  assertPmsError('PMS_AUTHORIZATION_REQUIRED', () => assertPmsConnectionReady({ ...ready, partnerAuthorizationConfirmed: false }));
  assertPmsError('PMS_AUTHORIZATION_REQUIRED', () => assertPmsConnectionReady({ ...ready, apiAccessApproved: false }));
  assertPmsError('PMS_CREDENTIALS_NOT_CONFIGURED', () => assertPmsConnectionReady({ ...ready, credentialsConfigured: false }));
  assertPmsError('PMS_PROPERTY_MAPPING_REQUIRED', () => assertPmsConnectionReady({ ...ready, externalPropertyId: ' ' }));
});
test('factory does not claim a live provider adapter exists', () => {
  assertPmsError('PMS_ADAPTER_NOT_IMPLEMENTED', () => createReadOnlyPmsAdapter(ready));
});
test('only GET is permitted', () => {
  assert.equal(assertReadOnlyMethod('GET'), undefined);
  assert.equal(assertReadOnlyMethod('get'), undefined);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assertPmsError('PMS_READ_ONLY_VIOLATION', () => assertReadOnlyMethod(method));
  }
});
test('normalized snapshot validates but remains observation-only', () => {
  const snapshot = structuredClone(fixture);
  assert.equal(validatePmsSnapshot(snapshot), snapshot);
  assert.equal(snapshot.mode, 'OBSERVATION_ONLY');
});
test('snapshot rejects negative availability, invalid dates, orphan rates and duplicate nights', () => {
  const negative = structuredClone(fixture);
  negative.nightlyInventory[0]!.availableRooms = -1;
  assertPmsError('PMS_INVALID_SNAPSHOT', () => validatePmsSnapshot(negative));
  const invalidDate = structuredClone(fixture);
  invalidDate.nightlyInventory[0]!.date = '2026-02-31';
  assertPmsError('PMS_INVALID_SNAPSHOT', () => validatePmsSnapshot(invalidDate));
  const orphanRate = structuredClone(fixture);
  orphanRate.ratePlans[0]!.roomTypeId = 'unknown-room';
  assertPmsError('PMS_INVALID_SNAPSHOT', () => validatePmsSnapshot(orphanRate));
  const duplicateNight = structuredClone(fixture);
  duplicateNight.nightlyInventory.push(structuredClone(duplicateNight.nightlyInventory[0]!));
  assertPmsError('PMS_INVALID_SNAPSHOT', () => validatePmsSnapshot(duplicateNight));
});
test('unknown, stale and future inventory timestamps are not fresh', () => {
  const now = Date.parse('2026-10-27T08:00:00.000Z');
  assert.equal(inventoryFreshness(null, now), 'UNKNOWN');
  assert.equal(inventoryFreshness('2026-10-27T07:59:00.000Z', now), 'FRESH');
  assert.equal(inventoryFreshness('2026-10-27T07:00:00.000Z', now), 'STALE');
  assert.equal(inventoryFreshness('2026-10-27T08:01:00.000Z', now), 'STALE');
});

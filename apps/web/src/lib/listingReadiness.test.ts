import assert from 'node:assert/strict';
import test from 'node:test';
import type { BusinessListingReadiness, OfferingListingReadiness } from '@7even/contracts';
import { listingState, nextBusinessTask } from './listingReadiness.ts';

const offering: OfferingListingReadiness = {
  offeringId: 'room',
  title: 'Garden room',
  kind: 'STAY',
  city: 'Uyo',
  state: 'Akwa Ibom',
  published: true,
  eligible: true,
  managedInventory: true,
  blockers: [],
  warnings: [],
  inventory: { totalWindows: 3, currentWindows: 3, freshWindows: 3, availableWindows: 3 },
};
const base: BusinessListingReadiness = {
  businessId: 'hotel',
  businessName: 'Hotel',
  status: 'APPROVED',
  counts: { offerings: 1, published: 1, eligible: 1, blocked: 0 },
  blockers: [],
  offerings: [offering],
  offeringsLimit: 100,
  offeringsTruncated: false,
};
test('pending and suspended owners never receive a listing creation action', () => {
  for (const status of ['PENDING', 'SUSPENDED'] as const)
    assert.equal(
      nextBusinessTask({ status }, { ...base, counts: { ...base.counts, offerings: 0 } }).action,
      'details',
    );
  assert.equal(
    nextBusinessTask({ status: 'APPROVED' }, { ...base, counts: { ...base.counts, offerings: 0 } })
      .action,
    'add',
  );
});
test('unpublished, stale and unclassified listings point to the existing work they need', () => {
  assert.equal(
    nextBusinessTask(
      { status: 'APPROVED' },
      {
        ...base,
        offerings: [
          { ...offering, eligible: false, published: false, blockers: ['OFFERING_UNPUBLISHED'] },
        ],
      },
    ).action,
    'edit',
  );
  const stale = nextBusinessTask(
    { status: 'APPROVED' },
    { ...base, offerings: [{ ...offering, eligible: false, blockers: ['INVENTORY_STALE'] }] },
  );
  assert.equal(stale.action, 'availability');
  assert.equal(stale.offeringId, 'room');
  assert.equal(
    nextBusinessTask(
      { status: 'APPROVED' },
      { ...base, offerings: [{ ...offering, warnings: ['STATE_MISSING'] }] },
    ).action,
    'edit',
  );
  assert.equal(nextBusinessTask({ status: 'APPROVED' }, base).action, 'reception');
});
test('publication alone does not claim public visibility', () => {
  assert.deepEqual(listingState({ ...offering, eligible: false, blockers: ['INVENTORY_STALE'] }), {
    label: 'Needs attention',
    tone: 'attention',
  });
  assert.equal(listingState(offering).label, 'Meets search checks');
  assert.equal(listingState({ ...offering, published: false, eligible: false }).label, 'Draft');
  assert.equal(listingState(undefined).label, 'Checks not shown');
});
test('property and conflicting schedule issues do not promise a capacity update will resolve them', () => {
  for (const code of ['HOTEL_VERIFICATION_REQUIRED', 'INVENTORY_PROJECTION_LIMIT'] as const) {
    assert.equal(
      nextBusinessTask(
        { status: 'APPROVED' },
        { ...base, offerings: [{ ...offering, eligible: false, blockers: [code] }] },
      ).action,
      'details',
    );
  }
  assert.equal(
    nextBusinessTask(
      { status: 'APPROVED' },
      { ...base, offerings: [{ ...offering, eligible: false, blockers: ['INVENTORY_CONFLICT'] }] },
    ).action,
    'edit',
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { businessStatusInput } from '../src/index.ts';

const evidence = { confirmed: true, evidenceReference: 'owner-review:document-001' };
const diningVerification = {
  businessIdentity: evidence,
  ownerAuthority: evidence,
  physicalVenue: evidence,
  workingContact: evidence,
  ownerApprovedMenu: evidence,
  dishEvidence: evidence,
  currentPricesNgn: evidence,
  openingHours: evidence,
  serviceCapacityAndTerms: evidence,
  photoPermission: evidence,
};

test('Dining approval accepts the complete owner/evidence checklist', () => {
  const result = businessStatusInput.safeParse({
    status: 'APPROVED',
    reason: 'Dining evidence reviewed by an administrator',
    diningVerification,
  });
  assert.equal(result.success, true);
});

test('Dining approval rejects incomplete evidence', () => {
  const incomplete = { ...diningVerification };
  delete (incomplete as Partial<typeof diningVerification>).photoPermission;
  const result = businessStatusInput.safeParse({
    status: 'APPROVED',
    reason: 'Dining evidence reviewed by an administrator',
    diningVerification: incomplete,
  });
  assert.equal(result.success, false);
});

test('Dining approval rejects unconfirmed or missing evidence references', () => {
  const invalid = {
    ...diningVerification,
    currentPricesNgn: { confirmed: false, evidenceReference: '' },
  };
  const result = businessStatusInput.safeParse({
    status: 'APPROVED',
    reason: 'Dining evidence reviewed by an administrator',
    diningVerification: invalid,
  });
  assert.equal(result.success, false);
});

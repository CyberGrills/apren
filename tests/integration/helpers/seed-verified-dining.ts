import type { Pool } from 'pg';

/**
 * Marks seeded Dining businesses as owner-reviewed fixtures for integration tests.
 * This is test data only; it does not alter production seed or approval behavior.
 */
export async function seedVerifiedDining(pool: Pool): Promise<void> {
  const evidence = Object.fromEntries([
    'businessIdentity',
    'ownerAuthority',
    'physicalVenue',
    'workingContact',
    'ownerApprovedMenu',
    'dishEvidence',
    'currentPricesNgn',
    'openingHours',
    'serviceCapacityAndTerms',
    'photoPermission',
  ].map((key) => [key, {
    confirmed: true,
    evidenceReference: 'fixture:seeded-owner-reviewed-dining',
  }]));

  await pool.query(
    `UPDATE seven.businesses AS b
     SET details = COALESCE(b.details, '{}'::jsonb) ||
       jsonb_build_object(
         'diningVerificationReview',
         jsonb_build_object(
           'checklistVersion', '1',
           'evidence', $1::jsonb,
           'reviewedAt', now(),
           'reviewerId', (
             SELECT user_id FROM seven.users WHERE email='admin@seven.test' LIMIT 1
           )
         )
       )
     WHERE b.business_id IN (
       SELECT DISTINCT o.business_id
       FROM seven.offerings AS o
       JOIN seven.sectors AS s USING (sector_id)
       WHERE s.sector_code='DINING'
     )
       AND b.workflow_state_id=(
         SELECT workflow_state_id FROM seven.workflow_states
         WHERE workflow_state_code='APPROVED'
       )`,
    [JSON.stringify(evidence)],
  );
}

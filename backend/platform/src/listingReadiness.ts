import { findNigeriaState } from '@7even/contracts';
import type {
  BusinessListingReadiness,
  BusinessStatus,
  ListingCounts,
  ListingReadiness,
  OfferingListingReadiness,
  Sector,
} from '@7even/contracts';
import { one } from './db.ts';
import type { Connection } from './db.ts';

const businessLimit = 100;
const offeringsLimit = 100;

interface OfferingRow {
  offeringId: string;
  title: string;
  kind: Sector;
  city: string;
  state: string | null;
  published: boolean;
  eligible: boolean;
  verified: boolean;
  totalWindows: number;
  currentWindows: number;
  freshWindows: number;
  availableWindows: number;
  projectedAvailableWindows: number;
  eligibleDays: number;
}
interface BusinessRow {
  businessId: string;
  businessName: string;
  status: BusinessStatus;
  sector: Sector;
  verified: boolean;
  counts: ListingCounts;
  offerings: OfferingRow[];
}

function offeringReadiness(row: OfferingRow, approved: boolean): OfferingListingReadiness {
  const blockers: OfferingListingReadiness['blockers'] = [];
  if (!approved) blockers.push('BUSINESS_NOT_APPROVED');
  if (!row.published) blockers.push('OFFERING_UNPUBLISHED');
  const managedInventory = row.kind === 'STAY';
  if (managedInventory) {
    if (!row.verified) blockers.push('HOTEL_VERIFICATION_REQUIRED');
    if (!row.totalWindows) blockers.push('NO_INVENTORY');
    else if (!row.currentWindows) blockers.push('INVENTORY_EXPIRED');
    else if (!row.freshWindows) blockers.push('INVENTORY_STALE');
    else if (!row.availableWindows) blockers.push('INVENTORY_SOLD_OUT');
    else if (!row.projectedAvailableWindows) blockers.push('INVENTORY_PROJECTION_LIMIT');
    else if (!row.eligibleDays) blockers.push('INVENTORY_CONFLICT');
  }
  return {
    offeringId: row.offeringId,
    title: row.title,
    kind: row.kind,
    city: row.city,
    state: row.state,
    published: row.published,
    eligible: row.eligible,
    managedInventory,
    blockers,
    warnings: !row.state?.trim()
      ? ['STATE_MISSING']
      : findNigeriaState(row.state)?.name.toLowerCase() !== row.state.trim().toLowerCase()
        ? ['STATE_UNRECOGNIZED']
        : [],
    inventory: {
      totalWindows: row.totalWindows,
      currentWindows: row.currentWindows,
      freshWindows: row.freshWindows,
      availableWindows: row.availableWindows,
    },
  };
}

/** Same database snapshot for counts and bounded records; callers retain their existing role checks. */
export async function listingReadiness(
  db: Connection,
  options: { businessId?: string; production: boolean },
): Promise<ListingReadiness> {
  const snapshot = await one<{
    checkedAt: Date;
    totals: ListingReadiness['totals'];
    businesses: BusinessRow[];
  }>(db, `WITH scoped_businesses AS (
      SELECT b.business_id, b.business_name, b.created_at,
        ws.workflow_state_code AS status, COALESCE(b.details->>'sector', 'STAY') AS sector,
        (b.details #>> '{verificationReview,checklistVersion}' = '1'
          OR ($2::boolean = false AND b.details->>'isSample' = 'true')) IS TRUE AS verified,
        ($2::boolean = false AND b.details->>'isSample' = 'true') IS TRUE AS sample_bypass,
        CASE WHEN b.details #>> '{verificationReview,inventoryFreshnessHours}' ~ '^[0-9]{1,3}$'
          THEN (b.details #>> '{verificationReview,inventoryFreshnessHours}')::int
          ELSE 0 END AS freshness_hours
      FROM seven.businesses b
      JOIN seven.workflow_states ws USING(workflow_state_id)
      WHERE ($1::uuid IS NULL OR b.business_id=$1)
    ), projected_inventory AS (
      SELECT o.offering_id, w.starts_at, w.capacity, w.allocated_count,
        row_number() OVER (PARTITION BY o.offering_id ORDER BY w.starts_at) AS projection_rank
      FROM seven.inventory_windows w
      JOIN seven.offerings o USING(offering_id)
      JOIN scoped_businesses b USING(business_id)
      WHERE w.ends_at>now()
        AND (b.sample_bypass OR w.inventory_confirmed_at>now()-b.freshness_hours*interval '1 hour')
    ), available_days AS (
      SELECT w.offering_id, (w.starts_at AT TIME ZONE 'Africa/Lagos')::date AS service_date,
        count(*) AS available_windows
      FROM projected_inventory w
      WHERE w.projection_rank<=500
        AND (w.starts_at AT TIME ZONE 'Africa/Lagos')::date >= (now() AT TIME ZONE 'Africa/Lagos')::date
        AND w.capacity>w.allocated_count
      GROUP BY w.offering_id, (w.starts_at AT TIME ZONE 'Africa/Lagos')::date
    ), eligible_days AS (
      SELECT offering_id, count(*) FILTER (WHERE available_windows=1)::int AS eligible_days,
        sum(available_windows)::int AS projected_available_windows
      FROM available_days GROUP BY offering_id
    ), inventory AS (
      SELECT o.offering_id, count(w.inventory_window_id)::int AS total_windows,
        count(*) FILTER (WHERE w.ends_at>now()
          AND (w.starts_at AT TIME ZONE 'Africa/Lagos')::date >= (now() AT TIME ZONE 'Africa/Lagos')::date)::int AS current_windows,
        count(*) FILTER (WHERE w.ends_at>now()
          AND (w.starts_at AT TIME ZONE 'Africa/Lagos')::date >= (now() AT TIME ZONE 'Africa/Lagos')::date
          AND (b.sample_bypass OR w.inventory_confirmed_at>now()-b.freshness_hours*interval '1 hour'))::int AS fresh_windows,
        count(*) FILTER (WHERE w.ends_at>now()
          AND (w.starts_at AT TIME ZONE 'Africa/Lagos')::date >= (now() AT TIME ZONE 'Africa/Lagos')::date
          AND (b.sample_bypass OR w.inventory_confirmed_at>now()-b.freshness_hours*interval '1 hour')
          AND w.capacity>w.allocated_count)::int AS available_windows
      FROM seven.offerings o
      JOIN scoped_businesses b USING(business_id)
      LEFT JOIN seven.inventory_windows w USING(offering_id)
      GROUP BY o.offering_id
    ), evaluated AS (
      SELECT o.offering_id, o.business_id, o.title, o.city, o.details->>'state' AS state,
        o.is_published AS published, s.sector_code AS kind, b.verified,
        i.total_windows, i.current_windows, i.fresh_windows, i.available_windows,
        COALESCE(d.projected_available_windows,0) AS projected_available_windows,
        COALESCE(d.eligible_days,0) AS eligible_days,
        (b.status='APPROVED' AND o.is_published
          AND (s.sector_code<>'STAY' OR (b.verified AND COALESCE(d.eligible_days,0)>0))) AS eligible
      FROM seven.offerings o
      JOIN scoped_businesses b USING(business_id)
      JOIN seven.sectors s USING(sector_id)
      JOIN inventory i USING(offering_id)
      LEFT JOIN eligible_days d USING(offering_id)
    ), business_counts AS (
      SELECT b.business_id, count(e.offering_id)::int AS offerings,
        count(*) FILTER (WHERE e.published)::int AS published,
        count(*) FILTER (WHERE e.eligible)::int AS eligible,
        count(*) FILTER (WHERE e.eligible=false)::int AS blocked
      FROM scoped_businesses b LEFT JOIN evaluated e USING(business_id)
      GROUP BY b.business_id
    ), selected_businesses AS (
      SELECT b.*, c.offerings, c.published, c.eligible, c.blocked
      FROM scoped_businesses b JOIN business_counts c USING(business_id)
      ORDER BY b.created_at DESC, b.business_id LIMIT $3
    )
    SELECT now() AS "checkedAt",
      jsonb_build_object(
        'businesses', (SELECT count(*)::int FROM scoped_businesses),
        'offerings', (SELECT count(*)::int FROM evaluated),
        'published', (SELECT count(*)::int FROM evaluated WHERE published),
        'eligible', (SELECT count(*)::int FROM evaluated WHERE eligible),
        'blocked', (SELECT count(*)::int FROM evaluated WHERE eligible=false)
      ) AS totals,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'businessId', b.business_id, 'businessName', b.business_name, 'status', b.status,
        'sector', b.sector, 'verified', b.verified,
        'counts', jsonb_build_object('offerings', b.offerings, 'published', b.published,
          'eligible', b.eligible, 'blocked', b.blocked),
        'offerings', COALESCE((SELECT jsonb_agg(to_jsonb(detail)) FROM (
          SELECT e.offering_id AS "offeringId", e.title, e.kind, e.city, e.state,
            e.published, e.eligible, e.verified, e.total_windows AS "totalWindows",
            e.current_windows AS "currentWindows", e.fresh_windows AS "freshWindows",
            e.available_windows AS "availableWindows", e.eligible_days AS "eligibleDays",
            e.projected_available_windows AS "projectedAvailableWindows"
          FROM evaluated e WHERE e.business_id=b.business_id
          ORDER BY e.eligible, e.title, e.offering_id LIMIT $4
        ) detail), '[]'::jsonb)
      ) ORDER BY b.created_at DESC, b.business_id) FROM selected_businesses b), '[]'::jsonb) AS businesses`,
    [options.businessId ?? null, options.production, businessLimit, offeringsLimit]);
  if (!snapshot) throw new Error('Listing readiness query returned no database snapshot.');
  return {
    database: { status: 'connected', checkedAt: snapshot.checkedAt.toISOString() },
    totals: snapshot.totals,
    businesses: snapshot.businesses.map((business): BusinessListingReadiness => ({
      businessId: business.businessId,
      businessName: business.businessName,
      status: business.status,
      counts: business.counts,
      blockers: [
        ...(business.status === 'APPROVED' ? [] : ['BUSINESS_NOT_APPROVED'] as const),
        ...(business.sector !== 'STAY' || business.verified ? [] : ['HOTEL_VERIFICATION_REQUIRED'] as const),
        ...(business.counts.offerings ? [] : ['NO_OFFERINGS'] as const),
      ],
      offerings: business.offerings.map((offering) => offeringReadiness(offering, business.status === 'APPROVED')),
      offeringsLimit,
      offeringsTruncated: business.counts.offerings > offeringsLimit,
    })),
    businessLimit,
    businessesTruncated: snapshot.totals.businesses > businessLimit,
  };
}

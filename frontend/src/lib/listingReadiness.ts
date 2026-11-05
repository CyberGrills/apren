import type {
  Business,
  BusinessListingReadiness,
  ListingBlockerCode,
  ListingWarningCode,
  OfferingListingReadiness,
} from '@7even/contracts';

export const listingReasons: Record<
  ListingBlockerCode | ListingWarningCode | 'NO_OFFERINGS',
  string
> = {
  BUSINESS_NOT_APPROVED: 'Business approval required',
  OFFERING_UNPUBLISHED: 'Listing is still a draft',
  HOTEL_VERIFICATION_REQUIRED: 'Property verification required',
  NO_INVENTORY: 'No availability added',
  INVENTORY_EXPIRED: 'Availability dates have ended',
  INVENTORY_STALE: 'Availability needs reconfirming',
  INVENTORY_SOLD_OUT: 'No capacity remaining',
  INVENTORY_CONFLICT: 'Overlapping room availability needs review',
  INVENTORY_PROJECTION_LIMIT: 'Availability exceeds the search window limit',
  STATE_MISSING: 'Add a state for location searches',
  STATE_UNRECOGNIZED: 'Choose a recognised Nigerian state',
  NO_OFFERINGS: 'No places or services added',
};
export type WorkspaceTask = {
  title: string;
  description: string;
  label: string;
  action: 'details' | 'add' | 'edit' | 'availability' | 'reception' | 'listings';
  offeringId?: string;
};

export function nextBusinessTask(
  business: Pick<Business, 'status'>,
  readiness: BusinessListingReadiness,
): WorkspaceTask {
  if (business.status !== 'APPROVED')
    return {
      title:
        business.status === 'SUSPENDED'
          ? 'Your business is currently suspended.'
          : 'Your business is awaiting review.',
      description:
        business.status === 'SUSPENDED'
          ? 'Your listings cannot accept bookings while the business is suspended. Review your business details and contact the 7even team about the review.'
          : '7even must approve your business before you can add listings and accept bookings. You can review the details you submitted while the review is pending.',
      label: 'View business details',
      action: 'details',
    };
  if (readiness.blockers.includes('HOTEL_VERIFICATION_REQUIRED'))
    return {
      title: 'Your property needs verification.',
      description:
        '7even needs to finish the property review before this stay can appear in search. Review your business details and contact the team if anything has changed.',
      label: 'View business details',
      action: 'details',
    };
  if (!readiness.counts.offerings)
    return {
      title: 'Add your first place or service.',
      description:
        'Start with a room type, a dining offer or an experience. Add the details guests need, then set its availability.',
      label: 'Add a place',
      action: 'add',
    };
  const blocked = readiness.offerings.find((offering) => offering.blockers.length > 0);
  if (blocked) {
    if (blocked.blockers.includes('INVENTORY_PROJECTION_LIMIT'))
      return {
        title: 'Your availability needs a review.',
        description: `“${blocked.title}” has available dates outside the search window limit. Contact 7even to review its availability schedule.`,
        label: 'View business details',
        action: 'details',
      };
    if (blocked.blockers.includes('HOTEL_VERIFICATION_REQUIRED'))
      return {
        title: 'This stay needs property verification.',
        description: `“${blocked.title}” cannot appear in search until 7even completes the property review. Check your business details and contact the team.`,
        label: 'View business details',
        action: 'details',
      };
    if (blocked.blockers.includes('INVENTORY_CONFLICT'))
      return {
        title: 'Your room dates need a review.',
        description: `“${blocked.title}” has more than one availability window for the same date. Review the listing and contact 7even to correct overlapping windows.`,
        label: 'Review listing',
        action: 'edit',
        offeringId: blocked.offeringId,
      };
    if (blocked.blockers.includes('OFFERING_UNPUBLISHED'))
      return {
        title: 'Your next listing is still a draft.',
        description: `Review “${blocked.title}” and publish it when the details are ready. Availability must also pass the checks below.`,
        label: 'Review listing',
        action: 'edit',
        offeringId: blocked.offeringId,
      };
    return {
      title: blocked.blockers.includes('INVENTORY_STALE')
        ? 'Reconfirm your room availability.'
        : 'Set availability for your next guests.',
      description: `“${blocked.title}” needs attention before it can appear in search. ${blocked.blockers[0] ? listingReasons[blocked.blockers[0]] : 'Review the listing checks'}.`,
      label: 'Update availability',
      action: 'availability',
      offeringId: blocked.offeringId,
    };
  }
  if (readiness.counts.blocked > 0)
    return {
      title: 'Review the rest of your listings.',
      description: `${readiness.counts.blocked} listings need attention. Open your places and availability to review them.`,
      label: 'Review listings',
      action: 'listings',
    };
  const location = readiness.offerings.find((offering) => offering.warnings.length > 0);
  if (location)
    return {
      title: 'Help guests find your place.',
      description: `“${location.title}” needs a state saved for state and city searches. It can still appear when guests browse without a location filter.`,
      label: 'Add location details',
      action: 'edit',
      offeringId: location.offeringId,
    };
  return {
    title: 'Ready for your next guest.',
    description: `${readiness.counts.eligible} ${readiness.counts.eligible === 1 ? 'listing meets' : 'listings meet'} the current unfiltered search checks. Guest dates and room counts are checked again before booking. Manage arrivals at reception.`,
    label: 'Open reception',
    action: 'reception',
  };
}

export function listingState(offering: OfferingListingReadiness | undefined): {
  label: string;
  tone: 'ready' | 'attention' | 'draft';
} {
  if (!offering) return { label: 'Checks not shown', tone: 'draft' };
  if (offering.eligible) return { label: 'Meets search checks', tone: 'ready' };
  if (!offering.published) return { label: 'Draft', tone: 'draft' };
  return { label: 'Needs attention', tone: 'attention' };
}

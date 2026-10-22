import type { BusinessOverview, Offering, OfferingListingReadiness } from '@7even/contracts';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listingReasons, nextBusinessTask } from '../../lib/listingReadiness.ts';
import { ListingBadge } from './ListingReadiness.tsx';

export function ListingUpdateReceipt({
  offering,
  previous,
  refreshed,
}: {
  offering: Offering;
  previous?: OfferingListingReadiness;
  refreshed: BusinessOverview | null;
}) {
  const business = refreshed?.business;
  const readiness = refreshed?.listingReadiness.businesses.find(
    (item) => item.businessId === offering.businessId,
  );
  const current = readiness?.offerings.find((item) => item.offeringId === offering.id);
  const task = business && readiness ? nextBusinessTask(business, readiness) : null;
  return (
    <div className="listing-update-receipt">
      <p className="listing-receipt-title">
        <strong>{offering.title}</strong>
      </p>
      <section
        className="listing-receipt-transition"
        aria-label="Listing checks before and after saving"
      >
        <div>
          <span className="small-copy">Before</span>
          <ListingBadge offering={previous} />
        </div>
        <ArrowRight size={20} aria-hidden="true" />
        <div>
          <span className="small-copy">After save</span>
          <ListingBadge offering={current} />
        </div>
      </section>
      {refreshed === null ? (
        <p className="listing-receipt-warning">
          Your change was saved, but search checks could not be refreshed. Review them in your
          business workspace without saving again.
        </p>
      ) : current ? (
        <>
          <p className="small-copy">
            These checks cover search without state, city, date or room-count filters. They do not
            guarantee availability for a specific booking.
          </p>
          {current.blockers.length > 0 && (
            <div className="listing-receipt-checks">
              <strong>Still to resolve</strong>
              <ul>
                {current.blockers.map((code) => (
                  <li key={code}>{listingReasons[code]}</li>
                ))}
              </ul>
            </div>
          )}
          {current.warnings.length > 0 && (
            <div className="listing-receipt-checks">
              <strong>Location checks</strong>
              <ul>
                {current.warnings.map((code) => (
                  <li key={code}>{listingReasons[code]}</li>
                ))}
              </ul>
            </div>
          )}
          {current.blockers.length === 0 && current.warnings.length === 0 && (
            <p>This listing passes the current search checks.</p>
          )}
        </>
      ) : (
        <p className="listing-receipt-warning">
          Your change was saved. This listing’s individual checks are outside the returned detail
          list. Review the inventory summary in your business workspace.
        </p>
      )}
      <div className="listing-receipt-next">
        <p className="small-copy">Next step</p>
        <strong>{task?.label ?? 'Review your listing checks'}</strong>
        <Link className="text-button" to="/business">
          View next step
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

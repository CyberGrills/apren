import type {
  BusinessListingReadiness,
  OfferingListingReadiness,
  ListingReadiness as ReadinessReport,
} from '@7even/contracts';
import { ArrowUpRight, Check, ChevronRight, Database, MapPin, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listingReasons, listingState } from '../../lib/listingReadiness.ts';

export function CheckedDatabase({ report }: { report: ReadinessReport }) {
  return (
    <div className="database-check">
      <Database size={17} aria-hidden="true" />
      <span>
        <strong>Database responding</strong>
        <small>
          PostgreSQL checked{' '}
          {new Intl.DateTimeFormat('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Lagos',
          }).format(new Date(report.database.checkedAt))}{' '}
          WAT
        </small>
      </span>
      <Check size={15} aria-hidden="true" />
    </div>
  );
}
export function ListingBadge({ offering }: { offering?: OfferingListingReadiness }) {
  const state = listingState(offering);
  return (
    <span className={`listing-badge listing-badge-${state.tone}`}>
      <span aria-hidden="true" />
      {state.label}
    </span>
  );
}
export function ListingChecks({
  business,
  admin = false,
  onEdit,
  onAvailability,
}: {
  business: BusinessListingReadiness;
  admin?: boolean;
  onEdit?: (id: string) => void;
  onAvailability?: (id: string) => void;
}) {
  return (
    <div className="listing-checks">
      {business.offerings.length === 0 && (
        <div className="workspace-empty">
          <h3>No listings added yet.</h3>
          <p>
            {business.status === 'APPROVED'
              ? 'Add a room, dining offer or experience to begin.'
              : 'The business can add listings after approval.'}
          </p>
        </div>
      )}
      {business.offerings.map((offer) => (
        <article className="listing-check-row" key={offer.offeringId}>
          <div className="listing-check-name">
            <span className="workbench-kicker">
              {offer.kind === 'STAY' ? 'Stay' : offer.kind === 'DINING' ? 'Dining' : 'Experience'}
            </span>
            <h3>{offer.title}</h3>
            <p>
              <MapPin size={13} aria-hidden="true" />
              {offer.city}
              {offer.state ? `, ${offer.state}` : ''}
            </p>
          </div>
          <div className="listing-check-evidence">
            <ListingBadge offering={offer} />
            {offer.blockers.length > 0 && (
              <ul>
                {offer.blockers.map((code) => (
                  <li key={code}>{listingReasons[code]}</li>
                ))}
              </ul>
            )}
            {offer.warnings.length > 0 && (
              <ul className="listing-warnings">
                {offer.warnings.map((code) => (
                  <li key={code}>{listingReasons[code]}</li>
                ))}
              </ul>
            )}
            {offer.managedInventory && (
              <p>
                {offer.inventory.availableWindows} current service{' '}
                {offer.inventory.availableWindows === 1 ? 'window' : 'windows'} with fresh
                confirmation and capacity
              </p>
            )}
          </div>
          {!admin && (
            <div className="listing-check-actions">
              {onEdit && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onEdit(offer.offeringId)}
                >
                  Edit details <ChevronRight size={15} aria-hidden="true" />
                </button>
              )}
              {onAvailability && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onAvailability(offer.offeringId)}
                >
                  Availability <ChevronRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {business.offeringsTruncated && (
        <p className="small-copy">
          Showing {business.offerings.length} of {business.counts.offerings} listings. Counts
          include every listing for this business.
        </p>
      )}
    </div>
  );
}
export function AdminInventorySummary({ report }: { report: ReadinessReport }) {
  const totals = report.totals;
  return (
    <section className="operations-hero" aria-labelledby="inventory-health-title">
      <div>
        <p className="workbench-kicker">Marketplace readiness</p>
        <h2 id="inventory-health-title">
          {totals.eligible === 0
            ? 'No listings are visible in search.'
            : totals.blocked === 0
              ? 'Your listings meet the search checks.'
              : `${totals.blocked} ${totals.blocked === 1 ? 'listing needs' : 'listings need'} attention.`}
        </h2>
        <p>
          {totals.eligible === 0
            ? 'The database is responding. Check business approval, publication and room availability to see what is holding each listing back.'
            : `${totals.eligible} listings currently meet the unfiltered search checks. Review blocked listings and keep room availability current.`}
        </p>
        <Link to="/admin/inventory" className="btn btn-primary">
          Inspect listings <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <aside className="operations-evidence">
        <CheckedDatabase report={report} />
        <dl>
          <div>
            <dt>Businesses</dt>
            <dd>{totals.businesses}</dd>
          </div>
          <div>
            <dt>Listings added</dt>
            <dd>{totals.offerings}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>{totals.published}</dd>
          </div>
          <div>
            <dt>Visible in search</dt>
            <dd>{totals.eligible}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
export function InventoryBusinessList({ report }: { report: ReadinessReport }) {
  return (
    <section
      className="table-wrap workbench-table"
      data-scrolls
      aria-label="Business listing readiness"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the wide data table.
      tabIndex={0}
    >
      <p className="table-scroll-cue">Scroll table to inspect each business →</p>
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Approval</th>
            <th>Listings</th>
            <th>Published</th>
            <th>Visible</th>
            <th>Next step</th>
          </tr>
        </thead>
        <tbody>
          {report.businesses.map((business) => (
            <tr key={business.businessId}>
              <td>
                <strong>{business.businessName}</strong>
                <small>{business.counts.blocked} listings need attention</small>
              </td>
              <td>{business.status.toLowerCase()}</td>
              <td>{business.counts.offerings}</td>
              <td>{business.counts.published}</td>
              <td>{business.counts.eligible}</td>
              <td>
                <Link
                  className="text-button"
                  to={`/admin/inventory?businessId=${encodeURIComponent(business.businessId)}`}
                >
                  Inspect <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
          {report.businesses.length === 0 && (
            <tr>
              <td colSpan={6}>No businesses match this view.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
export function ReadinessRefresh({ checkedAt, reload }: { checkedAt: string; reload: () => void }) {
  return (
    <div className="readiness-footnote">
      <p>
        Unfiltered search checks updated{' '}
        {new Intl.DateTimeFormat('en-NG', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Lagos',
        }).format(new Date(checkedAt))}{' '}
        WAT. Dates, room counts and prices are checked again before booking.
      </p>
      <button type="button" className="text-button" onClick={reload}>
        <RefreshCw size={14} aria-hidden="true" /> Refresh checks
      </button>
    </div>
  );
}

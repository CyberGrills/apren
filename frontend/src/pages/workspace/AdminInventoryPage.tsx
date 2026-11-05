import type { ListingReadiness } from '@7even/contracts';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, PageHeader, StatusBadge } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { listingReasons } from '../../lib/listingReadiness.ts';
import {
  CheckedDatabase,
  InventoryBusinessList,
  ListingChecks,
  ReadinessRefresh,
} from './ListingReadiness.tsx';

export function AdminInventoryPage() {
  const [params] = useSearchParams();
  const businessId = params.get('businessId');
  const path =
    businessId === null
      ? '/admin/listing-readiness'
      : `/admin/listing-readiness?businessId=${encodeURIComponent(businessId)}`;
  const { data, loading, error, reload } = useApi<ListingReadiness>(path);
  const business = data?.businesses.find(
    (item) => item.businessId.toLowerCase() === businessId?.toLowerCase(),
  );
  return (
    <>
      <PageHeader
        eyebrow="Platform inventory"
        title={business ? business.businessName : 'Listing checks'}
        description={
          businessId === null
            ? 'Follow each listing from business approval to current availability.'
            : 'Check publication, property verification and current availability for this business.'
        }
        actions={
          businessId !== null ? (
            <Link className="btn btn-secondary" to="/admin/inventory">
              <ArrowLeft size={15} aria-hidden="true" /> All businesses
            </Link>
          ) : (
            <Link className="btn btn-secondary" to="/admin/businesses">
              Find a business <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )
        }
      />
      {loading && !data && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {!loading && !data && error && (
        <EmptyState
          title="Listing checks are unavailable."
          description="Refresh the checks to try again. You can return to all businesses if the link is no longer valid."
          action={
            <button type="button" className="btn btn-secondary" onClick={reload}>
              Refresh checks
            </button>
          }
        />
      )}
      {data && (
        <>
          <section className="operations-hero" aria-labelledby="inventory-report-title">
            <div>
              <span className="workbench-kicker">
                {businessId === null ? 'Marketplace availability' : 'Business availability'}
              </span>
              <h2 id="inventory-report-title">
                {data.totals.eligible === 0
                  ? 'No listings currently pass search checks.'
                  : `${data.totals.eligible.toLocaleString('en-NG')} ${data.totals.eligible === 1 ? 'listing passes' : 'listings pass'} search checks.`}
              </h2>
              <p>
                These checks cover search without dates, room counts or location filters. A guest’s
                selected dates and capacity are checked again before booking.
              </p>
              {business && <StatusBadge status={business.status} />}
            </div>
            <aside className="operations-evidence">
              <CheckedDatabase report={data} />
              <dl>
                <div>
                  <dt>Businesses</dt>
                  <dd>{data.totals.businesses.toLocaleString('en-NG')}</dd>
                </div>
                <div>
                  <dt>Listings added</dt>
                  <dd>{data.totals.offerings.toLocaleString('en-NG')}</dd>
                </div>
                <div>
                  <dt>Published</dt>
                  <dd>{data.totals.published.toLocaleString('en-NG')}</dd>
                </div>
                <div>
                  <dt>Visible in search</dt>
                  <dd>{data.totals.eligible.toLocaleString('en-NG')}</dd>
                </div>
                <div>
                  <dt>Needs attention</dt>
                  <dd>{data.totals.blocked.toLocaleString('en-NG')}</dd>
                </div>
              </dl>
            </aside>
          </section>
          {businessId === null ? (
            <section className="workbench-section" aria-labelledby="inventory-businesses-title">
              <div className="section-heading">
                <div>
                  <span className="workbench-kicker">By business</span>
                  <h2 id="inventory-businesses-title">Where listings stand</h2>
                </div>
                <p className="small-copy">
                  Showing {data.businesses.length.toLocaleString('en-NG')} of{' '}
                  {data.totals.businesses.toLocaleString('en-NG')} businesses.
                  {data.businessesTruncated &&
                    ` Details show the latest ${data.businessLimit} businesses; totals include every business.`}
                </p>
              </div>
              <InventoryBusinessList report={data} />
              {data.businessesTruncated && (
                <p className="small-copy">
                  Find an older business in{' '}
                  <Link className="text-button" to="/admin/businesses">
                    business records
                  </Link>
                  , then open its listing checks.
                </p>
              )}
            </section>
          ) : business ? (
            <section className="workbench-section" aria-labelledby="inventory-listings-title">
              <div className="section-heading">
                <div>
                  <span className="workbench-kicker">Listing detail</span>
                  <h2 id="inventory-listings-title">What needs attention</h2>
                </div>
                <p className="small-copy">
                  Showing {business.offerings.length.toLocaleString('en-NG')} of{' '}
                  {business.counts.offerings.toLocaleString('en-NG')} listing checks.
                  {business.offeringsTruncated &&
                    ` Details are limited to ${business.offeringsLimit} listings, with blocked listings first. Counts include all listings.`}
                </p>
              </div>
              {business.blockers.length > 0 && (
                <ul className="listing-warnings" aria-label="Business checks">
                  {business.blockers.map((code) => (
                    <li key={code}>{listingReasons[code]}</li>
                  ))}
                </ul>
              )}
              <ListingChecks business={business} admin />
            </section>
          ) : (
            <EmptyState
              title="Business not found."
              description="This link does not match a business in the database."
              action={
                <Link className="btn btn-secondary" to="/admin/inventory">
                  View all businesses
                </Link>
              }
            />
          )}
          <ReadinessRefresh checkedAt={data.database.checkedAt} reload={reload} />
        </>
      )}
    </>
  );
}

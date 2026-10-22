import type { AdminOverview, Business } from '@7even/contracts';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminInventorySummary } from './ListingReadiness.tsx';
import { ActivityList, dateLabel, MetricsStrip } from './shared.tsx';

export function AdminWorkspaceOverview({
  data,
  onReview,
}: {
  data: AdminOverview;
  onReview: (business: Business) => void;
}) {
  const pending = data.businesses.filter((business) => business.status === 'PENDING');
  return (
    <>
      <AdminInventorySummary report={data.listingReadiness} />
      <section className="workbench-section" aria-labelledby="admin-exception-title">
        <div className="section-heading">
          <div>
            <p className="workbench-kicker">Investigation queue</p>
            <h2 id="admin-exception-title">Unresolved exceptions</h2>
          </div>
          <span className="tag">{data.exceptionsSummary.total} records</span>
        </div>
        <div className="exception-queue">
          {data.exceptions.slice(0, 8).map((exception) => (
            <article className="exception-item" key={exception.id}>
              <div>
                <strong>{exception.kind.toLowerCase().replaceAll('_', ' ')}</strong>
                <p>{exception.message}</p>
                <small>{dateLabel(exception.createdAt)}</small>
              </div>
              <Link
                className="text-button"
                to={exception.kind === 'PROVIDER_EVENT' ? '/admin/operations' : '/admin/payments'}
              >
                Inspect <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </article>
          ))}
          {data.exceptions.length === 0 && (
            <div className="workspace-empty">
              <h3>No unresolved exceptions.</h3>
              <p>
                Payment, refund, provider event and settlement checks will appear here when they
                need review.
              </p>
            </div>
          )}
        </div>
        {data.exceptionsSummary.total > 8 && (
          <p className="small-copy">
            Showing {Math.min(8, data.exceptions.length)} of {data.exceptionsSummary.total}{' '}
            unresolved records. <Link to="/admin/payments">Open the payment queue</Link> for more
            detail.
          </p>
        )}
      </section>
      <section className="workbench-section" aria-labelledby="admin-application-title">
        <div className="section-heading">
          <div>
            <p className="workbench-kicker">Partner onboarding</p>
            <h2 id="admin-application-title">Business applications</h2>
          </div>
          <Link className="text-button" to="/admin/businesses">
            All businesses <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="operations-applications">
          {pending.slice(0, 3).map((business) => (
            <article className="operations-application" key={business.id}>
              <h3>{business.businessName}</h3>
              <p>
                {business.city} ·{' '}
                {business.sector === 'STAY'
                  ? 'Stays'
                  : business.sector === 'DINING'
                    ? 'Dining'
                    : 'Experiences'}
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => onReview(business)}
              >
                Review application <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
        {pending.length === 0 && (
          <p className="small-copy">
            No pending applications in this overview. Search all businesses to review older records.
          </p>
        )}
        {pending.length > 3 && (
          <p className="small-copy">
            Showing 3 pending applications from this overview. Open all businesses to search the
            complete register.
          </p>
        )}
      </section>
      <section className="workbench-section">
        <div className="section-heading">
          <h2>Platform activity</h2>
          <Link className="text-button" to="/admin/payments">
            Payments & settlement <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <MetricsStrip metrics={data.metrics} admin />
      </section>
      <section className="workbench-section">
        <div className="section-heading">
          <h2>Activity log</h2>
          <Link className="text-button" to="/admin/audit">
            Search all activity <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <ActivityList items={data.activity.slice(0, 5)} />
      </section>
    </>
  );
}

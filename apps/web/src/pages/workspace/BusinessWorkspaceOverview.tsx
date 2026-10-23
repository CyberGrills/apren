import type { BusinessOverview } from '@7even/contracts';
import { ArrowUpRight, Check, ChevronRight, ClipboardList, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.ts';
import { PageHeader } from '../../components/ui.tsx';
import { nextBusinessTask } from '../../lib/listingReadiness.ts';
import { ListingChecks, ReadinessRefresh } from './ListingReadiness.tsx';
import {
  ActivityList,
  MetricsStrip,
  type ReservationCommand,
  ReservationTable,
} from './shared.tsx';

function BookingRecoveryPanel() {
  const { data, loading, error, reload } = useApi<{
    abandoned_sessions: number;
    consented_abandons: number;
    confirmed_after_abandon: number;
    unresolved_abandons: number;
    reasons: Array<{ reason: string | null; sessions: number }>;
  }>('/business/recovery/summary');

  return (
    <section className="workbench-section" aria-labelledby="booking-recovery-title">
      <div className="section-heading">
        <div>
          <p className="workbench-kicker">Revenue recovery · pilot</p>
          <h2 id="booking-recovery-title">Booking opportunities</h2>
        </div>
        <button type="button" className="text-button" onClick={reload} disabled={loading}>
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="small-copy" role="status">Loading recovery activity…</p>
      ) : error ? (
        <p className="small-copy" role="status">Recovery activity is not available yet.</p>
      ) : (
        <>
          <MetricsStrip metrics={[
            { label: 'Abandoned sessions', value: String(data?.abandoned_sessions ?? 0) },
            { label: 'Consent recorded', value: String(data?.consented_abandons ?? 0) },
            { label: 'Unresolved sessions', value: String(data?.unresolved_abandons ?? 0) },
          ]} />
          <p className="small-copy">
            Funnel telemetry only. A booking is not counted as recovered until its reservation,
            payment and cancellation outcome can be verified against server records.
          </p>
          {data?.reasons?.length ? (
            <ul className="business-recovery-reasons">
              {data.reasons.map((item) => (
                <li key={item.reason ?? 'UNKNOWN'}>
                  <span>{item.reason ?? 'Unclassified'}</span>
                  <strong>{item.sessions}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small-copy">No eligible booking-funnel events recorded yet.</p>
          )}
        </>
      )}
    </section>
  );
}

export function BusinessWorkspaceOverview({
  data,
  onAdd,
  onEdit,
  onAvailability,
  onAction,
  reload,
}: {
  data: BusinessOverview;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onAvailability: (id: string) => void;
  onAction: (command: ReservationCommand) => void;
  reload: () => void;
}) {
  const business = data.business;
  const readiness = data.listingReadiness.businesses.find(
    (item) => item.businessId === business?.id,
  );
  if (!business || !readiness)
    return (
      <div className="workspace-empty">
        <h1>Your business workspace</h1>
        <p>We could not load the business checks. Refresh to try again.</p>
        <button type="button" className="btn btn-primary" onClick={reload}>
          Refresh workspace
        </button>
      </div>
    );
  const task = nextBusinessTask(business, readiness);
  const photo = data.offerings.find((offering) => offering.images[0]);
  const cta =
    task.action === 'details' ? (
      <Link className="btn btn-primary" to="/business/settings">
        {task.label} <ChevronRight size={16} aria-hidden="true" />
      </Link>
    ) : task.action === 'reception' ? (
      <Link className="btn btn-primary" to="/reception">
        {task.label} <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    ) : task.action === 'listings' ? (
      <Link className="btn btn-primary" to="/business/offerings">
        {task.label} <ChevronRight size={16} aria-hidden="true" />
      </Link>
    ) : (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() =>
          task.action === 'add'
            ? onAdd()
            : task.action === 'availability' && task.offeringId
              ? onAvailability(task.offeringId)
              : task.offeringId
                ? onEdit(task.offeringId)
                : undefined
        }
      >
        {task.label} <ChevronRight size={16} aria-hidden="true" />
      </button>
    );
  return (
    <>
      <PageHeader
        eyebrow="Business workspace"
        title={business.businessName}
        description={`${business.city}${business.state ? `, ${business.state}` : ''} · ${business.sector === 'STAY' ? 'Stays' : business.sector === 'DINING' ? 'Dining' : 'Experiences'}`}
        actions={
          <Link to="/business/reservations" className="btn btn-secondary">
            View reservations <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        }
      />
      <section className="business-task-hero" aria-labelledby="business-next-task">
        <div className="business-task-copy">
          <p className="workbench-kicker">
            {business.status !== 'APPROVED'
              ? 'Business review'
              : readiness.counts.blocked > 0
                ? 'Your next step'
                : readiness.counts.offerings === 0
                  ? 'Start with one place'
                  : 'Your working day'}
          </p>
          <h2 id="business-next-task">{task.title}</h2>
          <p>{task.description}</p>
          {cta}
        </div>
        {photo ? (
          <figure className="business-task-photo">
            <img
              src={photo.images[0]}
              alt={photo.isSample ? 'Illustrative photo for a local sample listing.' : photo.title}
            />
            <figcaption>
              {photo.isSample ? 'Local sample · ' : ''}
              {photo.title}
            </figcaption>
          </figure>
        ) : (
          <div className="business-task-mark" aria-hidden="true">
            <ClipboardList size={66} strokeWidth={1} />
            <span>
              {business.status === 'APPROVED' ? 'Business approved' : 'Review in progress'}
            </span>
            <i>
              {business.status === 'APPROVED' ? <Check size={17} /> : <Clock3 size={17} />}
            </i>
          </div>
        )}
      </section>
      <section className="workbench-section" aria-labelledby="business-listing-checks">
        <div className="section-heading">
          <div>
            <p className="workbench-kicker">Prepare for guests</p>
            <h2 id="business-listing-checks">Your listing checks</h2>
          </div>
          <Link to="/business/offerings" className="text-button">
            All places <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <ListingChecks
          business={readiness}
          onEdit={business.status === 'APPROVED' ? onEdit : undefined}
          onAvailability={business.status === 'APPROVED' ? onAvailability : undefined}
        />
        <ReadinessRefresh checkedAt={data.listingReadiness.database.checkedAt} reload={reload} />
      </section>
      <section className="workbench-section">
        <div className="section-heading">
          <h2>Your trading activity</h2>
          <span className="small-copy">Recorded in 7even</span>
        </div>
        <MetricsStrip metrics={data.metrics} />
      </section>
      {business.sector === 'STAY' && <BookingRecoveryPanel />}
      <section className="workbench-section">
        <div className="section-heading">
          <h2>Reservations</h2>
          <Link to="/business/reservations" className="text-button">
            View all <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <ReservationTable reservations={data.reservations.slice(0, 8)} onAction={onAction} />
      </section>
      <section className="workbench-section">
        <div className="section-heading">
          <h2>Activity</h2>
          <Link to="/business/settings" className="text-button">
            Business details <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <ActivityList items={data.activity.slice(0, 6)} />
      </section>
    </>
  );
}

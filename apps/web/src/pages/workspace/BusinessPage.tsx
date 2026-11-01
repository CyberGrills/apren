import { useFeedback } from '../../components/Feedback.tsx';
import type { BusinessOverview, Offering, Reward, SessionUser, Venue } from '@7even/contracts';
import { majorToMinor } from '@7even/engine';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Money,
  PageHeader,
  StatusBadge,
} from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import {
  ActivityList,
  dateLabel,
  MetricsStrip,
  ReservationActionDialog,
  ReservationTable,
  type ReservationCommand,
} from './shared.tsx';

type Tab = 'overview' | 'reservations' | 'offerings' | 'demand' | 'rewards' | 'team' | 'settings';
type Editor =
  | { kind: 'offering'; offering?: Offering }
  | { kind: 'availability'; offering: Offering }
  | { kind: 'reward' }
  | { kind: 'staff' }
  | { kind: 'revoke'; staff: SessionUser };
const titles: Record<Tab, string> = {
  overview: 'A good day starts here.',
  reservations: 'Every plan, in one place.',
  offerings: 'The places you run.',
  demand: 'Know what’s moving.',
  rewards: 'Give them a reason to return.',
  team: 'The people behind it.',
  settings: 'Your business on 7even.',
};
export function BusinessPage({ tab = 'overview' }: { tab?: Tab }) {
  const { user } = useSession();
  const { data, loading, error, reload } = useApi<BusinessOverview>('/business/overview');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [command, setCommand] = useState<ReservationCommand | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const owner = user?.role === 'BUSINESS_OWNER';
  const reservations =
    data?.reservations.filter(
      (r) =>
        (!status || r.status === status) &&
        `${r.customerName} ${r.reference} ${r.title}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <PageHeader
        eyebrow={data?.business?.businessName ?? 'Your business'}
        title={titles[tab]}
        description={
          tab === 'overview'
            ? 'Reservations, payments and the next arrival. Kept together as your day moves.'
            : tab === 'demand'
              ? 'Measured activity from 7even, with the period and evidence beside every suggestion.'
              : undefined
        }
        actions={
          owner && ['offerings', 'rewards', 'team'].includes(tab) ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                setEditor({
                  kind: tab === 'offerings' ? 'offering' : tab === 'rewards' ? 'reward' : 'staff',
                })
              }
            >
              <Plus size={16} />
              {tab === 'offerings'
                ? 'Add a place'
                : tab === 'rewards'
                  ? 'Create a reward'
                  : 'Add a team member'}
            </button>
          ) : (
            <Link to="/reception" className="btn btn-secondary">
              Open reception <ArrowUpRight size={16} />
            </Link>
          )
        }
      />
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {data && (
        <>
          {data.business?.status !== 'APPROVED' && (
            <div className="notice">
              Your business is {data.business?.status.toLowerCase() ?? 'awaiting setup'}. Publishing
              and checkout require an approved business.
            </div>
          )}
          {tab === 'overview' && (
            <>
              <MetricsStrip metrics={data.metrics} />
              <section className="panel demo-dashboard-promo"><div><span className="public-eyebrow">Guest experience preview</span><h2>See the 7EVEN demo property catalogue</h2><p className="small-copy">Explore fictional listing layouts and illustrative photography. Your real business profile and live inventory remain separate.</p></div><Link className="btn btn-secondary" to="/demo/hotels">Preview catalogue</Link></section>
              <div className="section-heading">
                <h2>Latest reservations</h2>
                <Link to="/business/reservations" className="text-button">
                  See all
                </Link>
              </div>
              <ReservationTable
                reservations={data.reservations.slice(0, 8)}
                onAction={setCommand}
              />
              <section className="workspace-section two-column">
                <div>
                  <div className="section-heading">
                    <h2>At a glance</h2>
                  </div>
                  <div className="panel">
                    <p>
                      {data.offerings.length} places on 7even, with {data.metrics.availableCapacity}{' '}
                      units of future capacity.
                    </p>
                    <p className="small-copy">
                      Capacity updates when a hold is accepted, released or converted. A payment
                      notification alone does not establish bank settlement.
                    </p>
                    <Link to="/business/offerings" className="text-button">
                      Manage availability
                    </Link>
                  </div>
                </div>
                <div>
                  <div className="section-heading">
                    <h2>Recent activity</h2>
                  </div>
                  <ActivityList items={data.activity.slice(0, 6)} />
                </div>
              </section>
            </>
          )}
          {tab === 'reservations' && (
            <>
              <div className="toolbar">
                <input
                  aria-label="Search reservations"
                  placeholder="Guest, reference or place"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Reservation status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {[
                    'HELD',
                    'CONFIRMED',
                    'CHECKED_IN',
                    'FULFILLED',
                    'CANCELLED',
                    'EXPIRED',
                    'PAYMENT_REVIEW',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s.toLowerCase().replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <ReservationTable reservations={reservations} onAction={setCommand} />
            </>
          )}
          {tab === 'offerings' &&
            (data.offerings.length ? (
              <div className="work-offering-grid">
                {data.offerings.map((offer) => (
                  <article className="work-offering" key={offer.id}>
                    {offer.images[0] && <img src={offer.images[0]} alt="" loading="lazy" />}
                    <div className="work-offering-copy">
                      <div className="work-offering-meta">
                        <span className="eyebrow">{offer.kind.toLowerCase()}</span>
                        <StatusBadge status={offer.published ? 'PUBLISHED' : 'DRAFT'} />
                      </div>
                      <h2>{offer.title}</h2>
                      <p className="small-copy">
                        {offer.city} · <Money minor={offer.priceMinor} /> / {offer.unitLabel}
                      </p>
                      <p className="small-copy">
                        {offer.windows.reduce((sum, w) => sum + w.remaining, 0)} available across{' '}
                        {offer.windows.length} service windows
                      </p>
                      {owner && (
                        <div className="work-offering-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => setEditor({ kind: 'availability', offering: offer })}
                          >
                            Availability
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => setEditor({ kind: 'offering', offering: offer })}
                          >
                            Edit details
                          </button>
                        </div>
                      )}
                      <div className="availability-calendar">
                        {offer.windows.slice(0, 7).map((w) => (
                          <div className="availability-day" key={w.id}>
                            {dateLabel(w.serviceDate).slice(0, 6)}
                            <strong>
                              {w.remaining}/{w.capacity}
                            </strong>
                            available
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Your first place belongs here."
                description="Add a room type, dining offer or experience, then publish its availability."
              />
            ))}
          {tab === 'demand' && (
            <>
              {data.demand.length === 0 && (
                <EmptyState
                  title="A little history goes a long way."
                  description="Add a place and collect real activity to see demand evidence here."
                />
              )}
              {data.demand.map(({ offeringId, title, assessment: a }) => (
                <article key={offeringId} className="demand-card">
                  <div>
                    <p className="eyebrow">{a.policyVersion}</p>
                    <h2>{title}</h2>
                    <StatusBadge status={a.status} />
                    <p className="small-copy">
                      {a.goal} · {a.period.start ? dateLabel(a.period.start) : 'No recorded start'}{' '}
                      to {dateLabel(a.period.end)}
                    </p>
                    <div className="demand-evidence">
                      {Object.entries(a.evidence).map(([key, value]) => (
                        <div key={key}>
                          <strong>
                            {key.endsWith('Bps') ? `${(value / 100).toFixed(1)}%` : value}
                          </strong>
                          {key.replaceAll('Bps', '').replaceAll('_', ' ')}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    {a.reasons.map((reason) => (
                      <p key={reason} className="small-copy">
                        {reason}
                      </p>
                    ))}
                    {a.recommendations.map((r) => (
                      <div className="recommendation" key={r.action}>
                        <h3>{r.title}</h3>
                        <p>{r.reason}</p>
                        <small className="muted">
                          Business review required before a commercial change.
                        </small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </>
          )}
          {tab === 'rewards' && (
            <>
              <p className="notice">
                Your business funds each reward it publishes. Points have no universal cash value.
                Only benefits marked transferable can be gifted or exchanged.
              </p>
              {data.rewards.length ? (
                <div className="work-offering-grid">
                  {data.rewards.map((reward) => (
                    <RewardCard key={reward.id} reward={reward} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Make the next visit count."
                  description="Publish a benefit with a points cost, capacity and a clear expiry."
                />
              )}
            </>
          )}
          {tab === 'team' && (
            <>
              <p className="small-copy">
                Reception accounts can run their assigned desk. Business owners control publishing,
                team access and commercial terms.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Access</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staff.map((staff) => (
                      <tr key={staff.id}>
                        <td>
                          <strong>{staff.displayName}</strong>
                        </td>
                        <td>{staff.email}</td>
                        <td>
                          <StatusBadge status={staff.role} />
                        </td>
                        <td>
                          {owner && staff.role === 'RECEPTION' && (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setEditor({ kind: 'revoke', staff })}
                            >
                              Remove access
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === 'settings' && data.business && (
            <div className="two-column">
              <div className="panel">
                <h2>{data.business.businessName}</h2>
                <p>{data.business.description}</p>
                <dl className="settings-summary">
                  <div>
                    <dt>Address</dt>
                    <dd>
                      {data.business.address}, {data.business.city}
                    </dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{data.business.phone}</dd>
                  </div>
                  <div>
                    <dt>Business status</dt>
                    <dd>
                      <StatusBadge status={data.business.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Bank subaccount</dt>
                    <dd>
                      {data.business.subaccountConfigured
                        ? data.business.accountLabel
                        : 'Awaiting verification'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="panel">
                <h2>Payment terms</h2>
                <p>
                  7even earns 10% of the service price after discounts, before separately stated
                  taxes.
                </p>
                <p className="small-copy">
                  Flutterwave’s actual processing fee comes from the business share. Customers see
                  the full price before reserving. Provider records establish settlement to the
                  bank.
                </p>
                <p className="small-copy">
                  Bank mapping is reviewed by 7even before live checkout is available.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {editor && data && (
        <BusinessEditor
          editor={editor}
          data={data}
          onClose={() => setEditor(null)}
          onDone={reload}
        />
      )}
      {command && (
        <ReservationActionDialog
          command={command}
          onClose={() => setCommand(null)}
          onDone={reload}
        />
      )}
    </>
  );
}
function RewardCard({ reward }: { reward: Reward }) {
  return (
    <article className="panel">
      <StatusBadge status={reward.published ? 'PUBLISHED' : 'DRAFT'} />
      <h2>{reward.title}</h2>
      <p className="small-copy">{reward.description}</p>
      <strong>{reward.pointsCost.toLocaleString('en-NG')} points</strong>
      <p className="small-copy">
        {reward.remaining} of {reward.capacity} remaining · expires {dateLabel(reward.expiresAt)}
        <br />
        {reward.transferable ? 'Transferable benefit' : 'For the redeeming guest'}
      </p>
    </article>
  );
}
function BusinessEditor({
  editor,
  data,
  onClose,
  onDone,
}: {
  editor: Editor;
  data: BusinessOverview;
  onClose: () => void;
  onDone: () => void;
}) {
  const needsVenues = editor.kind === 'offering';
  const {
    data: venues,
    loading: venuesLoading,
    error: venuesError,
    reload: reloadVenues,
  } = useApi<Venue[]>(needsVenues ? '/business/venues' : null);
  const venuesUnavailable = needsVenues && (venuesLoading || !!venuesError || !venues?.length);
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(crypto.randomUUID());
  const offer = editor.kind === 'offering' ? editor.offering : undefined;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (venuesUnavailable) return;
    const f = new FormData(event.currentTarget);
    const get = (name: string) => String(f.get(name) ?? '').trim();
    const integer = (name: string) => Number(get(name));
    setBusy(true);
    setError(null);
    try {
      if (editor.kind === 'offering') {
        const body = {
          title: get('title'),
          description: get('description'),
          kind: get('kind'),
          city: get('city'),
          address: get('address'),
          priceMinor: majorToMinor(get('price')),
          capacity: integer('capacity'),
          images: get('image') ? [get('image')] : [],
          amenities: get('amenities')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          cancellationHours: integer('cancellationHours'),
          taxBps: integer('taxBps'),
          discountBps: integer('discountBps'),
          published: f.has('published'),
          ...(get('venueId') ? { venueId: get('venueId') } : {}),
          ...(offer
            ? { expectedRevision: offer.revision, venueId: get('venueId') || offer.venueId }
            : {}),
        };
        await api(`/business/offerings${offer ? `/${offer.id}` : ''}`, {
          method: offer ? 'PATCH' : 'POST',
          body,
          idempotencyKey: key,
        });
      } else if (editor.kind === 'availability') {
        await api(`/business/offerings/${editor.offering.id}/availability`, {
          method: 'POST',
          idempotencyKey: key,
          body: {
            startDate: get('startDate'),
            ...(get('endDate') ? { endDate: get('endDate') } : {}),
            ...(get('startAt')
              ? {
                  startAt: new Date(`${get('startAt')}+01:00`).toISOString(),
                  endAt: new Date(`${get('endAt')}+01:00`).toISOString(),
                }
              : {}),
            capacity: integer('capacity'),
          },
        });
      } else if (editor.kind === 'reward') {
        await api('/business/rewards', {
          method: 'POST',
          idempotencyKey: key,
          body: {
            title: get('title'),
            description: get('description'),
            pointsCost: integer('pointsCost'),
            capacity: integer('capacity'),
            expiresAt: new Date(`${get('expiresAt')}+01:00`).toISOString(),
            transferable: f.has('transferable'),
            published: f.has('published'),
            ...(get('venueId') ? { venueId: get('venueId') } : {}),
          },
        });
      } else if (editor.kind === 'staff') {
        await api('/business/staff', {
          method: 'POST',
          idempotencyKey: key,
          body: {
            email: get('email'),
            displayName: get('displayName'),
            password: String(f.get('password') ?? ''),
            ...(get('venueId') ? { venueId: get('venueId') } : {}),
          },
        });
      } else
        await api(`/business/staff/${editor.staff.id}`, { method: 'DELETE', idempotencyKey: key });
      showSuccess(
        editor.kind === 'revoke'
          ? 'Reception access has been removed.'
          : editor.kind === 'staff'
            ? 'The reception account is ready.'
            : editor.kind === 'availability'
              ? 'Availability has been updated.'
              : editor.kind === 'reward'
                ? 'Your reward has been saved.'
                : 'Your place has been saved.',
      );
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this change.');
    } finally {
      setBusy(false);
    }
  }
  const title =
    editor.kind === 'offering'
      ? offer
        ? 'Edit this place'
        : 'Add a place'
      : editor.kind === 'availability'
        ? 'Set service availability'
        : editor.kind === 'reward'
          ? 'Create a reward'
          : editor.kind === 'staff'
            ? 'Add reception access'
            : 'Remove team access?';
  const price = offer
    ? `${BigInt(offer.priceMinor) / 100n}.${(BigInt(offer.priceMinor) % 100n).toString().padStart(2, '0')}`
    : '';
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <form className="form-grid" onSubmit={submit}>
        {needsVenues && venuesLoading && (
          <div className="form-wide">
            <Loading />
          </div>
        )}
        {needsVenues && venuesError && <ErrorNotice message={venuesError} retry={reloadVenues} />}
        {needsVenues && !venuesLoading && !venuesError && venues?.length === 0 && (
          <div className="form-wide">
            <ErrorNotice message="Add a venue before saving a place." />
            <Link className="text-button" to="/business/venues">
              Manage your venues
            </Link>
          </div>
        )}
        {editor.kind === 'offering' && (
          <>
            <Field label="Name">
              <input
                name="title"
                required
                minLength={3}
                maxLength={160}
                defaultValue={offer?.title}
              />
            </Field>
            <Field label="Venue">
              <select
                name="venueId"
                required
                defaultValue={offer?.venueId}
                disabled={busy || venuesUnavailable}
              >
                {venues?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.venueName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select name="kind" defaultValue={offer?.kind ?? data.business?.sector ?? 'STAY'}>
                <option value="STAY">Stay</option>
                <option value="DINING">Dining</option>
                <option value="EXPERIENCE">Experience</option>
              </select>
            </Field>
            <div className="form-wide">
              <Field label="Description">
                <textarea
                  name="description"
                  required
                  minLength={20}
                  maxLength={5000}
                  defaultValue={offer?.description}
                />
              </Field>
            </div>
            <Field label="Price in naira">
              <input
                name="price"
                inputMode="decimal"
                pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?"
                placeholder="45000.00"
                required
                defaultValue={price}
              />
            </Field>
            <Field label="Default capacity">
              <input
                name="capacity"
                type="number"
                required
                min={1}
                max={10000}
                defaultValue={offer?.capacity ?? 1}
              />
            </Field>
            <Field label="City">
              <input name="city" required defaultValue={offer?.city ?? data.business?.city} />
            </Field>
            <Field label="Street address">
              <input
                name="address"
                required
                minLength={4}
                defaultValue={offer?.address ?? data.business?.address}
              />
            </Field>
            <div className="form-wide">
              <Field label="Photo URL" hint="Use a licensed photo hosted over HTTPS.">
                <input name="image" type="url" defaultValue={offer?.images[0]} />
              </Field>
            </div>
            <div className="form-wide">
              <Field label="Amenities, separated by commas">
                <input name="amenities" defaultValue={offer?.amenities.join(', ')} />
              </Field>
            </div>
            <Field label="Tax in basis points" hint="750 means 7.5%. Tax is shown separately.">
              <input
                name="taxBps"
                type="number"
                min={0}
                max={5000}
                defaultValue={offer?.taxBps ?? 0}
                required
              />
            </Field>
            <Field label="Discount in basis points" hint="1000 means 10% off the service price.">
              <input
                name="discountBps"
                type="number"
                min={0}
                max={9000}
                defaultValue={offer?.discountBps ?? 0}
                required
              />
            </Field>
            <Field label="Cancellation notice, hours">
              <input
                name="cancellationHours"
                type="number"
                min={0}
                max={720}
                defaultValue={offer?.cancellationHours ?? 24}
                required
              />
            </Field>
            <label className="check-field">
              <input name="published" type="checkbox" defaultChecked={offer?.published ?? false} />
              Publish this place
            </label>
          </>
        )}
        {editor.kind === 'availability' && (
          <>
            <p className="form-wide small-copy">
              {editor.offering.title}. Capacity includes current allocations. Existing bookings
              cannot be displaced. All times use Africa/Lagos.
            </p>
            <Field label={editor.offering.kind === 'STAY' ? 'First night' : 'Service date'}>
              <input name="startDate" type="date" required />
            </Field>
            {editor.offering.kind === 'STAY' ? (
              <Field label="Departure date, excluded">
                <input name="endDate" type="date" required />
              </Field>
            ) : (
              <>
                <Field label="Starts at">
                  <input name="startAt" type="datetime-local" required />
                </Field>
                <Field label="Ends at">
                  <input name="endAt" type="datetime-local" required />
                </Field>
              </>
            )}
            <Field label="Total capacity">
              <input
                name="capacity"
                type="number"
                min={0}
                max={10000}
                defaultValue={editor.offering.capacity}
                required
              />
            </Field>
          </>
        )}
        {editor.kind === 'reward' && (
          <>
            <div className="form-wide">
              <Field label="Reward name">
                <input name="title" required maxLength={160} />
              </Field>
            </div>
            <div className="form-wide">
              <Field label="Terms and description">
                <textarea name="description" required minLength={10} maxLength={2000} />
              </Field>
            </div>
            <Field label="Points cost">
              <input name="pointsCost" type="number" min={1} max={100000000} required />
            </Field>
            <Field label="Number available">
              <input name="capacity" type="number" min={1} max={100000} required />
            </Field>
            <Field label="Expires, Lagos time">
              <input name="expiresAt" type="datetime-local" required />
            </Field>
            <div className="form-stack">
              <label className="check-field">
                <input name="transferable" type="checkbox" />
                Allow gifts and swaps
              </label>
              <label className="check-field">
                <input name="published" type="checkbox" />
                Publish this reward
              </label>
            </div>
          </>
        )}
        {editor.kind === 'staff' && (
          <>
            <Field label="Name">
              <input name="displayName" required minLength={2} maxLength={100} autoComplete="off" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required autoComplete="off" />
            </Field>
            <Field label="Initial password" hint="Share privately. Use at least 12 characters.">
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="Assigned venue">
              <select name="venueId">
                <option value="">All business venues</option>
                {Array.from(new Map(data.offerings.map((o) => [o.venueId, o])).values()).map(
                  (o) => (
                    <option value={o.venueId} key={o.venueId}>
                      {o.address}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </>
        )}
        {editor.kind === 'revoke' && (
          <p className="form-wide">
            {editor.staff.displayName} will lose reception access. Their active sessions and
            reception source will be revoked.
          </p>
        )}
        {error && (
          <div className="form-wide">
            <ErrorNotice message={error} />
          </div>
        )}
        <div className="form-wide form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Go back
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || venuesUnavailable}>
            {busy ? 'Saving…' : editor.kind === 'revoke' ? 'Remove access' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

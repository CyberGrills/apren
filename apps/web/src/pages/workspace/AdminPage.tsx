import { useFeedback } from '../../components/Feedback.tsx';
import type { AdminOverview, Business, Payment } from '@7even/contracts';
import { Check, RefreshCw, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Money,
  PageHeader,
  StatusBadge,
} from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import {
  ActivityList,
  dateLabel,
  MetricsStrip,
  ReservationActionDialog,
  type ReservationCommand,
} from './shared.tsx';

type Tab = 'overview' | 'businesses' | 'payments' | 'policy' | 'audit';
type Editor =
  | { kind: 'status'; business: Business; status: 'APPROVED' | 'SUSPENDED' }
  | { kind: 'subaccount'; business: Business }
  | { kind: 'policy' };
const titles: Record<Tab, string> = {
  overview: 'Keep the whole picture.',
  businesses: 'The businesses on 7even.',
  payments: 'Follow the money, clearly.',
  policy: 'Points, with clear rules.',
  audit: 'A record that stays.',
};
export function AdminPage({ tab = 'overview' }: { tab?: Tab }) {
  const { showSuccess } = useFeedback();
  const { data, loading, error, reload } = useApi<AdminOverview>('/admin/overview');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [command, setCommand] = useState<ReservationCommand | null>(null);
  async function reconcile() {
    setReconciling(true);
    setActionError(null);
    try {
      const next = await api<{ processed: number; pending: number; exceptions: number }>(
        '/admin/reconcile',
        { method: 'POST', idempotencyKey: crypto.randomUUID() },
      );
      showSuccess(
        `${next.processed} records checked. ${next.pending} pending, ${next.exceptions} exceptions.`,
      );
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Reconciliation could not run.');
    } finally {
      setReconciling(false);
    }
  }
  function refund(payment: Payment) {
    const reservation = data?.reservations.find((item) => item.id === payment.reservationId);
    if (reservation) setCommand({ reservation, action: 'REFUND', paymentId: payment.id });
    else setActionError('Load the reservation before requesting its refund.');
  }
  return (
    <>
      <PageHeader
        eyebrow="Platform admin"
        title={titles[tab]}
        description={
          tab === 'payments'
            ? 'Verified receipts, processing fees and bank settlement are recorded separately.'
            : undefined
        }
        actions={
          tab === 'policy' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditor({ kind: 'policy' })}
            >
              <Settings2 size={16} />
              Change earning policy
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={reconciling}
              onClick={() => void reconcile()}
            >
              <RefreshCw size={16} />
              {reconciling ? 'Reconciling…' : 'Reconcile records'}
            </button>
          )
        }
      />
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {actionError && <ErrorNotice message={actionError} />}
      {data && (
        <>
          {tab === 'overview' && (
            <>
              <MetricsStrip metrics={data.metrics} admin />
              <section className="panel demo-dashboard-promo"><div><span className="public-eyebrow">Demo catalogue</span><h2>100 fictional hotel and apartment profiles</h2><p className="small-copy">Review the guest-facing catalogue without changing verified business records or live inventory.</p></div><Link className="btn btn-secondary" to="/demo/hotels">Open demo catalogue</Link></section>
              <div className="two-column">
                <section>
                  <div className="section-heading">
                    <h2>Needs attention</h2>
                    <span className="tag">{data.exceptions.length} records</span>
                  </div>
                  <ExceptionList exceptions={data.exceptions} />
                </section>
                <section>
                  <div className="section-heading">
                    <h2>Business applications</h2>
                  </div>
                  {data.businesses
                    .filter((b) => b.status === 'PENDING')
                    .map((b) => (
                      <article className="business-card" key={b.id}>
                        <h2>{b.businessName}</h2>
                        <p>
                          {b.city} · {b.sector.toLowerCase()}
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() =>
                            setEditor({ kind: 'status', business: b, status: 'APPROVED' })
                          }
                        >
                          Review application
                        </button>
                      </article>
                    ))}
                  {!data.businesses.some((b) => b.status === 'PENDING') && (
                    <p className="small-copy">No pending applications.</p>
                  )}
                </section>
              </div>
              <section className="workspace-section">
                <div className="section-heading">
                  <h2>Latest activity</h2>
                </div>
                <ActivityList items={data.activity.slice(0, 10)} />
              </section>
            </>
          )}
          {tab === 'businesses' && (
            <>
              <div className="toolbar">
                <input
                  aria-label="Find a business"
                  placeholder="Search by name or city"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="business-list">
                {data.businesses
                  .filter((b) =>
                    `${b.businessName} ${b.city}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((b) => (
                    <article className="business-card" key={b.id}>
                      <div className="business-card-header">
                        <div>
                          <p className="eyebrow">
                            {b.isSample ? 'Sample business' : b.sector.toLowerCase()} · {b.city}
                          </p>
                          <h2>{b.businessName}</h2>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                      <p>{b.description}</p>
                      <p>
                        {b.address} · {b.phone}
                      </p>
                      <p>
                        {b.subaccountConfigured
                          ? `Bank mapping: ${b.accountLabel}`
                          : 'No verified bank subaccount.'}
                      </p>
                      <div className="row-actions">
                        {b.status !== 'APPROVED' ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={() =>
                              setEditor({ kind: 'status', business: b, status: 'APPROVED' })
                            }
                          >
                            <Check size={14} />
                            Review approval
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-danger btn-small"
                            onClick={() =>
                              setEditor({ kind: 'status', business: b, status: 'SUSPENDED' })
                            }
                          >
                            Suspend business
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => setEditor({ kind: 'subaccount', business: b })}
                        >
                          Bank subaccount
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {tab === 'payments' && (
            <>
              <ExceptionList exceptions={data.exceptions} />
              <div className="toolbar">
                <input
                  aria-label="Find a payment"
                  placeholder="Payment reference or provider transaction"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Paid amount</th>
                      <th>7even</th>
                      <th>Provider fee</th>
                      <th>Business expected</th>
                      <th>Payment / settlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments
                      .filter((p) =>
                        `${p.reference} ${p.providerTransactionId}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.reference}</strong>
                            <small>
                              {p.mode === 'mock'
                                ? 'Local test provider'
                                : (p.providerTransactionId ?? 'Provider ID pending')}
                            </small>
                            <small>{dateLabel(p.createdAt)}</small>
                          </td>
                          <td>
                            <Money minor={p.amountMinor} />
                          </td>
                          <td>
                            <Money minor={p.commissionMinor} />
                          </td>
                          <td>
                            {p.feeMinor === null ? 'Not confirmed' : <Money minor={p.feeMinor} />}
                          </td>
                          <td>
                            <Money minor={p.merchantExpectedMinor} />
                          </td>
                          <td>
                            <StatusBadge status={p.status} />
                            <small>
                              <StatusBadge status={p.settlementStatus} />
                            </small>
                            {['PAID', 'REVIEW_REQUIRED'].includes(p.status) && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => refund(p)}
                              >
                                Review refund
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="small-copy">
                Expected business amount is an accounting allocation. Marking a payment successful
                does not mark it bank settled. Reconciliation requires matching provider evidence.
              </p>
            </>
          )}
          {tab === 'policy' && (
            <div className="two-column">
              <div className="panel">
                <p className="eyebrow">Earning policy · Version {data.policy.version}</p>
                <h2>A reward for coming back.</h2>
                <p>
                  Earn {data.policy.earnPoints.toLocaleString('en-NG')} points for each{' '}
                  <Money minor={data.policy.earnSpendMinor} /> of eligible discounted service value.
                </p>
                <dl className="settings-summary">
                  <div>
                    <dt>Reservation hold</dt>
                    <dd>{data.policy.holdMinutes} minutes</dd>
                  </div>
                  <div>
                    <dt>Commission</dt>
                    <dd>{data.policy.commissionBps / 100}% before tax</dd>
                  </div>
                </dl>
              </div>
              <div className="panel">
                <h2>When points count</h2>
                <p>
                  Payment must be verified and the service must be completed. Each accepted quote
                  retains its earning policy.
                </p>
                <p className="small-copy">
                  Reversals add compensating entries. A shortfall after spent points pauses
                  redemption. Points cannot be withdrawn as cash.
                </p>
                <p className="small-copy">
                  A new policy affects new quotes. Existing accepted terms remain in their history.
                </p>
              </div>
            </div>
          )}
          {tab === 'audit' && (
            <>
              <p className="small-copy">
                Attributable actions retain their original time, actor and affected record.
                Financial corrections add compensating entries.
              </p>
              <ActivityList items={data.activity} />
            </>
          )}
        </>
      )}
      {editor && data && (
        <AdminEditor editor={editor} data={data} onClose={() => setEditor(null)} onDone={reload} />
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
function ExceptionList({ exceptions }: { exceptions: AdminOverview['exceptions'] }) {
  return (
    <div className="workspace-alerts">
      {exceptions.map((exception) => (
        <article className="alert-row" key={exception.id}>
          <strong>{exception.kind.toLowerCase().replaceAll('_', ' ')}</strong>
          <p>{exception.message}</p>
          <small>{dateLabel(exception.createdAt)}</small>
        </article>
      ))}
      {exceptions.length === 0 && (
        <p className="small-copy">No unresolved exceptions are currently recorded.</p>
      )}
    </div>
  );
}
function AdminEditor({
  editor,
  data,
  onClose,
  onDone,
}: {
  editor: Editor;
  data: AdminOverview;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(crypto.randomUUID());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const get = (name: string) => String(f.get(name) ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      if (editor.kind === 'status')
        await api(`/admin/businesses/${editor.business.id}/status`, {
          method: 'POST',
          idempotencyKey: key,
          body: { status: editor.status, reason: get('reason') },
        });
      else if (editor.kind === 'subaccount')
        await api(`/admin/businesses/${editor.business.id}/subaccount`, {
          method: 'POST',
          idempotencyKey: key,
          body: { subaccountCode: get('subaccountCode'), accountLabel: get('accountLabel') },
        });
      else
        await api('/admin/policy', {
          method: 'POST',
          idempotencyKey: key,
          body: {
            earnSpendMinor: get('earnSpendMinor'),
            earnPoints: Number(get('earnPoints')),
            holdMinutes: Number(get('holdMinutes')),
            reason: get('reason'),
          },
        });
      showSuccess('Your decision has been recorded.');
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this decision.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        editor.kind === 'status'
          ? `${editor.status === 'APPROVED' ? 'Approve' : 'Suspend'} ${editor.business.businessName}?`
          : editor.kind === 'subaccount'
            ? 'Set verified bank mapping'
            : 'Publish a new earning policy'
      }
      onClose={onClose}
      busy={busy}
    >
      <form className="form-stack" onSubmit={submit}>
        {editor.kind === 'status' && (
          <>
            <p className="small-copy">
              {editor.business.description}
              <br />
              {editor.business.address}, {editor.business.city}
              <br />
              {editor.business.phone}
            </p>
            <Field label="Decision and reason">
              <textarea name="reason" minLength={3} maxLength={500} required />
            </Field>
          </>
        )}
        {editor.kind === 'subaccount' && (
          <>
            <p className="notice">
              The server checks the Flutterwave subaccount before activating live checkout. Confirm
              the business bank details through your onboarding process.
            </p>
            <Field label="Flutterwave subaccount code">
              <input
                name="subaccountCode"
                placeholder="RS_…"
                required
                pattern="RS_[A-Za-z0-9_]+"
                maxLength={100}
              />
            </Field>
            <Field label="Account label">
              <input
                name="accountLabel"
                required
                minLength={3}
                maxLength={100}
                defaultValue={editor.business.accountLabel ?? ''}
              />
            </Field>
          </>
        )}
        {editor.kind === 'policy' && (
          <>
            <Field
              label="Eligible spend in kobo"
              hint="100000 means ₦1,000.00. Use whole minor units."
            >
              <input
                name="earnSpendMinor"
                inputMode="numeric"
                pattern="[1-9][0-9]{0,14}"
                required
                defaultValue={data.policy.earnSpendMinor}
              />
            </Field>
            <Field label="Points earned">
              <input
                name="earnPoints"
                type="number"
                min={1}
                max={100000}
                required
                defaultValue={data.policy.earnPoints}
              />
            </Field>
            <Field label="Hold duration, minutes">
              <input
                name="holdMinutes"
                type="number"
                min={5}
                max={60}
                required
                defaultValue={data.policy.holdMinutes}
              />
            </Field>
            <Field label="Reason for this version">
              <textarea name="reason" minLength={5} maxLength={500} required />
            </Field>
          </>
        )}
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Go back
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm decision'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

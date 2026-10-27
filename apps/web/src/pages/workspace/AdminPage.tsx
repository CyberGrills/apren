import { useFeedback } from '../../components/Feedback.tsx';
import type {
  Activity,
  AdminOverview,
  Business,
  BusinessPaymentAccount,
  Payment,
  Reservation,
} from '@7even/contracts';
import { Check, RefreshCw, Settings2 } from 'lucide-react';
import { useState } from 'react';
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
import { CryptoRefundDialog } from './CryptoRefundDialog.tsx';
import { AdminWorkspaceOverview } from './AdminWorkspaceOverview.tsx';
import { AdminRecords, AdminReservationsTable } from './AdminRecords.tsx';
import {
  ActivityList,
  dateLabel,
  ReservationActionDialog,
  type ReservationCommand,
} from './shared.tsx';

type Tab = 'overview' | 'businesses' | 'payments' | 'reservations' | 'policy' | 'audit';
type Editor =
  | { kind: 'status'; business: Business; status: 'APPROVED' | 'SUSPENDED' }
  | { kind: 'subaccount'; business: Business }
  | { kind: 'cryptoWallet'; business: Business; account: BusinessPaymentAccount }
  | { kind: 'policy' };
const hotelVerificationChecks = [
  { key: 'propertyExists', label: 'The property exists and is operating.' },
  {
    key: 'partnerAuthority',
    label: 'The partner is authorized to list this property and has consented.',
  },
  { key: 'directContact', label: 'The property contact route has been verified.' },
  { key: 'fullAddress', label: 'The full property address has been verified.' },
  { key: 'coordinates', label: 'The property coordinates have been independently checked.' },
  { key: 'currentRates', label: 'Current NGN rates and their pricing basis have been checked.' },
  {
    key: 'roomInventoryAndPolicies',
    label: 'Room types, capacity, occupancy limits and booking policies have been checked.',
  },
] as const;
const titles: Record<Tab, string> = {
  overview: 'Platform overview.',
  businesses: 'Businesses',
  payments: 'Payments & settlement',
  reservations: 'Reservations',
  policy: 'Points policy',
  audit: 'Activity log',
};
export function AdminPage({ tab = 'overview' }: { tab?: Tab }) {
  const { showSuccess } = useFeedback();
  const { data, loading, error, reload } = useApi<AdminOverview>('/admin/overview');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [command, setCommand] = useState<ReservationCommand | null>(null);
  const [cryptoRefundId, setCryptoRefundId] = useState<string | null>(null);
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
  async function refund(payment: Payment) {
    if (refundingId) return;
    if (payment.crypto?.refund) {
      setCryptoRefundId(payment.id);
      return;
    }
    setRefundingId(payment.id);
    setActionError(null);
    try {
      const reservation = await api<Reservation>(`/reservations/${payment.reservationId}`);
      setCommand({ reservation, action: 'REFUND', paymentId: payment.id });
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Could not load this reservation. Try again.',
      );
    } finally {
      setRefundingId(null);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Platform admin"
        title={titles[tab]}
        description={
          tab === 'payments'
            ? 'Verified receipts, processing fees, bank settlement and wallet delivery are recorded separately.'
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
      {tab === 'businesses' && (
        <AdminRecords<Business>
          collection="businesses"
          searchLabel="Find a business"
          placeholder="Name, city or state"
          statuses={['PENDING', 'APPROVED', 'SUSPENDED']}
          initialStatus="PENDING"
        >
          {(businesses) => (
            <div className="business-list">
              {businesses.map((b) => (
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
                  <p>{b.address} · {b.phone}</p>
                  <p>{b.subaccountConfigured ? `Bank mapping: ${b.accountLabel}` : 'No verified bank subaccount.'}</p>
                  {(b.paymentAccounts ?? []).map((account) => (
                    <div className="admin-payment-account" key={account.id}>
                      <p>
                        <strong>{account.provider === 'crypto' ? 'USDC business wallet' : account.provider === 'paystack' ? 'Paystack' : 'Flutterwave'}</strong>{' '}
                        · <StatusBadge status={account.status} />{' '}
                        {account.mode === 'mock' && <span className="tag">Local test</span>}
                      </p>
                      <code className="crypto-address">{account.accountCode}</code>
                      {account.provider === 'crypto' && account.status === 'PENDING' && (
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditor({ kind: 'cryptoWallet', business: b, account })}>
                          Review wallet ownership
                        </button>
                      )}
                    </div>
                  ))}
                  {b.cryptoCommissionOwedMinor && <p>USDC commission owed: <Money minor={b.cryptoCommissionOwedMinor} /></p>}
                  <div className="row-actions">
                    {b.status !== 'APPROVED' ? (
                      <button type="button" className="btn btn-primary btn-small" onClick={() => setEditor({ kind: 'status', business: b, status: 'APPROVED' })}>
                        <Check size={14} /> Review approval
                      </button>
                    ) : (
                      <button type="button" className="btn btn-danger btn-small" onClick={() => setEditor({ kind: 'status', business: b, status: 'SUSPENDED' })}>
                        Suspend business
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditor({ kind: 'subaccount', business: b })}>Bank subaccount</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AdminRecords>
      )}
      {data && (
        <>
          {tab === 'overview' && (
            <AdminWorkspaceOverview
              data={data}
              onReview={(business) => setEditor({ kind: 'status', business, status: 'APPROVED' })}
            />
          )}
          {tab === 'payments' && (
            <>
              <ExceptionList exceptions={data.exceptions} />
              <AdminRecords<Payment>
                collection="payments"
                searchLabel="Find a payment"
                placeholder="Reference, provider ID or business"
                statuses={[
                  'UNPAID',
                  'PENDING',
                  'PAID',
                  'FAILED',
                  'UNKNOWN',
                  'REFUND_PENDING',
                  'REFUNDED',
                  'REVIEW_REQUIRED',
                ]}
              >
                {(payments) => (
                  <>
                    <section
                      className="table-wrap admin-payments-table"
                      data-scrolls
                      aria-label="Payments. Scroll horizontally to see delivery and refund actions."
                      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the payment table.
                      tabIndex={0}
                    >
                      <p className="table-scroll-cue">
                        Scroll table for delivery and refund actions →
                      </p>
                      <table>
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Paid amount</th>
                            <th>7even</th>
                            <th>Provider fee</th>
                            <th>Business expected</th>
                            <th>Payment / delivery</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.reference}</strong>
                                <small>
                                  {p.mode === 'mock'
                                    ? `Local test · ${p.provider === 'paystack' ? 'Paystack' : p.provider === 'crypto' ? 'USDC on Base' : 'Flutterwave'}`
                                    : p.provider === 'crypto'
                                      ? 'USDC on Base'
                                      : p.provider === 'paystack'
                                        ? 'Paystack'
                                        : 'Flutterwave'}
                                </small>
                                <small className="crypto-address">
                                  {p.providerTransactionId ?? 'Provider ID pending'}
                                </small>
                                <small>{dateLabel(p.createdAt)}</small>
                              </td>
                              <td>
                                <Money minor={p.amountMinor} />
                              </td>
                              <td>
                                <Money minor={p.commissionMinor} />
                                {p.provider === 'crypto' && (
                                  <small>
                                    Owed: <Money minor={p.commissionOwedMinor} />
                                  </small>
                                )}
                              </td>
                              <td>
                                {p.feeMinor === null ? (
                                  'Not confirmed'
                                ) : (
                                  <Money minor={p.feeMinor} />
                                )}
                              </td>
                              <td>
                                <Money minor={p.merchantExpectedMinor} />
                              </td>
                              <td>
                                <StatusBadge status={p.status} />
                                <small>
                                  {p.settlementKind === 'WALLET'
                                    ? 'Wallet delivery: '
                                    : 'Bank settlement: '}
                                  <StatusBadge status={p.settlementStatus} />
                                </small>
                                {['PAID', 'REVIEW_REQUIRED', 'REFUND_PENDING'].includes(
                                  p.status,
                                ) && (
                                  <button
                                    type="button"
                                    className="text-button"
                                    disabled={refundingId !== null}
                                    onClick={() => void refund(p)}
                                  >
                                    {refundingId === p.id
                                      ? 'Loading reservation…'
                                      : p.status === 'REFUND_PENDING'
                                        ? 'Continue refund'
                                        : 'Review refund'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                    <p className="small-copy">
                      Expected business amount is an accounting allocation. Marking a payment
                      successful does not prove bank or wallet delivery. Direct-wallet commission is
                      owed by the business, not collected cash. Reconciliation requires matching
                      provider evidence.
                    </p>
                  </>
                )}
              </AdminRecords>
            </>
          )}
          {tab === 'reservations' && (
            <AdminRecords<Reservation>
              collection="reservations"
              searchLabel="Find a reservation"
              placeholder="Guest, reference, place or business"
              statuses={[
                'HELD',
                'CONFIRMED',
                'CHECKED_IN',
                'FULFILLED',
                'CANCELLED',
                'EXPIRED',
                'PAYMENT_REVIEW',
              ]}
            >
              {(reservations) => (
                <AdminReservationsTable reservations={reservations} businesses={data.businesses} />
              )}
            </AdminRecords>
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
              <AdminRecords<Activity>
                collection="audit"
                searchLabel="Find an activity record"
                placeholder="Action, person or record"
              >
                {(items) => <ActivityList items={items} />}
              </AdminRecords>
            </>
          )}
        </>
      )}
      {editor && (editor.kind !== 'policy' || data) && (
        <AdminEditor editor={editor} data={data} onClose={() => setEditor(null)} onDone={reload} />
      )}
      {command && (
        <ReservationActionDialog
          command={command}
          onClose={() => setCommand(null)}
          onDone={reload}
        />
      )}
      {cryptoRefundId && (
        <CryptoRefundDialog
          paymentId={cryptoRefundId}
          onClose={() => setCryptoRefundId(null)}
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
  data: AdminOverview | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(crypto.randomUUID());
  const [provider, setProvider] = useState<'flutterwave' | 'paystack'>('flutterwave');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const get = (name: string) => String(f.get(name) ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      if (editor.kind === 'status') {
        const body: {
          status: 'APPROVED' | 'SUSPENDED';
          reason: string;
          verification?: Record<string, unknown>;
        } = { status: editor.status, reason: get('reason') };
        if (editor.status === 'APPROVED' && editor.business.sector === 'STAY') {
          const evidence = (name: string) => ({
            confirmed: f.get(`confirmed_${name}`) === 'on',
            evidenceReference: get(`evidence_${name}`),
          });
          body.verification = {
            propertyExists: evidence('propertyExists'),
            partnerAuthority: evidence('partnerAuthority'),
            directContact: evidence('directContact'),
            fullAddress: evidence('fullAddress'),
            coordinates: evidence('coordinates'),
            currentRates: evidence('currentRates'),
            roomInventoryAndPolicies: evidence('roomInventoryAndPolicies'),
            inventoryFreshnessHours: Number(get('inventoryFreshnessHours')),
          };
        }
        await api(`/admin/businesses/${editor.business.id}/status`, {
          method: 'POST',
          idempotencyKey: key,
          body,
        });
      } else if (editor.kind === 'subaccount')
        await api(`/admin/businesses/${editor.business.id}/subaccount`, {
          method: 'POST',
          idempotencyKey: key,
          body: {
            provider,
            subaccountCode: get('subaccountCode'),
            accountLabel: get('accountLabel'),
          },
        });
      else if (editor.kind === 'cryptoWallet')
        await api(`/admin/businesses/${editor.business.id}/crypto-wallet/approve`, {
          method: 'POST',
          idempotencyKey: key,
          body: {
            expectedRevision: editor.account.revision,
            approved: get('decision') === 'APPROVE',
            reason: get('reason'),
          },
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
            : editor.kind === 'cryptoWallet'
              ? 'Review this business wallet'
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
            {editor.status === 'APPROVED' && editor.business.sector === 'STAY' && (
              <section className="workspace-section" aria-label="Hotel verification checklist">
                <p className="notice">
                  Approval enables publication. Confirm each item only after reviewing real partner
                  evidence. Enter a source URL or an internal case/document reference for every
                  check.
                </p>
                <Field label="Maximum inventory age before it should be treated as stale (hours)">
                  <input
                    name="inventoryFreshnessHours"
                    type="number"
                    min={1}
                    max={168}
                    defaultValue={24}
                    required
                  />
                </Field>
                {hotelVerificationChecks.map((check) => (
                  <div className="verification-check" key={check.key}>
                    <label className="checkbox-row">
                      <input type="checkbox" name={`confirmed_${check.key}`} required />
                      <span>{check.label}</span>
                    </label>
                    <Field label={`Evidence reference · ${check.label}`}>
                      <input
                        name={`evidence_${check.key}`}
                        minLength={3}
                        maxLength={300}
                        placeholder="HTTPS URL or internal case/document ID"
                        required
                      />
                    </Field>
                  </div>
                ))}
              </section>
            )}
            <Field label="Decision and reason">
              <textarea name="reason" minLength={3} maxLength={500} required />
            </Field>
          </>
        )}
        {editor.kind === 'subaccount' && (
          <>
            <p className="notice">
              The server checks the selected provider’s subaccount before activating live checkout.
              Confirm the business bank details through your onboarding process.
            </p>
            <Field label="Payment provider">
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as 'flutterwave' | 'paystack')}
              >
                <option value="flutterwave">Flutterwave · above ₦50,000</option>
                <option value="paystack">Paystack · ₦50,000 and below</option>
              </select>
            </Field>
            <Field
              label={`${provider === 'paystack' ? 'Paystack' : 'Flutterwave'} subaccount code`}
            >
              <input
                key={provider}
                name="subaccountCode"
                placeholder={provider === 'paystack' ? 'ACCT_…' : 'RS_…'}
                required
                pattern={provider === 'paystack' ? 'ACCT_[A-Za-z0-9_]+' : 'RS_[A-Za-z0-9_]+'}
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
        {editor.kind === 'cryptoWallet' && (
          <>
            <p>{editor.business.businessName}</p>
            <code className="crypto-address">{editor.account.accountCode}</code>
            <p className="small-copy">
              The business signed its ownership message. Review its business identity and approved
              destination before enabling direct USDC payment. Existing quotes keep their original
              destination.
            </p>
            <Field label="Decision">
              <select name="decision" required>
                <option value="APPROVE">Approve this wallet</option>
                <option value="REJECT">Reject this wallet</option>
              </select>
            </Field>
            <Field label="Review reason">
              <textarea name="reason" minLength={5} maxLength={500} required />
            </Field>
          </>
        )}
        {editor.kind === 'policy' && data && (
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

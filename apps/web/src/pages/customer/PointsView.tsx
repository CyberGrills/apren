import type { Benefit, PointsAccount, Reward } from '@7even/contracts';
import { Gift } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, Modal, useFeedback } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { friendlyDate } from '../public/PublicShell.tsx';

export function PointsView({ points, reload }: { points: PointsAccount; reload: () => void }) {
  return (
    <>
      <div className="customer-points-overview">
        <div className="customer-points-balance">
          <span className="public-eyebrow">Ready to use</span>
          <p>
            {points.available.toLocaleString('en-NG')}
            <span>points</span>
          </p>
          <div className="customer-points-note">
            Your points come from eligible completed bookings.
          </div>
        </div>
        <dl>
          <div>
            <dt>Total balance</dt>
            <dd>{points.balance.toLocaleString('en-NG')}</dd>
          </div>
          <div>
            <dt>Reserved points</dt>
            <dd>{points.reserved.toLocaleString('en-NG')}</dd>
          </div>
          {points.shortfall > 0 && (
            <div>
              <dt>Adjustment to recover</dt>
              <dd>{points.shortfall.toLocaleString('en-NG')}</dd>
            </div>
          )}
        </dl>
      </div>
      {points.shortfall > 0 && (
        <p className="customer-review-message">
          A refund or adjustment reduced your points balance. New points first cover the adjustment
          before they become available to use.
        </p>
      )}
      <RewardCatalogue available={points.available} reload={reload} />
      <section className="customer-points-history" aria-labelledby="points-history-title">
        <div className="customer-section-heading">
          <span className="public-eyebrow">The record</span>
          <h2 id="points-history-title">How they add up.</h2>
        </div>
        {points.entries.length ? (
          <ul className="customer-ledger">
            {points.entries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <p>{entry.description}</p>
                  <span>
                    {friendlyDate(entry.createdAt)} ·{' '}
                    {entry.entryType.toLowerCase().replaceAll('_', ' ')}
                  </span>
                </div>
                <strong className={entry.amount > 0 ? 'points-credit' : ''}>
                  {entry.amount > 0 ? '+' : ''}
                  {entry.amount.toLocaleString('en-NG')}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Your points story starts with a visit."
            description="Complete an eligible booking and the points you earn will appear here."
            action={
              <Link to="/explore" className="btn btn-secondary">
                Find your next plan
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}

export function RewardCatalogue({ available, reload }: { available: number; reload: () => void }) {
  const { showSuccess } = useFeedback();
  const { data, loading, error, reload: reloadRewards } = useApi<Reward[]>('/rewards?pageSize=60');
  const [selected, setSelected] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());
  async function redeem() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await api<Benefit>(`/rewards/${selected.id}/redeem`, {
        method: 'POST',
        idempotencyKey: attempt.current,
      });
      showSuccess(
        <>
          {result.title} is now in your benefits. <Link to="/app/benefits">View your benefit</Link>
        </>,
        'Reward claimed.',
      );
      setSelected(null);
      reload();
      reloadRewards();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'We could not claim this reward. Check your points and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="customer-rewards" aria-labelledby="rewards-title">
      <div className="customer-section-heading">
        <span className="public-eyebrow">A good reason to come back</span>
        <h2 id="rewards-title">Something for your points.</h2>
      </div>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reloadRewards} />}
      {data?.length === 0 && (
        <EmptyState
          title="The next reward is still to come."
          description="Published rewards from participating businesses will appear here. Your points remain in your account."
        />
      )}
      {data && data.length > 0 && (
        <div className="customer-reward-grid">
          {data.map((reward) => (
            <article className="customer-reward" key={reward.id}>
              <div className="customer-reward-heading">
                <Gift size={23} aria-hidden="true" />
                <span>{reward.pointsCost.toLocaleString('en-NG')} points</span>
              </div>
              <span className="public-eyebrow">{reward.businessName}</span>
              <h3>{reward.title}</h3>
              <p>{reward.description}</p>
              <dl>
                <div>
                  <dt>Use before</dt>
                  <dd>{friendlyDate(reward.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Available</dt>
                  <dd>{reward.remaining}</dd>
                </div>
                <div>
                  <dt>Can be given or swapped</dt>
                  <dd>{reward.transferable ? 'Yes, while unused' : 'For your use only'}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={
                  available < reward.pointsCost ||
                  reward.remaining < 1 ||
                  new Date(reward.expiresAt).getTime() <= Date.now()
                }
                onClick={() => {
                  setSelected(reward);
                  setActionError(null);
                  attempt.current = crypto.randomUUID();
                }}
              >
                {available < reward.pointsCost
                  ? `${(reward.pointsCost - available).toLocaleString('en-NG')} more points needed`
                  : reward.remaining < 1
                    ? 'No rewards left'
                    : 'Use your points'}
              </button>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <Modal
          title="Claim this reward?"
          busy={busy}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <p>
            {selected.title} from {selected.businessName}.
          </p>
          <p className="customer-confirm-points">
            {selected.pointsCost.toLocaleString('en-NG')} points
          </p>
          <p className="public-small">
            These points leave your available balance when the reward is claimed. The benefit will
            show its use-by date and code in your account.
          </p>
          {actionError && <ErrorNotice message={actionError} />}
          <div className="customer-modal-actions">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Keep my points
            </button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={redeem}>
              {busy ? 'Claiming…' : 'Claim reward'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

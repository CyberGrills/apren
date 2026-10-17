import type { Trade } from '@7even/contracts';
import { ArrowRightLeft, ArrowUpRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorNotice, Modal, StatusBadge, useFeedback } from '../../components/ui.tsx';
import { api, ApiError } from '../../lib/api.ts';
import { friendlyDate } from '../public/PublicShell.tsx';

type TradeAction = 'ACCEPT' | 'DECLINE' | 'CANCEL';
export function ExchangeView({
  trades,
  userId,
  reload,
}: {
  trades: Trade[];
  userId: string;
  reload: () => void;
}) {
  const { showSuccess } = useFeedback();
  const [selected, setSelected] = useState<{ trade: Trade; action: TradeAction } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());
  async function act() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<Trade>(`/trades/${selected.trade.id}/actions`, {
        method: 'POST',
        body: { action: selected.action, expectedRevision: selected.trade.revision },
        idempotencyKey: attempt.current,
      });
      showSuccess(
        'Your benefits show their current owner and status.',
        result.status === 'ACCEPTED'
          ? 'Offer accepted.'
          : result.status === 'DECLINED'
            ? 'Offer declined.'
            : result.status === 'CANCELLED'
              ? 'Offer cancelled.'
              : 'Offer updated.',
      );
      setSelected(null);
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not update this offer. Refresh your exchanges to see its current state.',
      );
      if (cause instanceof ApiError && cause.status === 409) {
        setSelected(null);
        reload();
      }
    } finally {
      setBusy(false);
    }
  }
  function choose(trade: Trade, action: TradeAction) {
    setSelected({ trade, action });
    setError(null);
    attempt.current = crypto.randomUUID();
  }
  if (!trades.length)
    return (
      <EmptyState
        title="Good things can be shared."
        description="Give an eligible unused benefit to someone else, or offer a swap. Only benefits marked transferable can be exchanged."
        action={
          <Link className="btn btn-primary" to="/app/benefits">
            See your benefits <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        }
      />
    );
  return (
    <>
      {error && !selected && <ErrorNotice message={error} retry={reload} />}
      <p className="customer-exchange-intro">
        Gifts and swaps move the benefit itself. Points and cash do not change hands in an exchange.
      </p>
      <div className="customer-exchanges">
        {trades.map((trade) => {
          const incoming = trade.recipientId === userId;
          return (
            <article key={trade.id} className="customer-exchange">
              <div className="customer-exchange-top">
                <span className="public-eyebrow">
                  {incoming ? `From ${trade.senderName}` : `To ${trade.recipientName}`}
                </span>
                <StatusBadge status={trade.status} />
              </div>
              <div className="customer-exchange-pair">
                <div>
                  <span>{trade.requestedBenefitId ? 'Offered benefit' : 'A gift'}</span>
                  <h2>{trade.benefitTitle}</h2>
                </div>
                <ArrowRightLeft size={23} aria-hidden="true" />
                <div>
                  <span>{trade.requestedBenefitId ? 'In return for' : 'Nothing in return'}</span>
                  <h2>{trade.requestedBenefitTitle ?? 'A kind thought.'}</h2>
                </div>
              </div>
              <p className="public-small">
                Created {friendlyDate(trade.createdAt)} · Offer expires{' '}
                {friendlyDate(trade.expiresAt)}
              </p>
              {trade.status === 'PENDING' && (
                <div className="customer-exchange-actions">
                  {incoming ? (
                    <>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => choose(trade, 'ACCEPT')}
                      >
                        Review and accept
                      </button>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => choose(trade, 'DECLINE')}
                      >
                        Decline offer
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => choose(trade, 'CANCEL')}
                    >
                      Cancel offer
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {selected && (
        <Modal
          busy={busy}
          title={
            selected.action === 'ACCEPT'
              ? 'Accept this offer?'
              : selected.action === 'DECLINE'
                ? 'Decline this offer?'
                : 'Cancel this offer?'
          }
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <p>{selected.trade.benefitTitle}</p>
          <p className="public-small">
            {selected.action === 'ACCEPT'
              ? selected.trade.requestedBenefitTitle
                ? `You will receive this benefit and give ${selected.trade.requestedBenefitTitle} in return. The exchange completes together after the server confirms both benefits are eligible.`
                : 'This benefit will move to your account after the server confirms the offer is still available.'
              : 'The offered benefit will be released from this pending exchange. No points or cash will move.'}
          </p>
          {error && <ErrorNotice message={error} retry={reload} />}
          <div className="customer-modal-actions">
            <button
              className="btn btn-secondary"
              disabled={busy}
              type="button"
              onClick={() => setSelected(null)}
            >
              Go back
            </button>
            <button className="btn btn-primary" disabled={busy} type="button" onClick={act}>
              {busy
                ? 'Updating offer…'
                : selected.action === 'ACCEPT'
                  ? 'Accept offer'
                  : selected.action === 'DECLINE'
                    ? 'Decline offer'
                    : 'Cancel offer'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

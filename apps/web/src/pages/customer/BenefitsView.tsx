import type { Benefit, Trade } from '@7even/contracts';
import { ArrowUpRight, Gift, Ticket } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EmptyState,
  ErrorNotice,
  Field,
  Modal,
  StatusBadge,
  useFeedback,
} from '../../components/ui.tsx';
import { api } from '../../lib/api.ts';
import { friendlyDate } from '../public/PublicShell.tsx';

export function BenefitsView({ benefits, reload }: { benefits: Benefit[]; reload: () => void }) {
  const { showSuccess } = useFeedback();
  const [shown, setShown] = useState<string | null>(null);
  const [give, setGive] = useState<Benefit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());
  async function offer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!give) return;
    const form = new FormData(event.currentTarget);
    const requestedBenefitId = String(form.get('requestedBenefitId') ?? '').trim();
    setError(null);
    setBusy(true);
    try {
      await api<Trade>('/trades', {
        method: 'POST',
        body: {
          benefitId: give.id,
          recipientEmail: String(form.get('recipientEmail') ?? '').trim(),
          ...(requestedBenefitId ? { requestedBenefitId } : {}),
        },
        idempotencyKey: attempt.current,
      });
      showSuccess(
        <>
          The benefit is reserved while the other person decides.{' '}
          <Link to="/app/exchange">View your exchanges</Link>
        </>,
        requestedBenefitId ? 'Swap offer sent.' : 'Gift offer sent.',
      );
      setGive(null);
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not send this offer. Check the details and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!benefits.length)
    return (
      <EmptyState
        title="A little something for next time."
        description="Rewards you claim with your points will appear here with their code and use-by date."
        action={
          <Link to="/app/points" className="btn btn-primary">
            See what your points can do <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        }
      />
    );
  return (
    <>
      <div className="customer-benefit-grid">
        {benefits.map((benefit) => (
          <article className="customer-benefit" key={benefit.id}>
            <div className="customer-benefit-top">
              <Ticket size={27} aria-hidden="true" />
              <StatusBadge status={benefit.status} />
            </div>
            <span className="public-eyebrow">{benefit.businessName}</span>
            <h2>{benefit.title}</h2>
            <p>{benefit.description}</p>
            <dl>
              <div>
                <dt>Use before</dt>
                <dd>{friendlyDate(benefit.expiresAt)}</dd>
              </div>
              <div>
                <dt>Can be given or swapped</dt>
                <dd>{benefit.transferable ? 'Yes, while unused' : 'For your use only'}</dd>
              </div>
            </dl>
            {benefit.status === 'AVAILABLE' && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-expanded={shown === benefit.id}
                  onClick={() => setShown(shown === benefit.id ? null : benefit.id)}
                >
                  {shown === benefit.id ? 'Hide your benefit code' : 'Show your benefit code'}
                </button>
                {shown === benefit.id && (
                  <div className="customer-benefit-code">
                    <p>Show this to the issuing business when you use the benefit.</p>
                    <code>{benefit.redemptionCode}</code>
                    <dl className="customer-benefit-verification">
                      <div>
                        <dt>Benefit reference</dt>
                        <dd>
                          <code>{benefit.id}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Current version</dt>
                        <dd>{benefit.revision}</dd>
                      </div>
                    </dl>
                    <p>
                      Keep this code private. Show the business the code, reference and current
                      version when you use the benefit. Staff confirm when it has been used.
                    </p>
                  </div>
                )}
                {benefit.transferable && (
                  <button
                    className="public-text-link"
                    type="button"
                    onClick={() => {
                      setGive(benefit);
                      setError(null);
                      attempt.current = crypto.randomUUID();
                    }}
                  >
                    <Gift size={15} aria-hidden="true" /> Give or offer a swap
                  </button>
                )}
              </>
            )}
            <details className="customer-benefit-reference">
              <summary>Benefit reference</summary>
              <code>{benefit.id}</code>
              <p>
                Share this reference only when arranging a swap. Keep your redemption code private.
              </p>
            </details>
          </article>
        ))}
      </div>
      {give && (
        <Modal
          title="Give a little something."
          busy={busy}
          onClose={() => {
            if (!busy) setGive(null);
          }}
        >
          <form
            onSubmit={offer}
            onChange={() => {
              attempt.current = crypto.randomUUID();
            }}
          >
            <p>
              {give.title} · {give.businessName}
            </p>
            <Field label="Their 7even email address">
              <input
                className="field-input"
                type="email"
                name="recipientEmail"
                required
                maxLength={254}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Their benefit reference, if you want a swap"
              hint="Leave this empty to offer a gift. For a swap, ask for their benefit reference, never their redemption code."
            >
              <input
                className="field-input"
                name="requestedBenefitId"
                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                autoComplete="off"
              />
            </Field>
            <p className="public-small">
              They must already have a 7even account. Your benefit is reserved until they accept,
              decline or the offer expires. A pending offer can be cancelled.
            </p>
            {error && <ErrorNotice message={error} />}
            <div className="customer-modal-actions">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => setGive(null)}
              >
                Keep this benefit
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Sending your offer…' : 'Send offer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

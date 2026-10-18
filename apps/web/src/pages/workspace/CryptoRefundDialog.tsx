import type { Payment } from '@7even/contracts';
import { useState } from 'react';
import {
  ErrorNotice,
  Field,
  Loading,
  Modal,
  StatusBadge,
  useFeedback,
} from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import {
  formatUsdc,
  prepareUsdcTransfer,
  walletRequestRejected,
  type PreparedTokenTransfer,
} from '../../lib/paymentWallet.ts';

function storedReturn(paymentId: string): string {
  try {
    return sessionStorage.getItem(`seven:crypto-return:${paymentId}`) ?? '';
  } catch {
    return '';
  }
}

export function CryptoRefundDialog({
  paymentId,
  onClose,
  onDone,
}: {
  paymentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: payment, loading, error, reload } = useApi<Payment>(`/payments/${paymentId}`);
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hashInput, setHashInput] = useState('');
  const [sentHash, setSentHash] = useState(() =>
    /^0x[0-9a-fA-F]{64}$/.test(storedReturn(paymentId)) ? storedReturn(paymentId) : '',
  );
  const [uncertain, setUncertain] = useState(() => storedReturn(paymentId) === 'pending');
  const [prepared, setPrepared] = useState<PreparedTokenTransfer | null>(null);
  const quote = payment?.crypto?.quote;
  const refund = payment?.crypto?.refund;
  const hash = refund?.transactionHash ?? (sentHash || hashInput);
  async function verify(returnHash = hash) {
    if (!payment || !refund) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = await api<Payment>(
        `/payments/${payment.id}/${payment.mode === 'mock' ? 'dev-refund-complete' : 'crypto-refund'}`,
        {
          method: 'POST',
          body: payment.mode === 'mock' ? {} : { transactionHash: returnHash },
          idempotencyKey: `crypto-return:${payment.id}:${crypto.randomUUID()}`,
        },
      );
      showSuccess(
        next.status === 'REFUNDED'
          ? 'The returned USDC was verified. The refund and commission reversal are recorded.'
          : 'The return is awaiting final confirmation. Keep its hash and check again. Do not send another return.',
        next.status === 'REFUNDED' ? 'Refund verified.' : 'Return is being checked.',
      );
      reload();
      onDone();
      if (next.status === 'REFUNDED') onClose();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'The return could not be verified. Check its recorded transaction before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    if (!quote || !refund || hash || uncertain) return;
    setBusy(true);
    setActionError(null);
    try {
      setPrepared(
        await prepareUsdcTransfer({
          chainId: quote.chainId,
          tokenAddress: quote.tokenAddress,
          payerAddress: quote.recipientAddress,
          recipientAddress: refund.recipientAddress,
          amountAtoms: refund.amountAtoms,
        }),
      );
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'The business wallet could not prepare this return.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!prepared) return;
    setBusy(true);
    setActionError(null);
    try {
      setUncertain(true);
      try {
        sessionStorage.setItem(`seven:crypto-return:${paymentId}`, 'pending');
      } catch {
        /* Preserve the in-memory guard if session storage is unavailable. */
      }
      const result = await prepared.send();
      setSentHash(result);
      setUncertain(false);
      try {
        sessionStorage.setItem(`seven:crypto-return:${paymentId}`, result);
      } catch {
        /* The visible hash remains available. */
      }
      setPrepared(null);
      await verify(result);
    } catch (cause) {
      setPrepared(null);
      if (walletRequestRejected(cause)) {
        setUncertain(false);
        try {
          sessionStorage.removeItem(`seven:crypto-return:${paymentId}`);
        } catch {
          /* A known wallet rejection did not broadcast a transfer. */
        }
      }
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'The wallet outcome is uncertain. Check its activity before another return.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={prepared ? 'Review the USDC return.' : 'Return USDC to the original payer.'}
      busy={busy}
      onClose={prepared ? () => setPrepared(null) : onClose}
    >
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {payment && quote && refund ? (
        <div className="stack">
          <p>
            Return <strong>{formatUsdc(refund.amountAtoms)} USDC</strong> on{' '}
            {quote.chainId === 84532 ? 'Base Sepolia testnet' : 'Base'}.
          </p>
          <dl className="payment-details crypto-details">
            <div>
              <dt>From approved business wallet</dt>
              <dd>
                <code>{quote.recipientAddress}</code>
              </dd>
            </div>
            <div>
              <dt>To original payer wallet</dt>
              <dd>
                <code>{refund.recipientAddress}</code>
              </dd>
            </div>
            <div>
              <dt>Refund status</dt>
              <dd>
                <StatusBadge status={refund.status} />
              </dd>
            </div>
          </dl>
          <p className="small-copy">
            The business sends this return from its own wallet. 7even checks the exact transfer and
            final confirmation before marking it refunded and reversing commission owed.
          </p>
          {payment.mode === 'mock' ? (
            <>
              <p className="notice">
                Local test return. No wallet, gas payment or tokens are involved.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || payment.status === 'REFUNDED'}
                onClick={() => void verify()}
              >
                {busy ? 'Recording test…' : 'Complete local return test'}
              </button>
            </>
          ) : prepared ? (
            <>
              <p>
                Estimated execution fee: <strong>{prepared.estimatedFeeEth} ETH</strong>.
              </p>
              <p className="small-copy">
                Your wallet may include additional network costs. Review its final fee before
                approving.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void send()}
              >
                {busy ? 'Waiting for business wallet…' : 'Open wallet to return USDC'}
              </button>
            </>
          ) : (
            <>
              {hash && <code className="crypto-address">{hash}</code>}
              {uncertain && (
                <p className="notice">
                  The wallet outcome is uncertain. Find the original hash in wallet activity. Do not
                  send another return.
                </p>
              )}
              {!hash && !uncertain && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void prepare()}
                >
                  Review return in business wallet
                </button>
              )}
              {!refund.transactionHash && !sentHash && (
                <Field
                  label="Already returned? Transaction hash"
                  hint="Check the original return without sending another transfer."
                >
                  <input
                    value={hashInput}
                    onChange={(event) => setHashInput(event.target.value.trim())}
                    placeholder="0x…"
                    maxLength={66}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                  />
                </Field>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(hash)}
                onClick={() => void verify()}
              >
                {busy ? 'Checking return…' : 'Check return status'}
              </button>
            </>
          )}
        </div>
      ) : (
        !loading && (
          <ErrorNotice message="There is no direct-wallet refund intent for this payment. Review the reservation first." />
        )
      )}
      {actionError && <ErrorNotice message={actionError} />}
    </Modal>
  );
}

import type { Payment } from '@7even/contracts';
import { ArrowUpRight, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Money,
  StatusBadge,
  useFeedback,
} from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import {
  formatUsdc,
  prepareUsdcTransfer,
  signWalletMessage,
  walletRequestRejected,
  type PreparedTokenTransfer,
} from '../../lib/paymentWallet.ts';
import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';

function savedTransaction(paymentId: string | undefined): string {
  try {
    return paymentId ? (sessionStorage.getItem(`seven:crypto-transfer:${paymentId}`) ?? '') : '';
  } catch {
    return '';
  }
}

export function CryptoCheckoutPage() {
  const { paymentId } = useParams();
  return <CryptoCheckoutContent key={paymentId} paymentId={paymentId} />;
}

function CryptoCheckoutContent({ paymentId }: { paymentId: string | undefined }) {
  const { showSuccess, showError } = useFeedback();
  const { data, loading, error, reload } = useApi<Payment>(
    paymentId ? `/payments/${encodeURIComponent(paymentId)}` : null,
  );
  const [observed, setObserved] = useState<Payment | null>(null);
  const payment =
    observed && (!data || (observed.verifiedAt && !data.verifiedAt)) ? observed : data;
  const cryptoPayment = payment?.crypto;
  const quote = cryptoPayment?.quote;
  const [transactionHash, setTransactionHash] = useState(() =>
    savedTransaction(paymentId) === 'pending' ? '' : savedTransaction(paymentId),
  );
  const [submittedHash, setSubmittedHash] = useState(() =>
    /^0x[0-9a-fA-F]{64}$/.test(savedTransaction(paymentId)) ? savedTransaction(paymentId) : '',
  );
  const [uncertainSend, setUncertainSend] = useState(
    () => savedTransaction(paymentId) === 'pending',
  );
  const [prepared, setPrepared] = useState<PreparedTokenTransfer | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const signature = useRef<string | undefined>(undefined);
  const serverHash = cryptoPayment?.transactionHash ?? null;
  const hash = serverHash ?? (submittedHash || transactionHash);
  const isMock = payment?.mode === 'mock';
  const closed = payment && !['PENDING', 'UNKNOWN'].includes(payment.status);
  const expired = quote ? now >= Date.parse(quote.expiresAt) : true;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function verify(hashToCheck = hash) {
    if (!payment || !quote) return;
    setBusy(true);
    setActionError(null);
    try {
      let next: Payment;
      if (isMock) {
        next = await api<Payment>(`/payments/${payment.id}/dev-complete`, {
          method: 'POST',
          body: { outcome: 'SUCCESS' },
          idempotencyKey: `mock-crypto:${payment.id}`,
        });
      } else {
        if (!/^0x[0-9a-fA-F]{64}$/.test(hashToCheck))
          throw new Error('Enter the full transaction hash from your wallet.');
        if (!cryptoPayment?.payerVerified && !signature.current)
          signature.current = await signWalletMessage(
            quote.message,
            quote.chainId,
            quote.payerAddress,
          );
        next = await api<Payment>('/payments/verify', {
          method: 'POST',
          body: {
            reference: payment.reference,
            transactionId: hashToCheck,
            ...(signature.current ? { walletSignature: signature.current } : {}),
          },
          idempotencyKey: `crypto-verify:${payment.id}:${crypto.randomUUID()}`,
        });
      }
      setObserved(next);
      reload();
      if (next.status === 'PAID')
        showSuccess(
          isMock
            ? 'The local USDC test payment is recorded. No tokens moved.'
            : 'The server verified your USDC transfer. Your booking status is saved.',
          'Payment checked.',
        );
      else if (next.status === 'REVIEW_REQUIRED')
        showError(
          'This transfer needs review. Do not send another payment. The team can review the recorded evidence.',
        );
      else
        showSuccess(
          'Your transfer is still awaiting final confirmation on Base. Check again here. Do not send it again.',
          'Transfer is being checked.',
        );
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'Your transfer could not be checked. Keep its hash and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function reviewTransfer() {
    if (!quote || expired || hash || uncertainSend) return;
    setBusy(true);
    setActionError(null);
    try {
      signature.current = await signWalletMessage(quote.message, quote.chainId, quote.payerAddress);
      const transfer = await prepareUsdcTransfer({
        chainId: quote.chainId,
        tokenAddress: quote.tokenAddress,
        payerAddress: quote.payerAddress,
        recipientAddress: quote.recipientAddress,
        amountAtoms: quote.amountAtoms,
      });
      setPrepared(transfer);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'The wallet could not prepare this transfer.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function sendTransfer() {
    if (!prepared || !quote || !payment) return;
    if (Date.now() >= Date.parse(quote.expiresAt)) {
      setPrepared(null);
      setActionError(
        'This token quote has expired. Do not send it. Open your booking to check its current status.',
      );
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      setUncertainSend(true);
      try {
        sessionStorage.setItem(`seven:crypto-transfer:${payment.id}`, 'pending');
      } catch {
        /* A storage failure does not authorize another transfer. */
      }
      const submitted = await prepared.send();
      setSubmittedHash(submitted);
      setTransactionHash(submitted);
      setUncertainSend(false);
      try {
        sessionStorage.setItem(`seven:crypto-transfer:${payment.id}`, submitted);
      } catch {
        /* The on-screen hash remains available when session storage is disabled. */
      }
      setPrepared(null);
      await verify(submitted);
    } catch (cause) {
      setPrepared(null);
      if (walletRequestRejected(cause)) {
        setUncertainSend(false);
        try {
          sessionStorage.removeItem(`seven:crypto-transfer:${payment.id}`);
        } catch {
          /* Only a known wallet rejection clears the local send guard. */
        }
      }
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'The wallet outcome could not be confirmed. Check its activity before trying again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-page customer-page">
      <PublicHeader />
      <main id="main-content" className="public-container payment-page">
        <section
          className="payment-card crypto-payment-card"
          aria-labelledby="crypto-payment-title"
        >
          <Wallet size={35} aria-hidden="true" />
          <span className="public-eyebrow">Pay the business directly</span>
          <h1 id="crypto-payment-title">USDC, with the details in view.</h1>
          <p>
            Your booking is priced in naira. This checkout locks the USDC amount and the business
            wallet before you send.
          </p>
          {loading && <Loading />}
          {error && <ErrorNotice message={error} retry={reload} />}
          {payment && (!quote || payment.provider !== 'crypto') && (
            <ErrorNotice message="This payment does not have a USDC quote. Open your bookings to continue with its recorded method." />
          )}
          {payment && quote && (
            <>
              {isMock && (
                <p className="notice">
                  Local USDC test checkout. No wallet connection, gas payment or token transfer is
                  needed.
                </p>
              )}
              <div className="payment-amount">
                {formatUsdc(quote.amountAtoms)} <span>USDC</span>
              </div>
              <dl className="payment-details crypto-details">
                <div>
                  <dt>Booking price</dt>
                  <dd>
                    <Money minor={payment.amountMinor} />
                  </dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>{quote.chainId === 84532 ? 'Base Sepolia testnet' : 'Base'} · native USDC</dd>
                </div>
                <div>
                  <dt>Business wallet</dt>
                  <dd>
                    <code>{quote.recipientAddress}</code>
                  </dd>
                </div>
                <div>
                  <dt>Paying wallet</dt>
                  <dd>
                    <code>{quote.payerAddress}</code>
                  </dd>
                </div>
                <div>
                  <dt>Token contract</dt>
                  <dd>
                    <code>{quote.tokenAddress}</code>
                  </dd>
                </div>
                <div>
                  <dt>Locked valuation</dt>
                  <dd>
                    ₦{quote.rateNgnPerUsdc} per USDC{' '}
                    <small>
                      Indicative rate from {quote.rateSource}. This is a checkout valuation, not a
                      currency exchange.
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Quote expires</dt>
                  <dd>
                    {new Intl.DateTimeFormat('en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Africa/Lagos',
                    }).format(new Date(quote.expiresAt))}{' '}
                    WAT
                  </dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    <StatusBadge status={payment.status} />
                  </dd>
                </div>
                <div>
                  <dt>Wallet delivery</dt>
                  <dd>
                    <StatusBadge status={payment.settlementStatus} />
                  </dd>
                </div>
              </dl>
              <p className="small-copy">
                All quoted USDC goes to the business. The business separately owes 7even 10% of the
                service price after discounts, excluding stated taxes. This is included in your
                booking price.
              </p>
              <p className="small-copy">
                Your wallet needs ETH on {quote.chainId === 84532 ? 'Base Sepolia' : 'Base'} for the
                network fee. Review that fee before approving. Send only native USDC on the network
                shown.
              </p>
              <p className="small-copy">
                Use a regular wallet account that signs Ethereum messages. These accounts are called
                externally owned accounts. Smart contract wallets are not supported yet.
              </p>
              {hash && (
                <p className="crypto-transaction-record">
                  <strong>Recorded transaction</strong>
                  <code>{hash}</code>
                  <span>
                    Keep this reference. Do not send another payment while this transfer is being
                    checked.
                  </span>
                </p>
              )}
              {uncertainSend && (
                <p className="notice">
                  The wallet outcome is uncertain. Check your wallet activity and paste the original
                  transaction hash below. Do not send again.
                </p>
              )}
              {expired && !closed && !hash && (
                <p className="notice">
                  This token quote has expired. Do not send it. Open your booking to check
                  availability before starting again.
                </p>
              )}
              {!closed && !isMock && (
                <div className="stack">
                  {!hash && !uncertainSend && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || expired}
                      onClick={() => void reviewTransfer()}
                    >
                      {busy ? 'Waiting for wallet…' : 'Review in your wallet'}
                    </button>
                  )}
                  {!serverHash && !submittedHash && (
                    <Field
                      label="Already sent? Enter your transaction hash"
                      hint="Use the original transfer. This checks its status without sending again."
                    >
                      <input
                        value={transactionHash === 'pending' ? '' : transactionHash}
                        onChange={(event) => setTransactionHash(event.target.value.trim())}
                        placeholder="0x…"
                        maxLength={66}
                        spellCheck={false}
                        autoComplete="off"
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
                    {busy ? 'Checking transfer…' : 'Check transfer status'}
                  </button>
                  <p className="small-copy">
                    A transfer may need several minutes to reach final confirmation. The server
                    checks the chain, token, amount, payer and business wallet.
                  </p>
                </div>
              )}
              {!closed && isMock && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || expired}
                  onClick={() => void verify()}
                >
                  {busy ? 'Recording test…' : 'Complete local USDC test'}
                </button>
              )}
              {closed && (
                <p className="notice">
                  <ShieldCheck size={18} aria-hidden="true" />{' '}
                  {payment.status === 'PAID'
                    ? 'The transfer has been verified. Check your booking for its current reservation status.'
                    : 'This payment has a recorded outcome. Do not send another transfer against this quote.'}
                </p>
              )}
            </>
          )}
          <Link to="/app/bookings" className="btn btn-secondary">
            View your bookings <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          {actionError && <ErrorNotice message={actionError} />}
        </section>
      </main>
      <PublicFooter />
      {prepared && (
        <Modal title="Review the USDC transfer." busy={busy} onClose={() => setPrepared(null)}>
          <div className="stack">
            <p>
              <strong>{formatUsdc(prepared.amountAtoms)} USDC</strong> goes directly to this
              business wallet.
            </p>
            <code className="crypto-address">{prepared.recipientAddress}</code>
            <p>
              Estimated execution fee: <strong>{prepared.estimatedFeeEth} ETH</strong>.
            </p>
            <p className="small-copy">
              Your wallet may include additional network costs. Review its final fee before
              approving. 7even adds no crypto processing fee.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setPrepared(null)}
              >
                Go back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || expired}
                onClick={() => void sendTransfer()}
              >
                {busy ? 'Waiting for wallet…' : 'Open wallet to send'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

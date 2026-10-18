import type { BusinessPaymentAccount } from '@7even/contracts';
import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { ErrorNotice, Loading, Money, StatusBadge, useFeedback } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { connectPaymentWallet, signWalletMessage } from '../../lib/paymentWallet.ts';

export function BusinessPayments() {
  const { data, loading, error, reload } = useApi<{
    accounts: BusinessPaymentAccount[];
    commissionOwedMinor: string;
    chainId: number;
  }>('/business/payment-accounts');
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function submitWallet() {
    if (!data) return;
    setBusy(true);
    setActionError(null);
    try {
      const address = await connectPaymentWallet(data.chainId);
      const challenge = await api<{ message: string; revision: number; expiresAt: string }>(
        `/business/payment-wallet-challenge?address=${encodeURIComponent(address)}`,
      );
      const signature = await signWalletMessage(challenge.message, data.chainId, address);
      await api('/business/payment-wallet', {
        method: 'POST',
        body: {
          walletAddress: address,
          signature,
          expectedRevision: challenge.revision,
          expiresAt: challenge.expiresAt,
        },
        idempotencyKey: crypto.randomUUID(),
      });
      showSuccess(
        'Your wallet ownership was checked. 7even must approve the destination before USDC checkout is available.',
        'Wallet submitted for review.',
      );
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The wallet could not be submitted.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel business-payment-settings" aria-labelledby="payment-settings-title">
      <h2 id="payment-settings-title">Where your payments go</h2>
      <p className="small-copy">
        Paystack handles totals up to ₦50,000. Flutterwave handles totals above ₦50,000. Each
        provider needs its own verified business subaccount.
      </p>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {data && (
        <>
          <ul className="payment-account-list">
            {(['paystack', 'flutterwave', 'crypto'] as const).map((provider) => {
              const account = data.accounts.find((item) => item.provider === provider);
              return (
                <li key={provider}>
                  <div>
                    <strong>
                      {provider === 'crypto'
                        ? 'USDC business wallet'
                        : provider === 'paystack'
                          ? 'Paystack'
                          : 'Flutterwave'}
                    </strong>
                    <StatusBadge status={account?.status ?? 'NOT_CONFIGURED'} />
                  </div>
                  {account ? (
                    <>
                      <p>
                        {account.accountLabel}
                        {account.mode === 'mock' ? ' · local test account' : ''}
                      </p>
                      <code className="crypto-address">{account.accountCode}</code>
                    </>
                  ) : (
                    <p className="small-copy">
                      {provider === 'crypto'
                        ? 'Connect your business wallet to start ownership verification.'
                        : 'Ask 7even to review the subaccount issued for your business.'}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="crypto-commission-note">
            <strong>
              7even commission owed: <Money minor={data.commissionOwedMinor} />
            </strong>
            <p className="small-copy">
              USDC goes directly to your approved wallet. The 10% service commission is recorded
              separately as an amount your business owes 7even. A wallet delivery is not a bank
              settlement.
            </p>
          </div>
          <p className="small-copy">
            Wallet network: {data.chainId === 84532 ? 'Base Sepolia testnet' : 'Base'}. Sign only
            the ownership message shown in your wallet. 7even never asks for your seed phrase or
            signs transfers for you.
          </p>
          <p className="small-copy">
            Use a regular wallet account that signs Ethereum messages, also called an externally
            owned account. Smart contract wallets are not supported yet.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void submitWallet()}
          >
            <Wallet size={17} aria-hidden="true" />
            {busy ? 'Waiting for wallet…' : 'Connect business wallet'}
          </button>
        </>
      )}
      {actionError && <ErrorNotice message={actionError} />}
    </section>
  );
}

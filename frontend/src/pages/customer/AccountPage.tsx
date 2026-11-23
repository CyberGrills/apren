import type { Benefit, CustomerOverview, Reward, Trade } from '@7even/contracts';
import { ArrowUpRight, Gift, Repeat2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, StatusBadge, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';
import { ActivityView } from './ActivityView.tsx';
import { BookingList } from './BookingList.tsx';
import { ProfileView } from './ProfileView.tsx';
import { useSevenLanguage } from '../../lib/sevenLanguage.ts';

type AccountTab = 'bookings' | 'profile' | 'activity' | 'wallet' | 'benefits' | 'exchange';
const headings: Record<AccountTab, { eyebrow: string; title: string; description: string }> = {
  bookings: { eyebrow: 'Your stays', title: 'Something to look forward to.', description: 'Your hotel and apartment reservations, with their current status.' },
  activity: { eyebrow: 'Your updates', title: 'A word about your plans.', description: 'Booking updates and the things that need your attention.' },
  profile: { eyebrow: 'Your profile', title: 'Make yourself at home.', description: 'The details that belong to your 7even account.' },
  wallet: { eyebrow: '7EVEN points wallet', title: 'Your points. Your next experience.', description: 'Track points earned from completed eligible bookings and use them for published rewards.' },
  benefits: { eyebrow: 'Your benefits', title: 'Good things you have earned.', description: 'View, use and keep track of rewards you have redeemed.' },
  exchange: { eyebrow: 'Benefits exchange', title: 'Share a benefit. Make someone’s day.', description: 'Send eligible transferable benefits to another 7EVEN customer or respond to an invitation.' },
};

export function AccountPage({ tab = 'bookings' }: { tab?: AccountTab }) {
  const { user } = useSession();
  const language = useSevenLanguage();
  const { data, loading, error, reload } = useApi<CustomerOverview>(user ? '/me/overview' : null);
  const rewards = useApi<Reward[]>(user && tab === 'wallet' ? '/rewards' : null);
  const heading = language === 'pcm' ? {
    bookings: { eyebrow: 'Your stays', title: 'Your next enjoyment dey here.', description: 'See your hotel and apartment bookings, plus their current status.' },
    activity: { eyebrow: 'Your updates', title: 'Wetin dey happen with your plans.', description: 'Booking updates and anything wey need your attention.' },
    profile: { eyebrow: 'Your profile', title: 'Make yourself comfortable.', description: 'Your personal details for your 7even account.' },
    wallet: { eyebrow: '7EVEN points wallet', title: 'Your points dey work for you.', description: 'See the points you earn from completed eligible bookings and use them for rewards.' },
    benefits: { eyebrow: 'Your benefits', title: 'Enjoy wetin you don earn.', description: 'See and manage the rewards you don redeem.' },
    exchange: { eyebrow: 'Benefits exchange', title: 'Share better things.', description: 'Send eligible benefits to another 7EVEN customer or respond to an invitation.' },
  }[tab] : headings[tab];

  return (
    <div className="public-page customer-page">
      <PublicHeader />
      <main id="main-content" className="public-container customer-main">
        <div className="customer-page-heading">
          <div>
            <span className="public-eyebrow">{heading.eyebrow}</span>
            <h1>{heading.title}</h1>
            <p>{heading.description}</p>
          </div>
          <Link className="public-text-link" to="/explore">
            {language === 'pcm' ? 'Find your next place' : 'Find your next plan'} <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <nav className="customer-tabs" aria-label="Your account">
          {[
            ['profile', 'Profile'],
            ['bookings', 'Bookings'],
            ['wallet', 'Points wallet'],
            ['benefits', 'Benefits'],
            ['exchange', 'Exchange'],
            ['activity', 'Updates'],
          ].map(([value, label]) => (
            <NavLink key={value} to={`/app/${value}`} aria-current={value === tab ? 'page' : undefined}>
              {label}
            </NavLink>
          ))}
        </nav>
        {loading && <Loading />}
        {error && <ErrorNotice message={error} retry={reload} />}
        {!user && (
          <p>{language === 'pcm' ? 'Sign in make you see your account.' : 'Sign in to see your account.'} <Link to="/login">Sign in</Link></p>
        )}
        {data && user && (
          <div className="customer-content">
            {tab === 'bookings' && <BookingList reservations={data.reservations} reload={reload} />}
            {tab === 'profile' && <ProfileView user={user} />}
            {tab === 'activity' && <ActivityView notifications={data.notifications} reload={reload} />}
            {tab === 'wallet' && (
              <WalletView
                balance={data.points.balance}
                available={data.points.available}
                reserved={data.points.reserved}
                shortfall={data.points.shortfall}
                entries={data.points.entries}
                rewards={rewards.data ?? []}
                rewardsLoading={rewards.loading}
                rewardsError={rewards.error}
                reload={reload}
                reloadRewards={rewards.reload}
              />
            )}
            {tab === 'benefits' && <BenefitsView benefits={data.benefits} />}
            {tab === 'exchange' && <ExchangeView benefits={data.benefits} trades={data.trades} userId={user.id} reload={reload} />}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function WalletView({
  balance, available, reserved, shortfall, entries, rewards, rewardsLoading, rewardsError, reload, reloadRewards,
}: {
  balance: number; available: number; reserved: number; shortfall: number;
  entries: { id: string; amount: number; entryType: string; description: string; createdAt: string; sourceId: string }[];
  rewards: Reward[]; rewardsLoading: boolean; rewardsError: string | null;
  reload: () => void; reloadRewards: () => void;
}) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  async function redeem(reward: Reward) {
    setBusy(reward.id); setActionError(null);
    try {
      await api(`/rewards/${reward.id}/redeem`, { method: 'POST', idempotencyKey: crypto.randomUUID(), body: {} });
      showSuccess(`${reward.title} has been added to your benefits.`, 'Reward redeemed.');
      reload(); reloadRewards();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'This reward could not be redeemed. Refresh and try again.');
    } finally { setBusy(null); }
  }
  return (
    <section className="customer-value-view">
      <div className="points-wallet-card">
        <div className="points-wallet-heading"><span><Wallet size={19} aria-hidden="true" /> 7EVEN POINTS</span><span className="public-small">Rewards balance</span></div>
        <strong className="points-wallet-balance">{balance.toLocaleString('en-NG')}</strong>
        <p>Points are earned after an eligible booking is completed. They are not cash and cannot be withdrawn as money.</p>
        <div className="points-wallet-stats">
          <div><span>Available</span><strong>{available.toLocaleString('en-NG')}</strong></div>
          <div><span>Reserved</span><strong>{reserved.toLocaleString('en-NG')}</strong></div>
          <div><span>Shortfall</span><strong>{shortfall.toLocaleString('en-NG')}</strong></div>
        </div>
      </div>
      {actionError && <ErrorNotice message={actionError} retry={() => { reload(); reloadRewards(); }} />}
      <div className="customer-value-section">
        <div className="customer-value-section-heading"><div><span className="public-eyebrow">REDEEM YOUR POINTS</span><h2>Available rewards</h2></div></div>
        {rewardsLoading && <Loading />}
        {rewardsError && <ErrorNotice message={rewardsError} retry={reloadRewards} />}
        {!rewardsLoading && !rewards.length && <EmptyState title="No published rewards yet" description="When a participating business publishes a reward, it will appear here." />}
        <div className="customer-reward-grid">
          {rewards.map(reward => (
            <article className="customer-reward-card" key={reward.id}>
              <span className="customer-reward-business">{reward.businessName}</span>
              <h3>{reward.title}</h3>
              <p>{reward.description}</p>
              <div className="customer-reward-meta"><strong>{reward.pointsCost.toLocaleString('en-NG')} points</strong><span>{reward.remaining} remaining</span></div>
              <button className="btn btn-primary btn-small" type="button" disabled={busy === reward.id || available < reward.pointsCost || reward.remaining < 1} onClick={() => void redeem(reward)}>
                {busy === reward.id ? 'Redeeming…' : available < reward.pointsCost ? 'Not enough points' : 'Redeem reward'}
              </button>
            </article>
          ))}
        </div>
      </div>
      <div className="customer-value-section">
        <span className="public-eyebrow">POINTS ACTIVITY</span>
        <h2>Your ledger</h2>
        {!entries.length ? <p className="small-copy">Your completed-booking points and reward activity will appear here.</p> : (
          <div className="points-ledger">
            {entries.map(entry => (
              <div className="points-ledger-row" key={entry.id}>
                <div><strong>{entry.description}</strong><span>{new Date(entry.createdAt).toLocaleString('en-NG')}</span></div>
                <strong className={entry.amount >= 0 ? 'points-credit' : 'points-debit'}>{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString('en-NG')}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BenefitsView({ benefits }: { benefits: Benefit[] }) {
  if (!benefits.length) return <EmptyState title="Your benefits will appear here" description="Redeem points for a published business reward and your benefit will be stored here." />;
  return (
    <section className="customer-benefit-grid">
      {benefits.map(benefit => (
        <article className="customer-benefit-card" key={benefit.id}>
          <div className="customer-benefit-top"><Gift size={20} aria-hidden="true" /><StatusBadge status={benefit.status} /></div>
          <span className="customer-reward-business">{benefit.businessName}</span>
          <h2>{benefit.title}</h2>
          <p>{benefit.description}</p>
          <div className="customer-benefit-code"><span>Redemption code</span><strong>{benefit.redemptionCode}</strong></div>
          <p className="public-small">Expires {new Date(benefit.expiresAt).toLocaleDateString('en-NG')}</p>
          <p className="public-small">{benefit.transferable ? 'Eligible for transfer or exchange.' : 'For your use only.'}</p>
        </article>
      ))}
    </section>
  );
}

function ExchangeView({ benefits, trades, userId, reload }: { benefits: Benefit[]; trades: Trade[]; userId: string; reload: () => void }) {
  const { showSuccess } = useFeedback();
  const transferable = benefits.filter(item => item.transferable && item.status === 'AVAILABLE');
  const [benefitId, setBenefitId] = useState(transferable[0]?.id ?? '');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [requestedBenefitId, setRequestedBenefitId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function propose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('propose'); setError(null);
    try {
      await api('/trades', { method: 'POST', idempotencyKey: crypto.randomUUID(), body: { benefitId, recipientEmail: recipientEmail.trim(), ...(requestedBenefitId.trim() ? { requestedBenefitId: requestedBenefitId.trim() } : {}) } });
      showSuccess('Your benefit invitation has been sent inside 7EVEN.', 'Exchange invitation sent.');
      setRecipientEmail(''); setRequestedBenefitId(''); reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The exchange invitation could not be sent.'); }
    finally { setBusy(null); }
  }
  async function act(trade: Trade, action: 'ACCEPT' | 'DECLINE' | 'CANCEL') {
    setBusy(trade.id); setError(null);
    try {
      await api(`/trades/${trade.id}/actions`, { method: 'POST', idempotencyKey: crypto.randomUUID(), body: { action, expectedRevision: trade.revision } });
      showSuccess(`Invitation ${action.toLowerCase()}ed.`, 'Exchange updated.');
      reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The exchange could not be updated.'); }
    finally { setBusy(null); }
  }
  return (
    <section className="customer-value-view">
      <div className="customer-exchange-note"><Repeat2 size={20} aria-hidden="true" /><p>Exchange currently supports gifts and swaps of eligible 7EVEN benefits. It does not exchange cash, foreign currency or cryptocurrency.</p></div>
      {error && <ErrorNotice message={error} retry={reload} />}
      <div className="customer-value-section">
        <span className="public-eyebrow">SEND AN INVITATION</span><h2>Share a transferable benefit</h2>
        {!transferable.length ? <EmptyState title="No transferable benefits available" description="Only benefits marked transferable by the issuing business can be exchanged." /> : (
          <form className="customer-exchange-form" onSubmit={propose}>
            <label>Benefit to send<select value={benefitId} onChange={event => setBenefitId(event.target.value)} required>{transferable.map(item => <option value={item.id} key={item.id}>{item.title} · {item.businessName}</option>)}</select></label>
            <label>Recipient’s 7EVEN email<input type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} required placeholder="person@example.com" /></label>
            <label>Requested benefit ID <span className="public-small">(optional, for a swap)</span><input value={requestedBenefitId} onChange={event => setRequestedBenefitId(event.target.value)} placeholder="Leave blank to send as a gift" /></label>
            <button className="btn btn-primary" type="submit" disabled={busy === 'propose' || !benefitId || !recipientEmail.trim()}>{busy === 'propose' ? 'Sending…' : 'Send exchange invitation'}</button>
          </form>
        )}
      </div>
      <div className="customer-value-section">
        <span className="public-eyebrow">YOUR EXCHANGE HISTORY</span><h2>Invitations and swaps</h2>
        {!trades.length ? <EmptyState title="No exchange activity yet" description="Invitations you send or receive will appear here." /> : (
          <div className="customer-trade-list">
            {trades.map(trade => {
              const sent = trade.senderId === userId;
              return <article className="customer-trade-card" key={trade.id}>
                <div><span className="customer-reward-business">{sent ? 'You sent' : 'You received'} · {trade.requestedBenefitId ? 'Benefit swap' : 'Benefit gift'}</span><h3>{trade.benefitTitle}{trade.requestedBenefitTitle ? ` ↔ ${trade.requestedBenefitTitle}` : ''}</h3><p className="public-small">{sent ? `To ${trade.recipientName}` : `From ${trade.senderName}`} · Expires {new Date(trade.expiresAt).toLocaleString('en-NG')}</p></div>
                <div className="customer-trade-actions"><StatusBadge status={trade.status} />
                  {trade.status === 'PENDING' && (sent ? <button className="btn btn-secondary btn-small" type="button" disabled={busy === trade.id} onClick={() => void act(trade,'CANCEL')}>Cancel</button> : <><button className="btn btn-primary btn-small" type="button" disabled={busy === trade.id} onClick={() => void act(trade,'ACCEPT')}>Accept</button><button className="btn btn-secondary btn-small" type="button" disabled={busy === trade.id} onClick={() => void act(trade,'DECLINE')}>Decline</button></>)}
                </div>
              </article>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

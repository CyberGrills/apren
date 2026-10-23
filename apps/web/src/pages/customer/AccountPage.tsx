import type { CustomerOverview } from '@7even/contracts';
import { ArrowUpRight } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { ErrorNotice, Loading } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';
import { ActivityView } from './ActivityView.tsx';
import { BenefitsView } from './BenefitsView.tsx';
import { BookingList } from './BookingList.tsx';
import { ExchangeView } from './ExchangeView.tsx';
import { PointsView } from './PointsView.tsx';
import { ProfileView } from './ProfileView.tsx';

type AccountTab = 'bookings' | 'points' | 'benefits' | 'exchange' | 'profile' | 'activity';
const headings: Record<AccountTab, { eyebrow: string; title: string; description: string }> = {
  bookings: {
    eyebrow: 'Your plans',
    title: 'Something to look forward to.',
    description: 'Your stays, tables and days out. Every booking, with its current status.',
  },
  points: {
    eyebrow: 'Your points',
    title: 'Good visits add up.',
    description: 'A clear record of what you earn, what you use and what is ready for next time.',
  },
  benefits: {
    eyebrow: 'Your benefits',
    title: 'A little something for next time.',
    description:
      'Your claimed rewards, their use-by dates and the details you need when you visit.',
  },
  exchange: {
    eyebrow: 'Your exchanges',
    title: 'Pass something good along.',
    description:
      'Give an eligible benefit or swap with someone you know. Every offer stays on the record.',
  },
  activity: {
    eyebrow: 'Your updates',
    title: 'A word about your plans.',
    description: 'Booking updates, invitations and the things that need your attention.',
  },
  profile: {
    eyebrow: 'Your profile',
    title: 'Make yourself at home.',
    description: 'The details that belong to your 7even account.',
  },
};

export function AccountPage({ tab = 'bookings' }: { tab?: AccountTab }) {
  const { user } = useSession();
  const { data, loading, error, reload } = useApi<CustomerOverview>(user ? '/me/overview' : null);
  const heading = headings[tab];
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
            Find your next plan <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <nav className="customer-tabs" aria-label="Your account">
          {[
            ['profile', 'Profile'],
            ['bookings', 'Bookings'],
            ['points', 'Points'],
            ['benefits', 'Benefits'],
            ['exchange', 'Exchange'],
            ['activity', 'Updates'],
          ].map(([value, label]) => (
            <NavLink
              key={value}
              to={`/app/${value}`}
              aria-current={value === tab ? 'page' : undefined}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        {loading && <Loading />}
        {error && <ErrorNotice message={error} retry={reload} />}
        {!user && (
          <p>
            Sign in to see your account. <Link to="/login">Sign in</Link>
          </p>
        )}
        {data && user && (
          <div className="customer-content">
            {tab === 'bookings' && <BookingList reservations={data.reservations} reload={reload} />}
            {tab === 'points' && <PointsView points={data.points} reload={reload} />}
            {tab === 'benefits' && <BenefitsView benefits={data.benefits} reload={reload} />}
            {tab === 'exchange' && (
              <ExchangeView trades={data.trades} userId={user.id} reload={reload} />
            )}
            {tab === 'profile' && <ProfileView user={user} />}
            {tab === 'activity' && (
              <ActivityView notifications={data.notifications} reload={reload} />
            )}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

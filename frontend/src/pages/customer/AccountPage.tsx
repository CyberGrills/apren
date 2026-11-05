import type { CustomerOverview } from '@7even/contracts';
import { ArrowUpRight } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { ErrorNotice, Loading } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';
import { ActivityView } from './ActivityView.tsx';
import { BookingList } from './BookingList.tsx';
import { ProfileView } from './ProfileView.tsx';
import { useSevenLanguage } from '../../lib/sevenLanguage.ts';

type AccountTab = 'bookings' | 'profile' | 'activity';
const headings: Record<AccountTab, { eyebrow: string; title: string; description: string }> = {
  bookings: {
    eyebrow: 'Your stays',
    title: 'Something to look forward to.',
    description: 'Your hotel and apartment reservations, with their current status.',
  },
  activity: {
    eyebrow: 'Your updates',
    title: 'A word about your plans.',
    description: 'Booking updates and the things that need your attention.',
  },
  profile: {
    eyebrow: 'Your profile',
    title: 'Make yourself at home.',
    description: 'The details that belong to your 7even account.',
  },
};

export function AccountPage({ tab = 'bookings' }: { tab?: AccountTab }) {
  const { user } = useSession();
  const language = useSevenLanguage();
  const { data, loading, error, reload } = useApi<CustomerOverview>(user ? '/me/overview' : null);
  const heading = language === 'pcm' ? {
    bookings: { eyebrow: 'Your stays', title: 'Your next enjoyment dey here.', description: 'See your hotel and apartment bookings, plus their current status.' },
    activity: { eyebrow: 'Your updates', title: 'Wetin dey happen with your plans.', description: 'Booking updates and anything wey need your attention.' },
    profile: { eyebrow: 'Your profile', title: 'Make yourself comfortable.', description: 'Your personal details for your 7even account.' },
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
            {language === 'pcm' ? 'Sign in make you see your account.' : 'Sign in to see your account.'} <Link to="/login">Sign in</Link>
          </p>
        )}
        {data && user && (
          <div className="customer-content">
            {tab === 'bookings' && <BookingList reservations={data.reservations} reload={reload} />}
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

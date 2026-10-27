import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/Brand.tsx';
import { useSession } from '../../context/SessionContext.tsx';

export { editorialImages } from '../../lib/editorialImages.ts';

export type SevenLanguage = 'en' | 'pcm';
export function readSevenLanguage(): SevenLanguage {
  try {
    return window.localStorage.getItem('7even-language-style') === 'pcm' ? 'pcm' : 'en';
  } catch {
    return 'en';
  }
}
export function PublicHeader() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<SevenLanguage>(readSevenLanguage);
  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const next = (event as CustomEvent<SevenLanguage>).detail;
      if (next === 'en' || next === 'pcm') setLanguage(next);
    };
    window.addEventListener('7even-language-change', syncLanguage);
    return () => window.removeEventListener('7even-language-change', syncLanguage);
  }, []);
  useEffect(() => {
    const saved = user?.profileDetails?.preferredLanguage;
    if (saved === 'en' || saved === 'pcm') setLanguage(saved);
  }, [user?.profileDetails?.preferredLanguage]);
  function changeLanguage(next: SevenLanguage) {
    setLanguage(next);
    try {
      window.localStorage.setItem('7even-language-style', next);
    } catch {
      // The current page still updates if browser storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent('7even-language-change', { detail: next }));
  }
  const workspace =
    user?.role === 'ADMIN'
      ? null
      : user?.role === 'BUSINESS_OWNER'
        ? { label: 'Your business', href: '/business' }
        : user?.role === 'RECEPTION'
          ? { label: 'Open reception', href: '/reception' }
          : { label: 'For business', href: '/business/apply' };
  return (
    <header className="public-header">
      <div className="public-container public-nav">
        <Link to="/" aria-label="7even home" className="public-brand">
          <Brand />
        </Link>
        <nav className="public-nav-desktop" aria-label="Main navigation">
          <Link to="/explore?kind=STAY">{language === 'pcm' ? 'Places to stay' : 'Hotels & stays'}</Link>
          <Link to="/explore?kind=DINING">{language === 'pcm' ? 'Food' : 'Dining'}</Link>
          <Link to="/explore?kind=EXPERIENCE">{language === 'pcm' ? 'Things to do' : 'Things to do'}</Link>
        </nav>
        <div className="public-nav-actions">
          <div className="seven-language-switch" role="group" aria-label="Website language">
            <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => changeLanguage('en')}>English</button>
            <button type="button" className={language === 'pcm' ? 'active' : ''} aria-pressed={language === 'pcm'} onClick={() => changeLanguage('pcm')}>Naija Pidgin</button>
          </div>
          <Link to={user ? '/app/bookings' : '/login'} className="public-account-link">
            {user ? (language === 'pcm' ? 'Your bookings' : 'Your plans') : language === 'pcm' ? 'Enter' : 'Sign in'}
          </Link>
          {workspace && (
            <Link to={workspace.href} className="public-business-link">
              {workspace.label} <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            className="public-menu-button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="public-mobile-nav public-container" aria-label="Mobile navigation">
          <Link to="/explore?kind=STAY" onClick={() => setOpen(false)}>
            {language === 'pcm' ? 'Places to stay' : 'Hotels & stays'}
          </Link>
          <Link to="/explore?kind=DINING" onClick={() => setOpen(false)}>
            {language === 'pcm' ? 'Food' : 'Dining'}
          </Link>
          <Link to="/explore?kind=EXPERIENCE" onClick={() => setOpen(false)}>
            {language === 'pcm' ? 'Things to do' : 'Things to do'}
          </Link>
          {user && <Link to="/app/profile" onClick={() => setOpen(false)}>{language === 'pcm' ? 'Your profile' : 'Profile'}</Link>}
          {workspace && (
            <Link to={workspace.href} onClick={() => setOpen(false)}>
              {workspace.label}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="public-footer-top">
          <Link to="/" aria-label="7even home">
            <Brand />
          </Link>
          <p>
            Good places.
            <br />
            Worth your time.
          </p>
          <nav aria-label="Footer">
            <Link to="/explore?kind=STAY">Find a stay</Link>
            <Link to="/business/apply">Bring your business</Link>
            <Link to="/app/bookings">Your bookings</Link>
            <Link to="/help">Help</Link>
            <Link to="/booking-rules">Booking rules</Link>
          </nav>
        </div>
        <div className="public-footer-bottom">
          <p>© {new Date().getFullYear()} 7even · Nigeria first.</p>
          <a href="/media/SOURCES.txt">Photography and design sources</a>
        </div>
      </div>
    </footer>
  );
}

export function localDateNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day']
    .map((name) => parts.find((part) => part.type === name)?.value)
    .join('-');
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(value.getTime())) return '';
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function friendlyDate(date: string) {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
}

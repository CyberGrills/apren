import { ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brand } from '../../components/Brand.tsx';
import { SeasonalCampaignBanner } from '../../components/SeasonalCampaignBanner.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useSevenLanguage } from '../../lib/sevenLanguage.ts';

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
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement>(null);
  const [language, setLanguage] = useState<SevenLanguage>(readSevenLanguage);
  useEffect(() => {
    setOpen(false);
    setExploreOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    mobileNavRef.current?.querySelector<HTMLElement>('a, button, select')?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);
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
    if (saved === 'en' || saved === 'pcm') {
      setLanguage(saved);
      try { window.localStorage.setItem('7even-language-style', saved); } catch { /* Account preference remains authoritative. */ }
      window.dispatchEvent(new CustomEvent('7even-language-change', { detail: saved }));
    }
  }, [user?.profileDetails?.preferredLanguage]);
  useEffect(() => {
    if (!exploreOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !exploreRef.current?.contains(event.target)) setExploreOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExploreOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [exploreOpen]);
  function closeMobileMenu() {
    setOpen(false);
    menuButtonRef.current?.focus();
  }
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
  const exploreKind = new URLSearchParams(location.search).get('kind');
  const onExplore = location.pathname === '/explore';
  const navItems = [
    { to: '/', label: 'Home', current: location.pathname === '/' },
    { to: '/explore?kind=STAY', label: language === 'pcm' ? 'Places to stay' : 'Hotels & stays', current: onExplore && exploreKind === 'STAY' },
    { to: '/explore?kind=DINING', label: language === 'pcm' ? 'Food' : 'Dining', current: onExplore && exploreKind === 'DINING' },
    { to: '/explore?kind=EXPERIENCE', label: 'Things to do', current: onExplore && exploreKind === 'EXPERIENCE' },
    { to: '/campus-connect/art-culture', label: 'Art & Culture', current: location.pathname.startsWith('/campus-connect/art-culture') },
  ];
  return (
    <>
    <header className="public-header" ref={headerRef}>
      <div className="public-container public-nav">
        <Link to="/" aria-label="7even home" className="public-brand">
          <Brand />
        </Link>
        <nav className="public-nav-desktop" aria-label="Main navigation">
          <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined}>Home</Link>
          <div className="public-explore" ref={exploreRef}>
            <button
              type="button"
              className={navItems.slice(1).some((item) => item.current) ? 'public-explore-button is-current' : 'public-explore-button'}
              aria-expanded={exploreOpen}
              aria-controls="public-explore-menu"
              onClick={() => setExploreOpen((current) => !current)}
            >
              Explore <ChevronDown size={15} aria-hidden="true" />
            </button>
            {exploreOpen && (
              <div id="public-explore-menu" className="public-explore-menu">
                {navItems.slice(1).map((item) => (
                  <Link key={item.to} to={item.to} aria-current={item.current ? 'page' : undefined}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="public-nav-actions">
          <div className="seven-language-switch" role="group" aria-label="Website language">
            <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => changeLanguage('en')}>English</button>
            <button type="button" className={language === 'pcm' ? 'active' : ''} aria-pressed={language === 'pcm'} onClick={() => changeLanguage('pcm')}>Naija Pidgin</button>
          </div>
          <Link to="/install" className="public-install-link">Install app</Link>
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
            ref={menuButtonRef}
            className="public-menu-button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="public-mobile-nav"
          ref={mobileNavRef}
          className="public-mobile-nav"
          aria-label="Mobile navigation"
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            const items = mobileNavRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled])');
            if (!items?.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} onClick={closeMobileMenu} aria-current={item.current ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
          <Link to="/install" onClick={closeMobileMenu}>Install app</Link>
          <Link to={user ? '/app/bookings' : '/login'} onClick={closeMobileMenu}>
            {user ? (language === 'pcm' ? 'Your bookings' : 'Your plans') : language === 'pcm' ? 'Enter' : 'Sign in'}
          </Link>
          {user && <Link to="/app/profile" onClick={closeMobileMenu}>{language === 'pcm' ? 'Your profile' : 'Profile'}</Link>}
          {workspace && (
            <Link to={workspace.href} onClick={closeMobileMenu}>
              {workspace.label}
            </Link>
          )}
          <Link to="/appearance" onClick={closeMobileMenu}>Appearance</Link>
        </nav>
      )}
    </header>
    {location.pathname === '/' && <SeasonalCampaignBanner />}
    </>
  );
}

export function PublicFooter() {
  const language = useSevenLanguage();
  return (
    <footer className="public-footer">
      <div className="public-container">
        <div className="public-footer-top">
          <div className="public-footer-brand-lockup">
            <Link to="/" aria-label="7even home"><Brand /></Link>
            <div className="apren-signature" aria-label="Powered by āprən">
              <strong className="apren-wordmark">āprən</strong>
              <span>Powered by āprən</span>
            </div>
          </div>
          <p>
            {language === 'pcm' ? <>Correct places.<br />Make your time count.</> : <>Good places.<br />Worth your time.</>}
          </p>
          <nav aria-label="Footer">
            <Link to="/explore?kind=STAY">{language === 'pcm' ? 'Find place to stay' : 'Find a stay'}</Link>
            <Link to="/business/apply">{language === 'pcm' ? 'List your business' : 'Bring your business'}</Link>
            <Link to="/app/bookings">Your bookings</Link>
            <Link to="/install">Install 7even</Link>
            <Link to="/appearance">Appearance</Link>
            <Link to="/campus-connect/art-culture">Art & Culture</Link>
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

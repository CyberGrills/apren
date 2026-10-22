import {
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CreditCard,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext.tsx';
import { clearQueues } from '../lib/receptionQueue.ts';
import { ErrorNotice } from './ui.tsx';
import { Brand } from './Brand.tsx';

export function WorkspaceShell({ mode }: { mode: 'business' | 'reception' | 'admin' }) {
  const { user, session, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 800px)').matches);
  const opener = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia('(max-width: 800px)');
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    closeButton.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const controls = [
          ...(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ??
            []),
        ];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('keydown', dismiss);
      opener.current?.focus();
    };
  }, [open, mobile]);
  const [online, setOnline] = useState(navigator.onLine);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const location = useLocation();
  useEffect(() => {
    if (location.pathname) setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const clear = () => {
      void clearQueues().catch(() => {});
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('seven:logout', clear);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('seven:logout', clear);
    };
  }, []);
  const sidebarSemantics = mobile && open ? { role: 'dialog' as const, 'aria-modal': true } : {};
  const businessLinks = [
    { path: '/business', label: 'Overview', icon: LayoutDashboard, end: true },
    { path: '/business/reservations', label: 'Reservations', icon: CalendarDays },
    { path: '/business/offerings', label: 'Places & availability', icon: Store },
    { path: '/business/venues', label: 'Venues', icon: Store },
    { path: '/business/demand', label: 'Demand', icon: ChartNoAxesCombined },
    { path: '/business/rewards', label: 'Rewards', icon: Gift },
    { path: '/business/team', label: 'Your team', icon: Users },
    { path: '/business/settings', label: 'Business details', icon: Settings2 },
  ];
  const adminLinks = [
    { path: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { path: '/admin/inventory', label: 'Listings & inventory', icon: Store },
    { path: '/admin/businesses', label: 'Businesses', icon: Store },
    { path: '/admin/reservations', label: 'Reservations', icon: CalendarDays },
    { path: '/admin/payments', label: 'Payments & settlement', icon: CreditCard },
    { path: '/admin/operations', label: 'Operations', icon: Settings2 },
    { path: '/admin/policy', label: 'Points policy', icon: Gift },
    { path: '/admin/audit', label: 'Activity log', icon: ShieldCheck },
  ];
  const links =
    mode === 'admin'
      ? adminLinks
      : mode === 'reception'
        ? [{ path: '/reception', label: 'The reception desk', icon: CalendarDays }]
        : businessLinks;
  async function signOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await logout();
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : 'Could not sign out.');
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className={`workspace workspace-${mode}`}>
      <aside
        ref={sidebar}
        {...sidebarSemantics}
        className={`workspace-sidebar ${open ? 'is-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <button
          type="button"
          ref={closeButton}
          className="icon-button workspace-mobile-menu workspace-menu-close"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X size={19} />
        </button>
        <Link to="/" aria-label="7even home">
          <Brand />
        </Link>
        <p className="workspace-label">
          {mode === 'admin'
            ? 'Platform management'
            : mode === 'reception'
              ? 'At your service'
              : 'Your business'}
        </p>
        <nav className="workspace-nav">
          {links.map(({ path, label, icon: Icon, end }) => (
            <NavLink key={path} to={path} end={end} onClick={() => setOpen(false)}>
              <Icon size={17} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <nav className="workspace-nav">
            {user?.role === 'BUSINESS_OWNER' && (
              <NavLink to={mode === 'reception' ? '/business' : '/reception'}>
                <ChevronRight size={17} />
                {mode === 'reception' ? 'Business dashboard' : 'Open reception'}
              </NavLink>
            )}
            <Link to="/explore">
              <Store size={17} />
              Explore 7even
            </Link>
          </nav>
          <div className="workspace-user">
            <strong>{user?.displayName}</strong>
            <small>{user?.email}</small>
            <button
              type="button"
              className="text-button"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <LogOut size={13} /> {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
            {signOutError && <ErrorNotice message={signOutError} />}
          </div>
        </div>
      </aside>
      <div className="workspace-main" inert={mobile && open}>
        <header className="workspace-topbar">
          <div>
            <button
              type="button"
              className="icon-button workspace-mobile-menu"
              ref={opener}
              onClick={() => setOpen(!open)}
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              aria-expanded={open}
            >
              {open ? <X size={19} /> : <Menu size={19} />}
            </button>
            <span className="workspace-mode">
              7even / {mode === 'admin' ? 'Admin' : mode === 'reception' ? 'Reception' : 'Business'}
            </span>
          </div>
          <div>
            {session?.paymentMode === 'mock' && <span className="tag">Test payments</span>}
            <span className={`connection-indicator ${online ? '' : 'offline'}`}>
              {online ? 'Online' : 'Offline'}
            </span>
            <time dateTime={new Date().toISOString()}>
              {new Intl.DateTimeFormat('en-NG', {
                day: 'numeric',
                month: 'short',
                timeZone: 'Africa/Lagos',
              }).format(new Date())}
            </time>
            <Link to="/app/activity" className="icon-button" aria-label="Your updates">
              <Bell size={16} />
            </Link>
          </div>
        </header>
        <main className="workspace-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

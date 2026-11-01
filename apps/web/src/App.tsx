import type { Role } from '@7even/contracts';
import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { FeedbackProvider } from './components/Feedback.tsx';
import { PublicFooter, PublicHeader } from './pages/public/PublicShell.tsx';
import { ErrorNotice, Loading, PageHeader } from './components/ui.tsx';
import { WorkspaceShell } from './components/WorkspaceShell.tsx';
import { SessionProvider, useSession } from './context/SessionContext.tsx';
import { loginPathForWorkspace } from './lib/workspaceNavigation.ts';
import { HelpPage } from './pages/account/HelpPage.tsx';
import { PasswordPage, RecoveryPage } from './pages/account/RecoveryPages.tsx';
import {
  AccountPage,
  CryptoCheckoutPage,
  PaymentReturnPage,
  TestCheckoutPage,
} from './pages/customer/index.ts';
import {
  AuthPage,
  BusinessApplicationPage,
  ExplorePage,
  LandingPage,
  OfferingPage,
} from './pages/public/index.ts';
import { AdminInventoryPage } from './pages/workspace/AdminInventoryPage.tsx';
import { DemoHotelsPage } from './pages/public/DemoHotelsPage.tsx';
import { DemoMarketplacePage } from './pages/public/DemoMarketplacePage.tsx';
import { AdminPage } from './pages/workspace/AdminPage.tsx';
import { BusinessPage } from './pages/workspace/BusinessPage.tsx';
import { OperationsPage } from './pages/workspace/OperationsPage.tsx';
import { ReceptionPage } from './pages/workspace/ReceptionPage.tsx';
import { VenuesPage } from './pages/workspace/VenuesPage.tsx';

function Protected({ roles }: { roles?: Role[] }) {
  const { user, loading, error, refresh } = useSession();
  const location = useLocation();
  if (loading)
    return (
      <main className="permission-screen" id="main-content">
        <Loading />
      </main>
    );
  if (error)
    return (
      <main className="permission-screen" id="main-content">
        <PageHeader
          title="Let’s reconnect."
          actions={
            <button type="button" className="btn btn-primary" onClick={() => void refresh()}>
              Try again
            </button>
          }
        />
        <ErrorNotice message={error} retry={() => void refresh()} />
      </main>
    );
  if (!user)
    return (
      <Navigate
        to={`${loginPathForWorkspace(roles)}?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (roles && !roles.includes(user.role))
    return (
      <main className="permission-screen" id="main-content">
        <PageHeader title="Your account." />
        <ErrorNotice message="Sign in with an account assigned to this workspace." />
        <Link to="/app/bookings" className="btn btn-primary">
          Your account
        </Link>
      </main>
    );
  return <Outlet />;
}
function WorkspaceHome() {
  const { user } = useSession();
  const path =
    user?.role === 'ADMIN'
      ? '/admin'
      : user?.role === 'BUSINESS_OWNER'
        ? '/business'
        : user?.role === 'RECEPTION'
          ? '/reception'
          : '/app/bookings';
  return <Navigate to={path} replace />;
}
function ScrollPosition() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
function FatalFailure() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);
  return (
    <main className="permission-screen" id="main-content">
      <PageHeader title="Find your way back." />
      <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
        Reload 7even
      </button>
      {open && (
        <dialog
          ref={ref}
          className="feedback-popup feedback-error"
          aria-labelledby="fatal-heading"
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          <h2 id="fatal-heading">Something interrupted this page.</h2>
          <p>Please reload and try again. Your confirmed records are kept on the server.</p>
          <div className="feedback-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              Reload 7even
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <FatalFailure /> : this.props.children;
  }
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
let deferredInstallPrompt: InstallPromptEvent | null = null;

function InstallAppPage() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(() => deferredInstallPrompt);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const onPrompt = () => setInstallEvent(deferredInstallPrompt);
    window.addEventListener('seven-install-prompt-ready', onPrompt);
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); setMessage('7even has been added to your device.'); };
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('seven-install-prompt-ready', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    deferredInstallPrompt = null;
    setInstallEvent(null);
    setMessage(choice.outcome === 'accepted' ? 'Follow the prompt to finish adding 7even to your device.' : 'No problem. You can install 7even whenever you are ready.');
  }
  return (
    <div className="public-page seven-install-page">
      <PublicHeader />
      <main id="main-content" className="public-container seven-install-main">
        <section className="seven-install-card" aria-labelledby="install-title">
          <p className="public-eyebrow">7EVEN · YOUR TRAVEL COMPANION</p>
          <h1 id="install-title">Take 7even with you.</h1>
          <p className="seven-install-lead">Add 7even to your home screen for a focused, app-like experience. Your installed shortcut opens the same 7even service.</p>
          {installed ? <p className="seven-install-status" role="status">7even is already installed on this device.</p> : installEvent ? (
            <button type="button" className="btn btn-primary seven-install-action" onClick={() => void install()}>Install 7even</button>
          ) : ios ? (
            <div className="seven-install-steps"><h2>Install on iPhone or iPad</h2><ol><li>Open this page in Safari.</li><li>Tap the Share button.</li><li>Choose <strong>Add to Home Screen</strong>, then tap Add.</li></ol></div>
          ) : (
            <div className="seven-install-steps"><h2>Install from your browser</h2><ol><li>Open 7even in Chrome or another supported browser.</li><li>Open the browser menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, if shown.</li></ol><p>Your browser controls whether installation is available on this device.</p></div>
          )}
          {message && <p className="seven-install-feedback" role="status">{message}</p>}
          <p className="seven-install-footnote">7even is currently an installable web app (PWA), not a Play Store or Apple App Store download. Availability depends on your browser and device.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function App() {
  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredInstallPrompt = event as InstallPromptEvent;
      window.dispatchEvent(new Event('seven-install-prompt-ready'));
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
  }, []);
  return (
    <Boundary>
      <BrowserRouter>
        <FeedbackProvider>
          <SessionProvider>
            <ScrollPosition />
            <div className="apren-watermark" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => (
                <span key={index}>āprən × 7even</span>
              ))}
            </div>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/demo/hotels" element={<DemoHotelsPage />} />
              <Route path="/demo/marketplace" element={<DemoMarketplacePage />} />
              <Route path="/install" element={<InstallAppPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/directory" element={<Navigate to="/explore?kind=STAY" replace />} />
              <Route path="/places/:id" element={<OfferingPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/admin/login" element={<AuthPage mode="login" workspace="admin" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/booking-rules" element={<HelpPage rules />} />
              <Route path="/forgot-password" element={<RecoveryPage />} />
              <Route path="/reset-password" element={<RecoveryPage reset />} />
              <Route element={<Protected />}>
                <Route path="/workspace" element={<WorkspaceHome />} />
                <Route path="/app/security" element={<PasswordPage />} />
                <Route path="/business/apply" element={<BusinessApplicationPage />} />
                <Route path="/app/bookings" element={<AccountPage tab="bookings" />} />
                <Route path="/app/points" element={<Navigate to="/app/bookings" replace />} />
                <Route path="/app/benefits" element={<Navigate to="/app/bookings" replace />} />
                <Route path="/app/exchange" element={<Navigate to="/app/bookings" replace />} />
                <Route path="/app/profile" element={<AccountPage tab="profile" />} />
                <Route path="/app/activity" element={<AccountPage tab="activity" />} />
                <Route path="/checkout/test/:paymentId" element={<TestCheckoutPage />} />
                <Route path="/checkout/crypto/:paymentId" element={<CryptoCheckoutPage />} />
                <Route path="/payment/return" element={<PaymentReturnPage />} />
              </Route>
              <Route element={<Protected roles={['BUSINESS_OWNER']} />}>
                <Route path="/business" element={<WorkspaceShell mode="business" />}>
                  <Route index element={<BusinessPage />} />
                  <Route path="venues" element={<VenuesPage />} />
                  {(
                    ['reservations', 'offerings', 'demand', 'rewards', 'team', 'settings'] as const
                  ).map((tab) => (
                    <Route path={tab} element={<BusinessPage tab={tab} />} key={tab} />
                  ))}
                </Route>
              </Route>
              <Route element={<Protected roles={['BUSINESS_OWNER', 'RECEPTION']} />}>
                <Route path="/reception" element={<WorkspaceShell mode="reception" />}>
                  <Route index element={<ReceptionPage />} />
                </Route>
              </Route>
              <Route element={<Protected roles={['ADMIN']} />}>
                <Route path="/admin" element={<WorkspaceShell mode="admin" />}>
                  <Route index element={<AdminPage />} />
                  <Route path="inventory" element={<AdminInventoryPage />} />
                  <Route path="operations" element={<OperationsPage />} />
                  {(['businesses', 'payments', 'reservations', 'policy', 'audit'] as const).map((tab) => (
                    <Route path={tab} element={<AdminPage tab={tab} />} key={tab} />
                  ))}
                </Route>
              </Route>
              <Route path="/app" element={<Navigate to="/app/bookings" replace />} />
              <Route
                path="*"
                element={
                  <main className="permission-screen" id="main-content">
                    <PageHeader title="Find your way back." />
                    <ErrorNotice message="This page could not be found. Continue from the home page." />
                    <Link className="btn btn-primary" to="/">
                      Back to 7even
                    </Link>
                  </main>
                }
              />
            </Routes>
          </SessionProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </Boundary>
  );
}

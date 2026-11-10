import type { Role } from '@7even/contracts';
import { Component, lazy, Suspense, type ReactNode, useEffect, useRef, useState } from 'react';
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
import { OfflineStatusBar } from './components/OfflineExperience.tsx';
import { OfflinePage } from './pages/public/OfflinePage.tsx';
import { SessionProvider, useSession } from './context/SessionContext.tsx';
import { loginPathForWorkspace } from './lib/workspaceNavigation.ts';
const HelpPage = lazy(() => import('./pages/account/HelpPage.tsx').then((module) => ({ default: module.HelpPage })));
const AppearancePage = lazy(() => import('./pages/account/AppearancePage.tsx').then((module) => ({ default: module.AppearancePage })));
const PasswordPage = lazy(() => import('./pages/account/RecoveryPages.tsx').then((module) => ({ default: module.PasswordPage })));
const RecoveryPage = lazy(() => import('./pages/account/RecoveryPages.tsx').then((module) => ({ default: module.RecoveryPage })));
const AccountPage = lazy(() => import('./pages/customer/AccountPage.tsx').then((module) => ({ default: module.AccountPage })));
const CryptoCheckoutPage = lazy(() => import('./pages/customer/CryptoCheckoutPage.tsx').then((module) => ({ default: module.CryptoCheckoutPage })));
const PaymentReturnPage = lazy(() => import('./pages/customer/PaymentPages.tsx').then((module) => ({ default: module.PaymentReturnPage })));
const TestCheckoutPage = lazy(() => import('./pages/customer/PaymentPages.tsx').then((module) => ({ default: module.TestCheckoutPage })));
const AuthPage = lazy(() => import('./pages/public/AuthPage.tsx').then((module) => ({ default: module.AuthPage })));
const BusinessApplicationPage = lazy(() => import('./pages/public/BusinessApplicationPage.tsx').then((module) => ({ default: module.BusinessApplicationPage })));
const DirectoryPage = lazy(() => import('./pages/public/DirectoryPage.tsx').then((module) => ({ default: module.DirectoryPage })));
const ExplorePage = lazy(() => import('./pages/public/ExplorePage.tsx').then((module) => ({ default: module.ExplorePage })));
const ArtCulturePage = lazy(() => import('./pages/public/ArtCulturePage.tsx').then((module) => ({ default: module.ArtCulturePage })));
const HomePage = lazy(() => import('./pages/public/HomePage.tsx').then((module) => ({ default: module.HomePage })));
const CreatorStudioPage = lazy(() => import('./pages/public/CreatorStudioPage.tsx').then((module) => ({ default: module.CreatorStudioPage })));
const CreatorPublicPage = lazy(() => import('./pages/public/CreatorPublicPage.tsx').then((module) => ({ default: module.CreatorPublicPage })));
const OfferingPage = lazy(() => import('./pages/public/OfferingPage.tsx').then((module) => ({ default: module.OfferingPage })));
const AdminInventoryPage = lazy(() => import('./pages/workspace/AdminInventoryPage.tsx').then((module) => ({ default: module.AdminInventoryPage })));
const AdminBusinessMedia = lazy(() => import('./pages/workspace/AdminBusinessMedia.tsx').then((module) => ({ default: module.AdminBusinessMedia })));
const DemoHotelsPage = lazy(() => import('./pages/public/DemoHotelsPage.tsx').then((module) => ({ default: module.DemoHotelsPage })));
const DemoMarketplacePage = lazy(() => import('./pages/public/DemoMarketplacePage.tsx').then((module) => ({ default: module.DemoMarketplacePage })));
const DemoCheckoutPage = lazy(() => import('./pages/public/DemoCheckoutPage.tsx').then((module) => ({ default: module.DemoCheckoutPage })));
const AdminPage = lazy(() => import('./pages/workspace/AdminPage.tsx').then((module) => ({ default: module.AdminPage })));
const BusinessPage = lazy(() => import('./pages/workspace/BusinessPage.tsx').then((module) => ({ default: module.BusinessPage })));
const OperationsPage = lazy(() => import('./pages/workspace/OperationsPage.tsx').then((module) => ({ default: module.OperationsPage })));
const ReceptionPage = lazy(() => import('./pages/workspace/ReceptionPage.tsx').then((module) => ({ default: module.ReceptionPage })));
const VenuesPage = lazy(() => import('./pages/workspace/VenuesPage.tsx').then((module) => ({ default: module.VenuesPage })));

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
            <OfflineStatusBar />
            <div className="apren-watermark" aria-hidden="true" />
            <Suspense fallback={<main className="permission-screen" id="main-content"><Loading /></main>}>
              <Routes>
              <Route path="/" element={<HomePage />} />
              {import.meta.env.PROD ? (
                <>
                  <Route path="/demo/hotels" element={<Navigate to="/explore?kind=STAY" replace />} />
                  <Route path="/demo/marketplace" element={<Navigate to="/explore?kind=STAY" replace />} />
                  <Route path="/demo/checkout" element={<Navigate to="/explore?kind=STAY" replace />} />
                </>
              ) : (
                <>
                  <Route path="/demo/hotels" element={<DemoHotelsPage />} />
                  <Route path="/demo/marketplace" element={<DemoMarketplacePage />} />
                  <Route path="/demo/checkout" element={<DemoCheckoutPage />} />
                </>
              )}
              <Route path="/install" element={<InstallAppPage />} />
              <Route path="/offline" element={<OfflinePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/campus-connect/art-culture" element={<ArtCulturePage />} />
              <Route path="/creators/:slug" element={<CreatorPublicPage />} />
              <Route path="/directory" element={<DirectoryPage />} />
              <Route path="/places/:id" element={<OfferingPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/admin/login" element={<AuthPage mode="login" workspace="admin" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/appearance" element={<AppearancePage />} />
              <Route path="/booking-rules" element={<HelpPage rules />} />
              <Route path="/forgot-password" element={<RecoveryPage />} />
              <Route path="/reset-password" element={<RecoveryPage reset />} />
              <Route element={<Protected />}>
                <Route path="/workspace" element={<WorkspaceHome />} />
                <Route path="/creator" element={<CreatorStudioPage />} />
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
                    ['reservations', 'offerings', 'photos', 'demand', 'rewards', 'team', 'settings'] as const
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
                  <Route path="media" element={<AdminBusinessMedia />} />
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
              </Suspense>
          </SessionProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </Boundary>
  );
}

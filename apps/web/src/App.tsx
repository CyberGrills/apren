import type { Role } from '@7even/contracts';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { WorkspaceShell } from './components/WorkspaceShell.tsx';
import { ErrorNotice, Loading, PageHeader } from './components/ui.tsx';
import { SessionProvider, useSession } from './context/SessionContext.tsx';
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
import { AdminPage } from './pages/workspace/AdminPage.tsx';
import { BusinessPage } from './pages/workspace/BusinessPage.tsx';
import { VenuesPage } from './pages/workspace/VenuesPage.tsx';
import { OperationsPage } from './pages/workspace/OperationsPage.tsx';
import { HelpPage } from './pages/account/HelpPage.tsx';
import { RecoveryPage, PasswordPage } from './pages/account/RecoveryPages.tsx';
import { ReceptionPage } from './pages/workspace/ReceptionPage.tsx';
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
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
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
export function App() {
  return (
    <Boundary>
      <BrowserRouter>
        <FeedbackProvider>
          <SessionProvider>
            <ScrollPosition />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/places/:id" element={<OfferingPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
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
                <Route path="/app/points" element={<AccountPage tab="points" />} />
                <Route path="/app/benefits" element={<AccountPage tab="benefits" />} />
                <Route path="/app/exchange" element={<AccountPage tab="exchange" />} />
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
                  <Route path="operations" element={<OperationsPage />} />
                  {(['businesses', 'payments', 'policy', 'audit'] as const).map((tab) => (
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

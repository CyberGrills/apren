import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../../components/Brand.tsx';
import {
  AuthenticationOptions,
  socialErrorMessage,
} from '../../components/AuthenticationOptions.tsx';
import { ErrorNotice, Field, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { safeWorkspaceReturnTo } from '../../lib/workspaceNavigation.ts';
import { useSevenLanguage } from '../../lib/sevenLanguage.ts';
import { editorialImages, PublicFooter, PublicHeader } from './PublicShell.tsx';

const loginVibes = [
  'Omo, you don land. Make we continue your plans.',
  'How far, padi? Your next stay dey wait.',
  'No wahala — make we get you back inside.',
  'Soft life no go book itself. Oya, sign in.',
  'Abeg, make we continue where you stop.',
  'Your next getaway fit start here. No long thing.',
  'Go-slow fit hold road, e no go hold your better plans.',
  'E choke! Make we find you a stay wey match your steeze.',
  'Oya now, enter your account make we move.',
  'You need small enjoyment? Your next stay dey one sign-in away.',
  'Wetin be the plan today, padi? Make we pick up from here.',
  'Island vibes or Mainland calm? Your next stay starts here.',
  'No stress, no gbas-gbos. Sign in make we sort your booking.',
  'Your next chapter dey call. Abeg, make we enter.',
  'You don come back — correct move. Make we continue.',
  'Make we arrange that soft-life escape, one step at a time.',
] as const;

const LOGIN_VIBE_STORAGE_KEY = '7even-login-vibe-index';

export function AuthPage({ mode, workspace }: { mode: 'login' | 'register'; workspace?: 'admin' }) {
  const language = useSevenLanguage();
  const pcm = !workspace && language === 'pcm';
  const { login, register, session, loading: sessionLoading } = useSession();
  const { showSuccess, showError } = useFeedback();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginVibe, setLoginVibe] = useState<string>(loginVibes[0]);
  const vibeRotationDone = useRef(false);
  const admin = workspace === 'admin';
  const registration = !admin && mode === 'register';
  const returnTo = safeWorkspaceReturnTo(params.get('returnTo') ?? params.get('next'), admin);

  useEffect(() => {
    if (admin || registration || vibeRotationDone.current) return;
    vibeRotationDone.current = true;
    try {
      const storedIndex = window.localStorage.getItem(LOGIN_VIBE_STORAGE_KEY);
      const lastIndex = storedIndex === null ? Number.NaN : Number(storedIndex);
      const nextIndex =
        Number.isInteger(lastIndex) && lastIndex >= 0 && lastIndex < loginVibes.length
          ? (lastIndex + 1) % loginVibes.length
          : Math.floor(Math.random() * loginVibes.length);
      window.localStorage.setItem(LOGIN_VIBE_STORAGE_KEY, String(nextIndex));
      setLoginVibe(loginVibes[nextIndex] ?? loginVibes[0]);
    } catch {
      setLoginVibe(loginVibes[Math.floor(Math.random() * loginVibes.length)] ?? loginVibes[0]);
    }
  }, [admin, registration]);

  useEffect(() => {
    // The social-login API rejects login attempts when this browser already has a session.
    // Send authenticated visitors out of the public auth screen instead of showing a dead-end.
    if (admin || sessionLoading || !session?.user) return;
    navigate(returnTo, { replace: true });
  }, [admin, sessionLoading, session?.user, navigate, returnTo]);

  useEffect(() => {
    const authError = params.get('authError');
    if (!authError) return;
    showError(socialErrorMessage(authError));
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('authError');
        return next;
      },
      { replace: true },
    );
  }, [params, setParams, showError]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setBusy(true);
    try {
      const email = String(form.get('email') ?? '').trim();
      const password = String(form.get('password') ?? '');
      if (registration)
        await register(String(form.get('displayName') ?? '').trim(), email, password);
      else await login(email, password);
      showSuccess(
        registration
          ? 'Your 7even account is ready.'
          : 'Your account is ready to use on this device.',
        registration ? 'Account created.' : 'Signed in.',
      );
      navigate(returnTo, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'We could not sign you in. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-page">
      {admin ? (
        <header className="public-header">
          <div className="public-container public-nav">
            <Link to="/" aria-label="7even home" className="public-brand">
              <Brand />
            </Link>
          </div>
        </header>
      ) : (
        <PublicHeader />
      )}
      <main
        id="main-content"
        className={`public-container auth-layout${admin ? ' auth-layout-admin' : ''}`}
      >
        <div className="auth-copy">
          <span className="public-eyebrow">{admin ? 'Staff access' : 'Your plans start here'}</span>
          <h1>
            {admin ? (
              <>
                7even
                <br />
                <em>operations.</em>
              </>
            ) : registration ? (
              <>
                A little more
                <br />
                to look forward to.
              </>
            ) : (
              <>
                Good to
                <br />
                <em>have you back.</em>
              </>
            )}
          </h1>
          <p>
            {admin
              ? 'Review businesses, follow reservations and keep platform operations in order.'
              : registration
                ? (pcm ? 'Keep your bookings one place. When eligible bookings complete, you fit earn points and choose reward wey you like.' : 'Keep your bookings in one place. Earn points when eligible bookings are completed, then choose a reward you like.')
                : loginVibe}
          </p>
          {!admin && (
            <figure>
              <img
                src={editorialImages.room}
                alt="A warmly lit hotel room. Illustrative photograph by Vojtech Bruzek."
                width="1000"
                height="700"
              />
              <figcaption>Photo: Vojtech Bruzek / Unsplash · Illustrative image</figcaption>
            </figure>
          )}
        </div>
        <section className="auth-form-panel" aria-labelledby="auth-title">
          <span className="public-eyebrow">{admin ? 'Platform access' : '7even account'}</span>
          <h2 id="auth-title">
            {admin
              ? 'Staff sign in.'
              : registration
                ? (pcm ? 'Make yourself comfortable.' : 'Make yourself at home.')
                : (pcm ? 'Enter 7even.' : 'Sign in to 7even.')}
          </h2>
          <AuthenticationOptions
            returnTo={returnTo}
            registration={registration}
            admin={admin}
            busy={busy}
            setBusy={setBusy}
            onAuthenticated={() => {
              showSuccess('Your account is ready to use on this device.', 'Signed in.');
              navigate(returnTo, { replace: true });
            }}
          />
          <form onSubmit={submit}>
            {registration && (
              <Field label="Your name">
                <input
                  className="field-input"
                  name="displayName"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                className="field-input"
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </Field>
            <Field label="Password" hint={registration ? 'Use at least 12 characters.' : undefined}>
              <input
                className="field-input"
                type="password"
                name="password"
                autoComplete={registration ? 'new-password' : 'current-password'}
                required
                minLength={registration ? 12 : 1}
                maxLength={128}
              />
            </Field>
            {error && <ErrorNotice message={error} />}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy
                ? registration
                  ? 'Creating your account…'
                  : 'Signing in…'
                : registration
                  ? 'Create your account'
                  : 'Sign in'}
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </form>
          {!registration && (
            <p>
              <Link to="/forgot-password">{pcm ? 'You forget your password?' : 'Forgot your password?'}</Link>
            </p>
          )}
          {!admin && (
            <p className="auth-switch">
              {registration ? (pcm ? 'You don get account already?' : 'Already have an account?') : (pcm ? 'New to 7even?' : 'New to 7even?')}{' '}
              <Link
                to={`/${registration ? 'login' : 'register'}?returnTo=${encodeURIComponent(returnTo)}`}
              >
                {registration ? 'Sign in' : (pcm ? 'Create account' : 'Create an account')}
              </Link>
            </p>
          )}
          <p className="public-small">
            {admin
              ? 'Use an account assigned to platform administration. Access is checked after sign in.'
              : (pcm ? 'Your account keep your booking history, points and benefits. Payment details dey with the payment provider.' : 'Your account holds your booking history, points and benefits. Payment details are handled by the payment provider.')}
          </p>
        </section>
      </main>
      {!admin && <PublicFooter />}
    </div>
  );
}

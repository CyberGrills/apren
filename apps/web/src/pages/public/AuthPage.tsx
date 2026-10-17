import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNotice, Field, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { editorialImages, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useSession();
  const { showSuccess } = useFeedback();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registration = mode === 'register';
  const requested = params.get('returnTo') ?? params.get('next') ?? '/workspace';
  const returnTo =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/workspace';
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
      <PublicHeader />
      <main id="main-content" className="public-container auth-layout">
        <div className="auth-copy">
          <span className="public-eyebrow">Your plans start here</span>
          <h1>
            {registration ? (
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
            {registration
              ? 'Keep your bookings in one place. Earn points when eligible bookings are completed, then choose a reward you like.'
              : 'Your next stay, your points and the plans you’ve already made.'}
          </p>
          <figure>
            <img
              src={editorialImages.room}
              alt="A warmly lit hotel room. Illustrative photograph by Vojtech Bruzek."
              width="1000"
              height="700"
            />
            <figcaption>Photo: Vojtech Bruzek / Unsplash · Illustrative image</figcaption>
          </figure>
        </div>
        <section className="auth-form-panel" aria-labelledby="auth-title">
          <span className="public-eyebrow">7even account</span>
          <h2 id="auth-title">{registration ? 'Make yourself at home.' : 'Sign in to 7even.'}</h2>
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
              <Link to="/forgot-password">Forgot your password?</Link>
            </p>
          )}
          <p className="auth-switch">
            {registration ? 'Already have an account?' : 'New to 7even?'}{' '}
            <Link
              to={`/${registration ? 'login' : 'register'}?returnTo=${encodeURIComponent(returnTo)}`}
            >
              {registration ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <p className="public-small">
            Your account holds your booking history, points and benefits. Payment details are
            handled by the payment provider.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

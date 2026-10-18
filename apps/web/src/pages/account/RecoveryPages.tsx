import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNotice, Field, PageHeader, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../lib/api.ts';
import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';
export function RecoveryPage({ reset = false }: { reset?: boolean }) {
  const { showSuccess } = useFeedback();
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') ?? '');
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!reset) return;
    const tag = document.createElement('meta');
    tag.name = 'referrer';
    tag.content = 'no-referrer';
    document.head.append(tag);
    if (token) navigate('/reset-password', { replace: true });
    return () => tag.remove();
  }, [reset, token, navigate]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (reset && f.get('password') !== f.get('confirmPassword'))
        throw new Error('The passwords do not match.');
      await api(reset ? '/auth/recovery/complete' : '/auth/recovery', {
        method: 'POST',
        body: reset
          ? { token, password: String(f.get('password')) }
          : { email: String(f.get('email')).trim() },
      });
      if (reset) await refresh();
      showSuccess(
        reset
          ? 'Your password has been changed. Sign in again with the new password.'
          : 'If this email has a 7even account, a reset link will be sent. Each link works once and lasts 15 minutes.',
        reset ? 'Password changed.' : 'Check your email.',
      );
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete that request.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="public-container account-help">
        <PageHeader
          eyebrow="Your account"
          title={reset ? 'A fresh start.' : 'Let’s get you back in.'}
          description={
            reset
              ? 'Choose a password with at least 12 characters. Your other signed-in sessions will end.'
              : 'Use the email on your booking. If reception created your account, this is how you make it yours.'
          }
        />
        {done ? (
          <div className="form-actions">
            <Link className="btn btn-primary" to="/login">
              Return to sign in
            </Link>
          </div>
        ) : reset && !token ? (
          <div className="form-actions">
            <ErrorNotice message="This page needs a valid reset link. Open the link from your email, or request a new one if yours has expired." />
            <Link className="btn btn-primary" to="/forgot-password">
              Request a reset link
            </Link>
          </div>
        ) : (
          <form className="form-stack panel" onSubmit={submit}>
            {reset ? (
              <>
                <Field label="New password">
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    name="confirmPassword"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </>
            ) : (
              <Field label="Email address">
                <input name="email" type="email" maxLength={254} autoComplete="email" required />
              </Field>
            )}
            {error && <ErrorNotice message={error} />}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Working…' : reset ? 'Set new password' : 'Send a reset link'}
            </button>
          </form>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
export function PasswordPage() {
  const { showSuccess } = useFeedback();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (f.get('newPassword') !== f.get('confirmation'))
        throw new Error('The new passwords do not match.');
      await api('/me/password', {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: {
          currentPassword: String(f.get('currentPassword')),
          newPassword: String(f.get('newPassword')),
        },
      });
      showSuccess(
        'Your password has been changed. Sign in again on each device.',
        'Password changed.',
      );
      setDone(true);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="public-container account-help" id="main-content">
        <PageHeader
          eyebrow="Account security"
          title="Change your password."
          description="You will need to sign in again on each device."
        />
        {done ? (
          <Link className="btn btn-primary" to="/login">
            Sign in again
          </Link>
        ) : (
          <form className="form-stack panel" onSubmit={submit}>
            <Field label="Current password">
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <input
                name="newPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                name="confirmation"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
            {error && <ErrorNotice message={error} />}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Changing…' : 'Change password'}
            </button>
          </form>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

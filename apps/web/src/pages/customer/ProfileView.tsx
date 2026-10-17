import type { SessionUser } from '@7even/contracts';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorNotice, Field, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../lib/api.ts';

export function ProfileView({ user }: { user: SessionUser }) {
  const { refresh, logout } = useSession();
  const { showSuccess } = useFeedback();
  const navigate = useNavigate();
  const [name, setName] = useState(user.displayName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<SessionUser>('/me', {
        method: 'PATCH',
        body: { displayName: name.trim(), phone: phone.trim() },
        idempotencyKey: attempt.current,
      });
      await refresh();
      showSuccess('Your name and phone number have been saved.', 'Profile saved.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not save your profile. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await logout();
      showSuccess('You have signed out of this device.', 'Signed out.');
      navigate('/');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'We could not sign you out. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="customer-profile">
      <section aria-labelledby="profile-details-title">
        <span className="public-eyebrow">The essentials</span>
        <h2 id="profile-details-title">A little about you.</h2>
        <Link className="text-button" to="/app/security">
          Change your password
        </Link>
        <form
          onSubmit={save}
          onChange={() => {
            attempt.current = crypto.randomUUID();
          }}
        >
          <Field label="Your name">
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Email address" hint="Your email identifies your 7even account.">
            <input
              className="field-input"
              type="email"
              value={user.email}
              readOnly
              autoComplete="email"
            />
          </Field>
          <Field label="Phone number" hint="Optional.">
            <input
              className="field-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              maxLength={30}
            />
          </Field>
          {error && <ErrorNotice message={error} />}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save your details'}
          </button>
        </form>
      </section>
      <aside>
        <span className="public-eyebrow">Your account</span>
        <h2>Keep it yours.</h2>
        <p>
          Sign out when you've finished on a shared device. Your bookings, points and benefits stay
          in your account.
        </p>
        <button className="btn btn-secondary" type="button" onClick={signOut} disabled={busy}>
          Sign out
        </button>
      </aside>
    </div>
  );
}

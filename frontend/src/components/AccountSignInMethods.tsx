import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { Fingerprint } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api.ts';
import {
  ProviderIcon,
  passkeyErrorMessage,
  type AuthenticationMethods,
  type SocialProvider,
} from './AuthenticationOptions.tsx';
import { Field, Modal, useFeedback } from './ui.tsx';

interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}
interface SocialAccount {
  provider: SocialProvider;
  linkedAt: string;
}
type MethodDialog =
  | { kind: 'add' }
  | { kind: 'remove'; passkey: Passkey }
  | { kind: 'link'; provider: SocialProvider };

export function AccountSignInMethods() {
  const { showError, showSuccess } = useFeedback();
  const [params, setParams] = useSearchParams();
  const [methods, setMethods] = useState<AuthenticationMethods | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<MethodDialog | null>(null);
  const [name, setName] = useState('My passkey');
  const [password, setPassword] = useState('');
  const handledLink = useRef(false);
  const supported = browserSupportsWebAuthn() && window.isSecureContext;

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision refreshes methods after a committed change or explicit retry.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    void Promise.all([
      api<AuthenticationMethods>('/auth/methods', { signal: controller.signal }),
      api<{ passkeys: Passkey[] }>('/auth/passkeys', { signal: controller.signal }),
      api<{ accounts: SocialAccount[] }>('/auth/social/accounts', { signal: controller.signal }),
    ])
      .then(([available, keys, social]) => {
        if (controller.signal.aborted) return;
        setMethods(available);
        setPasskeys(keys.passkeys);
        setAccounts(social.accounts);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
          showError('Your sign-in methods could not load. Please try again.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, showError]);

  useEffect(() => {
    if (params.get('authSuccess') !== 'linked' || handledLink.current) return;
    handledLink.current = true;
    showSuccess(
      'You can now use this sign-in method for your 7even account.',
      'Account connected.',
    );
    setRevision((value) => value + 1);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('authSuccess');
        return next;
      },
      { replace: true },
    );
  }, [params, setParams, showSuccess]);

  function closeDialog() {
    setDialog(null);
    setPassword('');
  }
  async function connect(provider: SocialProvider, currentPassword?: string) {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>(`/auth/social/${provider}/start`, {
        method: 'POST',
        body: {
          returnTo: '/app/profile',
          intent: 'link',
          ...(currentPassword ? { currentPassword } : {}),
        },
      });
      setPassword('');
      window.location.assign(url);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'REAUTHENTICATION_REQUIRED') {
        setDialog({ kind: 'link', provider });
        setPassword('');
      } else {
        showError(cause instanceof Error ? cause.message : 'We could not connect this account.');
      }
      setBusy(false);
    }
  }
  async function savePasskey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    if (dialog.kind === 'link') {
      await connect(dialog.provider, password);
      return;
    }
    setBusy(true);
    try {
      if (dialog.kind === 'add') {
        const optionsJSON = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>(
          '/auth/passkeys/registration/options',
          { method: 'POST', body: {} },
        );
        const response = await startRegistration({ optionsJSON });
        await api('/auth/passkeys/registration/verify', {
          method: 'POST',
          body: { response, name: name.trim() || 'My passkey' },
        });
        showSuccess(
          'Use this passkey the next time you sign in on a supported device.',
          'Passkey saved.',
        );
      } else {
        await api(`/auth/passkeys/${encodeURIComponent(dialog.passkey.id)}`, {
          method: 'DELETE',
          body: password ? { currentPassword: password } : {},
        });
        showSuccess(
          'This passkey can no longer sign in to your 7even account.',
          'Passkey removed.',
        );
      }
      closeDialog();
      setRevision((value) => value + 1);
    } catch (cause) {
      showError(passkeyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const dialogTitle =
    dialog?.kind === 'add'
      ? 'Add a passkey'
      : dialog?.kind === 'remove'
        ? 'Remove this passkey?'
        : `Connect ${dialog?.kind === 'link' && dialog.provider === 'google' ? 'Google' : 'Apple'}`;
  return (
    <section className="account-signin-methods" aria-labelledby="signin-methods-title">
      <h3 id="signin-methods-title">How you sign in.</h3>
      <p>Keep your password, or add another way to access your account.</p>
      {loading ? (
        <p role="status">Loading your sign-in methods…</p>
      ) : failed ? (
        <p role="status">
          Your sign-in methods could not load.{' '}
          <button
            type="button"
            className="text-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try again
          </button>
        </p>
      ) : (
        <>
          {(['google', 'apple'] as const).map((provider) => {
            const connected = accounts.some((account) => account.provider === provider);
            return (
              <div key={provider}>
                <button
                  type="button"
                  className="signin-provider-button"
                  disabled={busy || connected || !methods?.[provider].enabled}
                  onClick={() => void connect(provider)}
                  aria-describedby={
                    !connected && !methods?.[provider].enabled
                      ? `${provider}-connect-help`
                      : undefined
                  }
                >
                  <ProviderIcon provider={provider} />
                  {provider === 'google' ? 'Google' : 'Apple'}
                  {connected && <span className="signin-connected">Connected</span>}
                </button>
                {!connected && !methods?.[provider].enabled && (
                  <p className="signin-help" id={`${provider}-connect-help`}>
                    Sign-in is coming soon.
                  </p>
                )}
              </div>
            );
          })}
          <h3>Passkeys</h3>
          <p className="signin-help">
            Use your fingerprint, Face ID or device screen lock. Your device handles verification;
            7even never receives your biometric information.
          </p>
          {passkeys.length > 0 ? (
            <ul className="passkey-list" aria-label="Your saved passkeys">
              {passkeys.map((key) => (
                <li key={key.id}>
                  <div>
                    <strong>{key.name}</strong>
                    <small>
                      Added{' '}
                      {new Date(key.createdAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                    </small>
                    <small>
                      {key.lastUsedAt
                        ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString('en-NG', { dateStyle: 'medium' })}`
                        : 'Not used yet'}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="text-button passkey-remove-button"
                    disabled={busy}
                    onClick={() => {
                      setPassword('');
                      setDialog({ kind: 'remove', passkey: key });
                    }}
                    aria-label={`Remove ${key.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="signin-help">No passkeys saved yet.</p>
          )}
          <button
            type="button"
            className="signin-provider-button signin-passkey-button"
            disabled={busy || !methods?.passkeys.enabled || !supported}
            onClick={() => {
              setName('My passkey');
              setDialog({ kind: 'add' });
            }}
            aria-describedby="add-passkey-help"
          >
            <Fingerprint size={21} aria-hidden="true" /> Add a passkey
          </button>
          <p className="signin-help" id="add-passkey-help">
            {!supported
              ? 'Use a supported browser over a secure connection to add a passkey.'
              : !methods?.passkeys.enabled
                ? 'Passkeys are not available yet.'
                : 'Save a passkey on a personal device. Avoid adding one on a shared reception computer.'}
          </p>
        </>
      )}
      {dialog && (
        <Modal title={dialogTitle} onClose={closeDialog} busy={busy}>
          <div className="signin-method-dialog">
            <form onSubmit={savePasskey}>
              {dialog.kind === 'add' ? (
                <>
                  <p>
                    Your device will ask you to confirm with its screen lock, fingerprint or Face
                    ID.
                  </p>
                  <Field
                    label="Passkey name"
                    hint="Choose a name you will recognise, such as Personal phone."
                  >
                    <input
                      className="field-input"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="off"
                      maxLength={80}
                      required
                    />
                  </Field>
                </>
              ) : (
                <>
                  <p>
                    {dialog.kind === 'remove'
                      ? `${dialog.passkey.name} will no longer give access to your account. If this is your last passkey, confirm your password to keep another way to sign in.`
                      : 'Confirm your password to connect this account. If you use a passkey instead, sign out and back in, then try again.'}
                  </p>
                  <Field
                    label={
                      dialog.kind === 'link' ? 'Current password' : 'Current password (if needed)'
                    }
                  >
                    <input
                      className="field-input"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required={dialog.kind === 'link'}
                      maxLength={128}
                    />
                  </Field>
                </>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={closeDialog}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy
                    ? 'Please wait…'
                    : dialog.kind === 'add'
                      ? 'Continue'
                      : dialog.kind === 'remove'
                        ? 'Remove passkey'
                        : 'Connect account'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </section>
  );
}

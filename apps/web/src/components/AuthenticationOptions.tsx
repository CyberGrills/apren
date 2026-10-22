import type { SessionData } from '@7even/contracts';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext.tsx';
import { api } from '../lib/api.ts';
import { useFeedback } from './ui.tsx';

export interface AuthenticationMethods {
  google: { enabled: boolean };
  apple: { enabled: boolean };
  passkeys: { enabled: boolean };
}
export type SocialProvider = 'google' | 'apple';

export function ProviderIcon({ provider }: { provider: SocialProvider }) {
  return provider === 'google' ? (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.06v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.31.32-1.92v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.52l3.34-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.48l3.34 2.6A5.94 5.94 0 0 1 12 5.96Z"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.05 12.54c.03 3.18 2.79 4.24 2.82 4.26-.02.07-.44 1.51-1.46 3-.88 1.29-1.8 2.58-3.24 2.6-1.41.03-1.87-.84-3.49-.84s-2.13.82-3.47.87c-1.39.05-2.45-1.4-3.34-2.68C3.05 17.13 1.65 12.34 3.53 9.1a5.18 5.18 0 0 1 4.4-2.66c1.37-.03 2.66.93 3.49.93.83 0 2.39-1.15 4.03-.98.69.03 2.63.28 3.87 2.1-.1.06-2.31 1.34-2.27 4.05ZM14.4 4.65c.74-.9 1.24-2.16 1.1-3.42-1.07.04-2.37.71-3.14 1.61-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.51Z"
      />
    </svg>
  );
}

export function passkeyErrorMessage(cause: unknown) {
  if (cause instanceof Error) {
    if (cause.name === 'NotAllowedError' || cause.name === 'AbortError')
      return 'The passkey request was cancelled or timed out. You can try again or use your password.';
    if (cause.name === 'InvalidStateError')
      return 'This passkey is already saved. Choose another device or use the passkey you already have.';
    if (cause.name === 'NotSupportedError')
      return 'This browser or device cannot use that passkey. Try another browser or sign in with your password.';
    return cause.message;
  }
  return 'We could not complete the passkey request. Please try again.';
}

export function socialErrorMessage(code: string) {
  if (code === 'existing_account')
    return 'An account already uses this email. Sign in with your existing method, then connect Google or Apple from your profile.';
  if (code === 'already_linked')
    return 'This Google or Apple account is already connected. Sign in with the method you used before, then check your profile.';
  if (code === 'email_unverified')
    return 'Your provider could not confirm this email address. Verify your email with Google or Apple, then try again.';
  if (code === 'reauthenticate')
    return 'Please sign in to your 7even account again before connecting Google or Apple.';
  if (code === 'unavailable')
    return 'This account is not available. Contact 7even support.';
  if (code === 'cancelled')
    return 'Sign-in was cancelled. You can try again or use your email and password.';
  return 'We could not complete that sign-in. Please try again or use your email and password.';
}

export function AuthenticationOptions({
  returnTo,
  registration,
  admin,
  busy,
  setBusy,
  onAuthenticated,
}: {
  returnTo: string;
  registration: boolean;
  admin: boolean;
  busy: boolean;
  setBusy(value: boolean): void;
  onAuthenticated(): void;
}) {
  const { completeLogin } = useSession();
  const { showError } = useFeedback();
  const [methods, setMethods] = useState<AuthenticationMethods | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const supported = browserSupportsWebAuthn() && window.isSecureContext;
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly retries the availability request.
  useEffect(() => {
    const controller = new AbortController();
    setUnavailable(false);
    void api<AuthenticationMethods>('/auth/methods', { signal: controller.signal })
      .then(setMethods)
      .catch(() => {
        if (!controller.signal.aborted) {
          setUnavailable(true);
          showError(
            'Other sign-in options could not load. You can try again or use your email and password.',
          );
        }
      });
    return () => controller.abort();
  }, [revision, showError]);

  async function social(provider: SocialProvider) {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>(`/auth/social/${provider}/start`, {
        method: 'POST',
        body: { returnTo, intent: 'login' },
      });
      window.location.assign(url);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Could not open the sign-in page.');
      setBusy(false);
    }
  }
  async function passkey() {
    setBusy(true);
    try {
      const optionsJSON = await api<Parameters<typeof startAuthentication>[0]['optionsJSON']>(
        '/auth/passkeys/authentication/options',
        { method: 'POST', body: {} },
      );
      const response = await startAuthentication({ optionsJSON });
      await completeLogin(
        await api<SessionData>('/auth/passkeys/authentication/verify', {
          method: 'POST',
          body: { response },
        }),
      );
      onAuthenticated();
    } catch (cause) {
      showError(passkeyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="authentication-options">
      {!admin && (
        <div className="social-signin-options">
          {(['google', 'apple'] as const).map((provider) => (
            <button
              type="button"
              className="signin-provider-button"
              key={provider}
              disabled={busy || !methods?.[provider].enabled}
              onClick={() => void social(provider)}
              aria-describedby={
                methods && !methods[provider].enabled ? 'social-signin-status' : undefined
              }
            >
              <ProviderIcon provider={provider} />
              Continue with {provider === 'google' ? 'Google' : 'Apple'}
            </button>
          ))}
          {methods && (!methods.google.enabled || !methods.apple.enabled) && (
            <p className="signin-help" id="social-signin-status">
              {!methods.google.enabled && !methods.apple.enabled
                ? 'Google and Apple sign-in are coming soon. Use your email for now.'
                : `${methods.google.enabled ? 'Apple' : 'Google'} sign-in is coming soon.`}
            </p>
          )}
        </div>
      )}
      {!registration && (
        <div className="passkey-signin-option">
          <button
            type="button"
            className="signin-provider-button signin-passkey-button"
            disabled={busy || !methods?.passkeys.enabled || !supported}
            onClick={() => void passkey()}
            aria-describedby="passkey-signin-help"
          >
            <Fingerprint size={21} aria-hidden="true" />
            Sign in with a passkey
          </button>
          <p className="signin-help" id="passkey-signin-help">
            {!supported
              ? 'Passkeys need a supported browser and a secure connection. You can use your password below.'
              : methods && !methods.passkeys.enabled
                ? 'Open 7even using its website address to use a passkey. You can use your password below.'
                : 'Fingerprint, Face ID or your device screen lock. Add a passkey from your profile after signing in.'}
          </p>
        </div>
      )}
      {unavailable && (
        <p className="signin-help" role="status">
          Other sign-in options could not load.{' '}
          <button
            type="button"
            className="text-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try again
          </button>
        </p>
      )}
      <p className="signin-divider">or use your {admin ? 'password' : 'email'}</p>
    </div>
  );
}

# Google, Apple and passkey sign-in

7even keeps its existing email/password login and opaque session cookies. Google and Apple use the same accounts and sessions. Passkeys use WebAuthn; a device may ask for a fingerprint, Face ID, a PIN or another device unlock method. 7even never receives biometric data.

## Configuration

Keep credentials in the server environment, never in `VITE_` variables or the repository. Set `APP_ORIGIN` to the exact HTTPS origin users will visit, with no path or trailing slash. Local development can use `http://127.0.0.1:5177`.

| Variable | Value to obtain |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth web application client ID |
| `GOOGLE_CLIENT_SECRET` | Matching Google client secret |
| `APPLE_CLIENT_ID` | Apple Services ID configured for Sign in with Apple |
| `APPLE_TEAM_ID` | Apple developer Team ID |
| `APPLE_KEY_ID` | ID of the Sign in with Apple signing key |
| `APPLE_PRIVATE_KEY` | The private PKCS8 `.p8` key, with real or escaped newlines |

Google and Apple are reported unavailable by `GET /api/auth/methods` until their configuration is present. The login page explains this; it does not pretend a provider has authenticated a customer. Neither provider is configured for this project yet.

### Google

Create a web application OAuth client, configure the consent screen and authorized users, and register this exact redirect URI:

`https://apren.vercel.app/api/auth/social/google/callback`

For local development, register the corresponding `APP_ORIGIN` callback separately. The integration uses authorization code exchange, PKCE and a nonce. It validates the ID token's signature, issuer, audience, expiry and nonce before creating a session.

### Apple

Configure an Apple App ID and Services ID for Sign in with Apple. Verify the website domain in the Apple developer account and register:

`https://apren.vercel.app/api/auth/social/apple/callback`

Apple requires an HTTPS return URL on a supported domain. Use a separate configured HTTPS test origin for end-to-end testing. The integration creates the signed client secret on the server and validates Apple's ID token. Its form POST callback is the only authentication POST exempt from the ordinary same-origin middleware; a short-lived, single-use database challenge and secure browser-binding cookie protect that callback.

If the deployment domain changes, register new exact callback URLs with both providers and update `APP_ORIGIN` together.

## Accounts and passkeys

An existing email address is never automatically linked to a provider identity. Sign in with the existing method, open **Profile**, then connect Google or Apple. Linking requires a recent session or password confirmation. New social accounts receive the customer role; a provider login cannot grant staff access.

Passkeys need HTTPS on a domain name, or `http://localhost:5177` for development. IP-address origins such as `127.0.0.1` cannot be relying-party domains and are reported unavailable. The relying-party ID comes from `APP_ORIGIN`'s hostname. Choose the permanent customer domain before inviting customers to enrol: a passkey belongs to that domain. Devices and password managers decide which unlock method is available.

To add a passkey, sign in, open **Profile**, name the passkey and follow the device prompt. Registration and removal require a recent sign-in. Registration requests a discoverable credential and user verification. Login checks the proof, origin, relying-party ID, credential owner and active account before issuing a session. Challenges are short-lived and single-use, with separate browser bindings for registration and login. Public keys and counters are stored; private keys stay with the authenticator.

## Verification and release

Run `npm test`, `npm run test:integration` with the isolated PostgreSQL test database configured, and `npm run build`. Authentication tests cover real database state and cryptographic WebAuthn proofs. Provider tests use injected external-provider responses and local signed-token fixtures; they cannot replace a real Google or Apple account test.

Before production activation, configure the provider consoles, test successful and cancelled sign-in on the actual domain, and check linking, rejected state, cookie behavior and supported devices. Test Apple on Safari and Google in its allowed test-user configuration. The browser tool available for this task does not expose a virtual authenticator. The automated tests exercise real signed WebAuthn responses, but device enrollment and physical Face ID or fingerprint behavior still need a supported browser and device.

These changes affect authentication and add database tables. The repository policy requires qualified human review before production release. After approval, apply migrations `021_social_auth.sql` and `022_passkeys.sql` with `npm run db:migrate` using the production migration administrator connection before promoting the application. Vercel application deployment does not run database migrations. Verify the applied migration checksums and new table privileges in the target database.

The migrations are additive; rollback the application first if needed and retain authentication records for investigation. Do not edit an applied migration or delete real identity/passkey records as a rollback.

## Official references

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Configure Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
- [SimpleWebAuthn server](https://simplewebauthn.dev/docs/packages/server)
- [SimpleWebAuthn browser](https://simplewebauthn.dev/docs/packages/browser)

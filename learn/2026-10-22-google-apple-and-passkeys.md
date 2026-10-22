# More ways to sign in

2026-10-22 · Add Google, Apple and passkey sign-in to 7even.

## In short

7even now has Google and Apple integration code and passkey enrollment, login and removal. They use the existing account and session system. Google and Apple stay visibly unavailable until their server credentials are configured.

## What changed

- `services/platform/src/socialAuth.ts` validates provider identities and handles explicit account linking. `passkeys.ts` verifies WebAuthn proofs. `app.ts` mounts these routes and reports available methods.
- `database/migrations/021_social_auth.sql` and `022_passkeys.sql` add identity, credential and expiring challenge tables, with restricted server permissions.
- `apps/web/src/components/AuthenticationOptions.tsx` adds login choices. `AccountSignInMethods.tsx` manages connections and passkeys in `pages/customer/ProfileView.tsx`.
- `pages/public/AuthPage.tsx`, `context/SessionContext.tsx`, `styles/authentication.css` and `main.tsx`, under `apps/web/src/`, connect the flows to existing session adoption, feedback popups and responsive styling.
- `tests/integration/social-auth.test.ts`, `passkeys.test.ts` and `auth-methods-http.test.ts` exercise provider claims, real cryptographic proofs and HTTP protections.
- The web/platform `package.json` files and root `package-lock.json` add the WebAuthn/JWT packages and the compatible Vite advisory fix. `.env.example` lists blank provider settings; `docs/sign-in-setup.md` records setup and release steps, linked from `README.md`.

## How it works

1. Login loads method availability. A configured provider starts an authorization request with a random state, browser binding and nonce.
2. The callback consumes the matching database challenge once, then verifies the provider proof. A matching email alone cannot connect an existing account. Existing users explicitly connect from their signed-in profile.
3. A signed-in user can enroll a passkey. The authenticator retains the private key; 7even stores its public key and credential identifier.
4. At login, the authenticator signs a fresh challenge. The server checks the signature, website origin, relying-party domain, user verification and owner before issuing a normal 7even session.
5. Credential changes lock the user row and recheck the session inside the transaction. A concurrent password reset can revoke access before any credential is changed.

## Why it's built this way

Using the current session system preserves roles, CSRF checks and reception queue ownership. PostgreSQL stores challenges so retries and multiple server processes share the same single-use decision. IP addresses are unavailable for passkeys because browsers require a valid relying-party domain.

## The concept worth knowing

A passkey is like a seal: the device keeps the seal, while the website knows how to recognize its impression. Precisely, a private key signs a fresh challenge and the server verifies it using the stored public key. A fingerprint or Face ID unlocks the authenticator locally; 7even does not receive biometric data.

## Watch out for

Google and Apple console setup and live provider testing remain outstanding. Software-signed WebAuthn tests passed, but this browser tool cannot emulate an authenticator, and physical biometric hardware is untested. Use `localhost` for local passkeys and a permanent HTTPS domain in deployment. Production requires qualified review and applying both migrations before promotion.

## Check yourself

1. Why does a matching Google email not automatically connect an account?
<details><summary>Answer</summary>Account ownership must be established through the existing sign-in method before adding another identity. The durable provider subject identifies a connected account.</details>

2. What if ten servers receive the same challenge response?
<details><summary>Answer</summary>The database consumes the challenge once. Only one request can continue; the others cannot create additional sessions from that proof.</details>

3. Why check the session again after locking the user?
<details><summary>Answer</summary>A reset could revoke it after middleware first read it. The transaction must reject that stale authorization before changing credentials.</details>

## Explain it back

Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

*Made with Edirae Learn · edirae.com*

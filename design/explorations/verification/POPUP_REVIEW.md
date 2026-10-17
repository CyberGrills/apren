# Customer feedback popups

16 October 2026. Follow-up to the user's request for errors and action confirmations to appear as popups.

## Implementation

Public and customer mutation handlers now call the shared feedback provider directly after a confirmed server result. This keeps the success message alive when a form closes or navigation replaces the page. Profile saves, sign-in/account creation, business applications, reward claims, gift/swap offers, exchange decisions, booking cancellations and marking an update read all use this path.

The local mock checkout announces the server-recorded outcome. The payment-return page announces a newly verified outcome once per payment ID and status. Neither booking polls nor ordinary account refreshes create success popups. Payment, settlement, reservation, benefit and application status remain visible as records after a popup closes. Existing important warnings about an uncertain payment or points adjustment remain alongside those records.

All errors continue through the existing ErrorNotice interface, which the root implementation now routes to a native dialog. The missing-reference and unavailable-test-checkout errors also use it. The four customer action dialogs pass their busy state to the shared Modal. Request bodies, financial calculations and retry keys are unchanged.

Owned inline success banners and their unused CSS were removed. The root implementation owns the shared FeedbackProvider, dialog styling, ErrorNotice bridge, focus handling and queue.

## Verification so far

- Biome lint: all 19 public/customer files passed, with no warnings.
- Frontend production build passed with 1,837 modules. JavaScript was 390.51 kB / 112.97 kB gzip; CSS was 54.82 kB / 10.54 kB gzip. The root team continued shared changes afterward.
- A fresh repository-wide TypeScript check passed after the recovery mailer integration was resolved.
- An actual failed local sign-in request opened a centered error popup with an inert background. Dismissal through Got it and Escape worked, and a subsequent failed attempt opened the popup again. No inline error banner remained.
- Desktop and mobile screenshots are `popup-error-desktop.jpg` and `popup-error-mobile.jpg`. At a configured 390-pixel viewport, the dialog measured about 337 pixels within a 375-pixel document and did not overflow.

The first browser pass revealed that native dialog dismissal alone returned focus to the body in an asynchronous login case. The root implementer added explicit form focus restoration, linked-message dismissal and explicit retry error clearing. The later profile-success test confirmed that closing feedback restores focus to the profile's name input.

## Final browser pass after backend recovery

- Existing local guest sign-in succeeded. Its success popup remained visible after navigation to bookings. Evidence: `popup-signin-success-desktop.jpg`.
- Saving the guest's existing profile values succeeded and opened a success popup. Its mobile layout fitted within the viewport. Dismissing it returned focus to the name input. Evidence: `popup-profile-success-mobile.jpg`.
- The reward claim confirmation opened as a native modal. Escape closed it without a claim. The visible balance remained 1,750 points and the reward's remaining capacity remained 49. Evidence: `popup-reward-confirmation-desktop.jpg`.
- Shared Modal source disables its close button while busy and prevents native Escape dismissal before checking the busy guard. A slow-request Escape interaction was not forced through network overrides, so that particular manual case is source-reviewed rather than browser-proven.
- The optional invalid-recipient gift-form test was skipped because the guest has no eligible benefit after the earlier transfer. A new benefit was not claimed just to create this case. Nested error dismissal therefore remains an explicit untested case.
- The browser caught the known development SessionProvider hot-update error while another team member edited the shared module. A full reload recovered the page. There were no new console errors after that final reload, including the confirmation open/close interaction.

The initial read-only confirmation test found that closing the shared action Modal returned focus to the body. The root implementer added explicit opener restoration. A fresh browser pass then focused the reward trigger, opened it with keyboard Enter and closed it with Escape. Focus returned to the `Use your points` button and no dialog remained open. No points or reward capacity changed.

## Final shared navigation and focus checks

The existing host fixture signed in and reached the business workspace. The success popup's primary Continue button received initial focus. At mobile width, the workspace drawer opened with its own Close navigation button focused. Shift+Tab wrapped to Sign out, and Tab wrapped back to Close navigation, keeping keyboard focus inside the drawer. Both Escape and the internal close button dismissed it and returned focus to Open navigation with `aria-expanded=false`.

Evidence: `workspace-drawer-mobile.jpg`. This fresh browser tab reported no console errors. The viewport override was reset after testing. Only the existing local fixture session was switched; no business, access, payment or reward action was submitted.

## Final independent code review and retry proof

The final review covered all error/success feedback call sites, recovery and password screens, confirmation dialogs, native dialog ordering, explicit retries and deduplication. Persistent transaction statuses and empty states were left as records. The review found and fixed these gaps in the five files authorized by the root agent:

- Clear an earlier operations-decision, reception-sync or session-read error before its next asynchronous attempt, allowing a later identical error to mount a fresh popup.
- Show a missing password-reset token as an error popup while keeping the request-link action on the page.
- Handle the required offering-editor venues query's loading, failed and empty outcomes, provide retry, and block save until a venue is available. Other editor types no longer make this unnecessary query.
- Catch a failed IndexedDB queue dismissal and route it to the queue error popup instead of leaving an unhandled rejection.

A controlled browser fault test blocked only the new review tab's exact local `/api/auth/session` request. This exposed a retry regression: clearing an initial session error while loading was false let Protected redirect to login before the retry completed. The refresh now enters its loading state before clearing the error, preserving the protected route until the attempt resolves.

The corrected path was tested with two consecutive, identical blocked reads. Each explicit Try again produced a distinct failed Fetch event and a fresh error dialog, with heading IDs `_r_2_`, `_r_4_`, then `_r_6_`. The route remained `/business` throughout. Evidence: `popup-repeat-read-error-desktop.jpg`.

The exact request-block rule was then removed, the page was reloaded successfully to the business workspace with no popup open, Network inspection was disabled and the review tab was closed. No network override remains. This proves frontend retry/failure/recovery behavior under a controlled read fault. It is not an offline test, backend outage test or financial test.

Fresh TypeScript checking passed after the final session-loading fix. Focused Biome lint exited successfully; it reported three pre-existing non-null assertion warnings in ReceptionPage, with no errors. Public/customer action handlers already clear their per-attempt errors. No idempotency key, payload, financial calculation or session-adoption operation was changed.

No new payment, reward, gift or consumption changes were made during this popup verification pass. The only data mutation was an authorized save of unchanged local fixture profile values. Earlier complete local mock journey evidence remains in REVIEW.md, and must not be presented as a test of these later popup changes. The test viewport override was reset.

# Logo verification

Checked locally on 2026-10-21. Branch: `feat/logo-wordmark-intro`, based on `origin/main` at `f4492b9b653a3a705adbfbbd1119b65e53d55348`.

## Result

- Header and footer show one large two-stripe 7 followed by EVEN. The compact variant contains the mark alone.
- Normal startup exposes two animation paths: first duration 300 ms with no delay, second duration 300 ms with a 320 ms delay. The overlay then fades and unmounts.
- The overlay uses Forest Green on Warm Ivory, is hidden from assistive technology and has no pointer hit area.
- Keyboard Tab dismisses the overlay and reaches the existing Skip to content link. A pointer click from a freshly observed page dismisses it and opens Stays. SPA navigation does not replay it.
- Reduced-motion emulation produces no intro element. Changing to reduced motion while the intro is active also removes it. Media emulation and temporary viewport overrides were restored after testing.
- At 390, 768 and 1280 px, logo/caption bounds remain inside their SVG and the document has no horizontal overflow. Phone and tablet measurements are in `responsive.json`.
- Final browser warning/error log query returned an empty list. An earlier local API error was resolved by applying main's existing migrations 010 and 011 to the saved development database. No seed data or inventory timestamps were altered to fake freshness.

## Commands

- `npm test`: 242 passed, 0 failed, 0 skipped.
- `npm run build`: typecheck and production build passed.
- `npx biome check apps/web/src/components/Brand.tsx apps/web/src/components/BrandIntro.tsx apps/web/src/main.tsx`: no errors; one existing warning for the root element non-null assertion in main.tsx.
- `git diff --check`: passed.
- Independent source review: no actionable findings in the logo, intro, mounting or affected callers.

No backend, payment or persisted-data behavior was changed. Provider sandbox tests and the database integration suite were not rerun for this frontend change. These checks do not establish production payment readiness.

## Artifacts

- `home-desktop.png`, `home-tablet.png`, `home-phone.png`: settled responsive views.
- `startup-state.json`: observed stripe animation timing, color and pointer behavior.
- `responsive.json`: measured phone/tablet logo and caption bounds.

An immediate automation click before a fresh page observation missed navigation both with and without the intro. Retesting from a freshly observed page succeeded while the intro was present. This did not establish a logo regression, so no unrelated navigation change was made.

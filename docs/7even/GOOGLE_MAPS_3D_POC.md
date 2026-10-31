# Google Maps 3D prototype — 7even

## Purpose

This is an isolated frontend proof of concept for the 7even 45-degree map direction. It must not change the booking journey, inventory, rates, payments, guest messaging, or production database.

## Development route

Run the web app locally and open `/dev/map-3d`. The route is only registered in Vite development mode. The page uses an approximate Uyo city-centre camera target for visual testing; it is not a hotel coordinate and must never be presented as a property marker.

## Local configuration

Add the following to the local `apps/web/.env.local` (do not commit the real value):

```dotenv
VITE_GOOGLE_MAPS_API_KEY=
```

Restart the Vite server after changing environment variables. Vite client variables are included in browser assets, so this key is expected to be visible to the browser and must be protected with Google Cloud restrictions.

## Google Cloud prerequisites

1. Enable Maps JavaScript API on the intended Google Cloud project.
2. Create a dedicated browser key for the 7even preview.
3. Restrict application access to exact development and approved preview HTTPS referrers. Do not use an unrestricted key or broad wildcard.
4. Restrict API access to Maps JavaScript API.
5. Set conservative quotas and budget alerts before testing. Do not enable or change billing without the account owner's approval.
6. Keep the key out of Git, issue comments, screenshots and logs. Rotate it if it is exposed outside the approved browser configuration.

Google's 3D Maps library is loaded from the Maps JavaScript API beta channel. The map's `mode` is explicitly set to `HYBRID`; the initial camera tilt is 45 degrees. The implementation uses the official `Map3DElement` interface.

## Acceptance gates before production integration

- Verify API key referrer and API restrictions in Google Cloud.
- Confirm successful map initialization on current iOS Safari, Android Chrome and desktop Chrome.
- Test hardware acceleration disabled and WebGL/3D failure paths.
- Measure initial load, memory and scroll performance on a mid-range mobile device.
- Confirm reduced-motion and keyboard-accessibility behavior.
- Replace the approximate city-centre target only with coordinates validated from an authorized source.
- Add property markers only for partner-confirmed properties with verified coordinates.
- Add scroll-driven camera movement only after the map foundation passes the above checks.
- Keep a static map or editorial fallback available when 3D is unavailable.

## Official references

- [3D Maps reference](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [45-degree 3D map example](https://developers.google.com/maps/documentation/javascript/maptypes)
- [3D map modes](https://developers.google.com/maps/documentation/javascript/3d/map-modes)
- [Google Maps API key setup](https://developers.google.com/maps/documentation/javascript/get-api-key)
- [Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices)

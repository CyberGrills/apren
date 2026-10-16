const isDevelopment = import.meta.env.DEV;

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

const configuredGateway = cleanUrl(import.meta.env.VITE_GATEWAY_URL)
  .replace(/\/api$/i, "");

// Never silently send production API requests to the static frontend origin.
// A production build must declare the actual reachable gateway origin.
if (!isDevelopment && !configuredGateway) {
  throw new Error(
    "āprən production API is not configured: set VITE_GATEWAY_URL to the HTTPS origin of the deployed gateway before building."
  );
}

export const GATEWAY_ORIGIN = isDevelopment
  ? configuredGateway || "http://localhost:4000"
  : configuredGateway;

export const GATEWAY_API = `${GATEWAY_ORIGIN}/api`;

function serviceUrl(override, port) {
  return cleanUrl(override) || (
    isDevelopment ? `http://localhost:${port}` : GATEWAY_API
  );
}

// In production, service requests use the gateway unless a service-specific
// VITE_*_URL explicitly points to a separately deployed backend service.
export const SERVICES = {
  identity: serviceUrl(import.meta.env.VITE_IDENTITY_URL, 4001),
  wallet: serviceUrl(import.meta.env.VITE_WALLET_URL, 4002),
  assets: serviceUrl(import.meta.env.VITE_ASSET_API || import.meta.env.VITE_ASSETS_URL, 4003),
  market: serviceUrl(import.meta.env.VITE_MARKET_URL, 4004),
  intelligence: serviceUrl(import.meta.env.VITE_INTELLIGENCE_URL, 4005),
  trade: serviceUrl(import.meta.env.VITE_TRADE_URL, 4006),
  notification: null
};

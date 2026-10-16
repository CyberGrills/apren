const isDevelopment = import.meta.env.DEV;

function cleanUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export const GATEWAY_ORIGIN = cleanUrl(
  import.meta.env.VITE_GATEWAY_URL ||
    (isDevelopment ? "http://localhost:4000" : window.location.origin)
).replace(/\/api$/i, "");

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

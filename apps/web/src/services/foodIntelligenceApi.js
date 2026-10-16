import { SERVICES } from "../config/services";

const ASSET_API = SERVICES.assets;

function authHeaders() {
  try {
    const token = window.sessionStorage.getItem("seven_access_token") || "";
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${ASSET_API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Food intelligence API error ${response.status}`);
  return response.json();
}

export function getFoodAsset(id) {
  return request(`/asset-profile/${id}`);
}

export function analyzeFood(id) {
  return request(`/assets/${id}/analyze-food`, { method: "POST" });
}

export function getMarketValue(id) {
  return request(`/assets/${id}/market-value`);
}

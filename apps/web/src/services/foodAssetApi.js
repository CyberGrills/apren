import { SERVICES } from "../config/services";

const API = SERVICES.assets;

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  try {
    const token = window.sessionStorage.getItem("seven_access_token") || "";
    if (token && !headers.authorization) headers.authorization = `Bearer ${token}`;
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`Asset API error ${res.status}`);
  return res.json();
}

export function getAsset(id) {
  return request(`/assets/${id}`);
}

export function getAssetProfile(id) {
  return request(`/asset-profile/${id}`);
}

export function analyzeFood(id) {
  return request(`/assets/${id}/analyze-food`, { method: "POST" });
}

export function getMarketValue(id) {
  return request(`/assets/${id}/market-value`);
}

export function getMarketIntelligence(id) {
  return request(`/assets/${id}/market-intelligence`);
}

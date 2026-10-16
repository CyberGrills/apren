import { GATEWAY_API } from "../config/services";

export async function getFoodAssets() {
  const response = await fetch(`${GATEWAY_API}/assets`, {
    headers: accessTokenHeaders()
  });

  if (!response.ok) {
    throw new Error(`Unable to load food assets (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.assets;
}

function accessTokenHeaders() {
  try {
    const token = window.sessionStorage.getItem("seven_access_token") || "";
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

import { SERVICES } from "../config/services";

const WALLET_URL = SERVICES.wallet;

export async function getWallet(userId = 1) {
  try {
    const headers = {};
    try {
      const token = window.sessionStorage.getItem("seven_access_token") || "";
      if (token) headers.authorization = `Bearer ${token}`;
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }

    const res = await fetch(`${WALLET_URL}/wallet/${userId}`, { headers });
    if (!res.ok) throw new Error(`Wallet request failed (HTTP ${res.status})`);
    return await res.json();
  } catch (error) {
    console.error("Wallet service unavailable:", error);
    return { wallets: [] };
  }
}

import { useEffect, useState } from "react";
import { getWallet } from "../services/api/walletApi";
import { getUserPreferences } from "../services/api/userPreferenceApi";
import { mapWallet } from "../services/mappers/walletMapper";

function readSession() {
  try {
    const token = window.sessionStorage.getItem("seven_access_token") || "";
    const user = JSON.parse(window.sessionStorage.getItem("seven_user") || "null");
    return { token, userId: Number(user?.id) || null };
  } catch {
    return { token: "", userId: null };
  }
}

export function useWalletIntelligence(userId = 1) {
  const [wallet, setWallet] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const session = readSession();

      // Identity preferences are protected. Do not call the API as an anonymous
      // visitor or pretend that user 1 is the currently signed-in user.
      if (!session.token) {
        setWallet(null);
        setPreferences(null);
        setLoading(false);
        return;
      }

      const effectiveUserId = session.userId || userId;

      try {
        const [walletData, preferenceData] = await Promise.all([
          getWallet(effectiveUserId),
          getUserPreferences(effectiveUserId)
        ]);

        if (!active) return;
        setWallet(walletData ? mapWallet(walletData) : null);
        setPreferences(preferenceData?.preferences || null);
      } catch (error) {
        if (active) console.error("Wallet intelligence failed", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const refresh = () => { void load(); };
    window.addEventListener("apren:auth-changed", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      active = false;
      window.removeEventListener("apren:auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  return { wallet, preferences, loading };
}

import type { SessionData } from '@7even/contracts';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setCsrfToken } from '../lib/api.ts';
import { clearQueues, restrictQueueOwner } from '../lib/receptionQueue.ts';
function useSessionState() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const adoptSession = useCallback(async (next: SessionData) => {
    await restrictQueueOwner(
      next.user?.businessId ? `${next.user.id}:${next.user.businessId}:` : null,
    ).catch(() => {});
    setCsrfToken(next.csrfToken);
    setSession(next);
    setError(null);
    setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await adoptSession(await api<SessionData>('/auth/session'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to 7even.');
    } finally {
      setLoading(false);
    }
  }, [adoptSession]);
  useEffect(() => {
    void refresh();
    const expire = () => {
      setSession(null);
      setCsrfToken(null);
      void clearQueues().catch(() => {});
    };
    window.addEventListener('seven:session-expired', expire);
    return () => window.removeEventListener('seven:session-expired', expire);
  }, [refresh]);
  async function login(email: string, password: string) {
    await adoptSession(
      await api<SessionData>('/auth/login', { method: 'POST', body: { email, password } }),
    );
  }
  async function register(displayName: string, email: string, password: string) {
    await adoptSession(
      await api<SessionData>('/auth/register', {
        method: 'POST',
        body: { displayName, email, password },
      }),
    );
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST', idempotencyKey: crypto.randomUUID() });
    await clearQueues().catch(() => {});
    setCsrfToken(null);
    setSession(null);
    window.dispatchEvent(new Event('seven:logout'));
    await refresh();
  }
  return { session, user: session?.user ?? null, loading, error, refresh, login, register, logout };
}
const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSessionState();
  return <SessionContext value={value}>{children}</SessionContext>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is missing.');
  return value;
}

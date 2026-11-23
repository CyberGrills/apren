import type { SessionData } from '@7even/contracts';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, api, setCsrfToken } from '../lib/api.ts';
import { clearQueues, restrictQueueOwner } from '../lib/receptionQueue.ts';
function useSessionState() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A session restore can overlap a successful login. Only the newest auth
  // operation is allowed to commit state, otherwise a late 401 can erase it.
  const sessionRevision = useRef(0);
  const adoptSession = useCallback(async (next: SessionData) => {
    const revision = ++sessionRevision.current;
    await restrictQueueOwner(
      next.user?.businessId ? `${next.user.id}:${next.user.businessId}:` : null,
    ).catch(() => {});
    if (revision !== sessionRevision.current) return;
    setCsrfToken(next.csrfToken);
    setSession(next);
    setError(null);
    setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    const revision = ++sessionRevision.current;
    setLoading(true);
    setError(null);
    try {
      const next = await api<SessionData>('/auth/session');
      if (revision !== sessionRevision.current) return;
      await adoptSession(next);
    } catch (cause) {
      if (revision !== sessionRevision.current) return;
      // No cookie is the normal signed-out state, not an application failure.
      if (cause instanceof ApiError && cause.status === 401 && cause.code === 'AUTHENTICATION_REQUIRED') {
        setSession(null);
        setCsrfToken(null);
        setError(null);
      } else {
        setError(cause instanceof Error ? cause.message : 'Could not connect to 7even.');
      }
    } finally {
      if (revision === sessionRevision.current) setLoading(false);
    }
  }, [adoptSession]);
  useEffect(() => {
    void refresh();
    const expire = () => {
      sessionRevision.current += 1;
      setSession(null);
      setCsrfToken(null);
      setError(null);
      setLoading(false);
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
    sessionRevision.current += 1;
    await clearQueues().catch(() => {});
    setCsrfToken(null);
    setSession(null);
    window.dispatchEvent(new Event('seven:logout'));
    await refresh();
  }
  return {
    session,
    user: session?.user ?? null,
    loading,
    error,
    refresh,
    login,
    register,
    logout,
    completeLogin: adoptSession,
  };
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

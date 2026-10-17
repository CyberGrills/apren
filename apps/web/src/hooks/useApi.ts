import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const loadedPath = useRef<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    setRevision((value) => value + 1);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision deliberately invalidates the read after a committed mutation.
  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    if (loadedPath.current !== path) {
      setData(null);
      setLoading(true);
    }
    async function read() {
      if (document.hidden) {
        timer = setTimeout(read, 20000);
        return;
      }
      try {
        const next = await api<T>(path!, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setData(next);
          loadedPath.current = path;
          setError(null);
          failures = 0;
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load this page.');
          failures++;
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(read, Math.min(120000, 20000 * 2 ** failures));
        }
      }
    }
    void read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, revision]);
  useEffect(() => {
    window.addEventListener('seven:changed', reload);
    window.addEventListener('online', reload);
    return () => {
      window.removeEventListener('seven:changed', reload);
      window.removeEventListener('online', reload);
    };
  }, [reload]);
  return { data, loading, error, reload };
}

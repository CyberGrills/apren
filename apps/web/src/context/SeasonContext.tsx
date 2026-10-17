import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { seasonAt, watchSeason, type Season, type SeasonClock } from '../lib/season.ts';

const SeasonContext = createContext<Season | null>(null);
const browserClock: SeasonClock = {
  now: () => new Date(),
  schedule(callback, delay) {
    const timer = window.setTimeout(callback, delay);
    return () => window.clearTimeout(timer);
  },
  onResume(callback) {
    const visible = () => {
      if (document.visibilityState === 'visible') callback();
    };
    window.addEventListener('focus', callback);
    window.addEventListener('pageshow', callback);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', callback);
      window.removeEventListener('pageshow', callback);
      document.removeEventListener('visibilitychange', visible);
    };
  },
};
export function SeasonProvider({ children }: { children: ReactNode }) {
  const [season, setSeason] = useState(() => seasonAt(new Date()));
  useEffect(() => watchSeason(setSeason, browserClock), []);
  // Commit the CSS selector with the campaign content, before the browser paints it.
  useLayoutEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);
  return <SeasonContext value={season}>{children}</SeasonContext>;
}
export function useSeason(): Season {
  const value = useContext(SeasonContext);
  if (!value) throw new Error('SeasonProvider is missing.');
  return value;
}

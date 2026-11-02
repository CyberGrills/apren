import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { seasonAt, watchSeason, type Season, type SeasonClock } from '../lib/season.ts';

export type SeasonPreference = 'auto' | Season;
interface SeasonContextValue {
  season: Season;
  preference: SeasonPreference;
  setPreference: (preference: SeasonPreference) => void;
}
const SeasonContext = createContext<SeasonContextValue | null>(null);
const preferenceKey = '7even-season-theme';
const isSeason = (value: string | null): value is Season =>
  value === 'spring' || value === 'summer' || value === 'autumn' || value === 'winter';
function readPreference(): SeasonPreference {
  try {
    const saved = window.localStorage.getItem(preferenceKey);
    return saved === 'auto' || isSeason(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}
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
  const [calendarSeason, setCalendarSeason] = useState(() => seasonAt(new Date()));
  const [preference, setPreference] = useState<SeasonPreference>(readPreference);
  const season = preference === 'auto' ? calendarSeason : preference;
  useEffect(() => watchSeason(setCalendarSeason, browserClock), []);
  useEffect(() => {
    try {
      window.localStorage.setItem(preferenceKey, preference);
    } catch {
      // Theme selection still applies for this session when storage is unavailable.
    }
  }, [preference]);
  useLayoutEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);
  return <SeasonContext value={{ season, preference, setPreference }}>{children}</SeasonContext>;
}
function useSeasonContext(): SeasonContextValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error('SeasonProvider is missing.');
  return value;
}
export function useSeason(): Season {
  return useSeasonContext().season;
}
export function useSeasonPreference(): SeasonPreference {
  return useSeasonContext().preference;
}
export function useSetSeasonPreference(): SeasonContextValue['setPreference'] {
  return useSeasonContext().setPreference;
}

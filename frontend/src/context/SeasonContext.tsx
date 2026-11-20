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
export type AppearanceModePreference = 'light' | 'dark' | 'system';
export type AppearanceMode = 'light' | 'dark';

interface SeasonContextValue {
  season: Season;
  preference: SeasonPreference;
  setPreference: (preference: SeasonPreference) => void;
  mode: AppearanceMode;
  modePreference: AppearanceModePreference;
  setModePreference: (preference: AppearanceModePreference) => void;
}
const SeasonContext = createContext<SeasonContextValue | null>(null);
const preferenceKey = '7even-season-theme';
const modePreferenceKey = '7even-color-mode';
const isSeason = (value: string | null): value is Season =>
  value === 'spring' || value === 'summer' || value === 'autumn' || value === 'winter';
const isModePreference = (value: string | null): value is AppearanceModePreference =>
  value === 'light' || value === 'dark' || value === 'system';
function readPreference(): SeasonPreference {
  try {
    const saved = window.localStorage.getItem(preferenceKey);
    return saved === 'auto' || isSeason(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}
function readModePreference(): AppearanceModePreference {
  try {
    const saved = window.localStorage.getItem(modePreferenceKey);
    return isModePreference(saved) ? saved : 'light';
  } catch {
    return 'light';
  }
}
function systemAppearanceMode(): AppearanceMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
  const [modePreference, setModePreference] = useState<AppearanceModePreference>(readModePreference);
  const [systemMode, setSystemMode] = useState<AppearanceMode>(() => systemAppearanceMode());
  const season = preference === 'auto' ? calendarSeason : preference;
  const mode = modePreference === 'system' ? systemMode : modePreference;

  useEffect(() => watchSeason(setCalendarSeason, browserClock), []);
  useEffect(() => {
    try {
      window.localStorage.setItem(preferenceKey, preference);
    } catch {
      // Theme selection still applies for this session when storage is unavailable.
    }
  }, [preference]);
  useEffect(() => {
    try {
      window.localStorage.setItem(modePreferenceKey, modePreference);
    } catch {
      // Appearance selection still applies for this session when storage is unavailable.
    }
  }, [modePreference]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemMode(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);
  useLayoutEffect(() => {
    document.documentElement.dataset.mode = mode;
    document.documentElement.style.colorScheme = mode;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = mode === 'dark' ? '#111A15' : '#fffdf8';
  }, [mode]);

  return (
    <SeasonContext value={{ season, preference, setPreference, mode, modePreference, setModePreference }}>
      {children}
    </SeasonContext>
  );
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
export function useAppearanceMode(): AppearanceMode {
  return useSeasonContext().mode;
}
export function useAppearanceModePreference(): AppearanceModePreference {
  return useSeasonContext().modePreference;
}
export function useSetAppearanceModePreference(): SeasonContextValue['setModePreference'] {
  return useSeasonContext().setModePreference;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_TIME_ZONE = 'Africa/Lagos';
export const MAX_SEASON_CHECK_MS = 60_000;

const calendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: SEASON_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});
function localParts(date: Date) {
  if (!Number.isFinite(date.getTime())) throw new RangeError('Choose a valid campaign date.');
  const parts = calendar.formatToParts(date);
  const number = (type: Intl.DateTimeFormatPartTypes) => {
    const value = Number(parts.find((part) => part.type === type)?.value);
    if (!Number.isFinite(value)) throw new RangeError('The campaign calendar is unavailable.');
    return value;
  };
  return {
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute'),
    second: number('second'),
  };
}
export function seasonAt(date: Date): Season {
  const { month } = localParts(date);
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}
function utcDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  // setUTCFullYear avoids Date.UTC's special treatment of years 0 through 99.
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}
/** First midnight of the next calendar campaign, interpreted in the launch market's zone. */
export function nextSeasonStart(date: Date): Date {
  const { year, month } = localParts(date);
  const nextMonth = [3, 6, 9, 12].find((candidate) => candidate > month);
  const guess = utcDate(nextMonth ? year : year + 1, nextMonth ?? 3, 1);
  const zoned = localParts(guess);
  // Derive the zone offset from Intl, rather than inheriting the visitor's or server's timezone.
  const offset =
    utcDate(zoned.year, zoned.month, zoned.day, zoned.hour, zoned.minute, zoned.second).getTime() -
    guess.getTime();
  return new Date(guess.getTime() - offset);
}
export interface SeasonClock {
  now(): Date;
  schedule(callback: () => void, delayMs: number): () => void;
  onResume(callback: () => void): () => void;
}
/** One bounded timer; resume handles throttled/suspended tabs and device clock corrections. */
export function watchSeason(onChange: (season: Season) => void, clock: SeasonClock): () => void {
  let active = true;
  let previous: Season | undefined;
  let cancelTimer = () => {};
  function refresh() {
    if (!active) return;
    cancelTimer();
    const now = clock.now();
    const season = seasonAt(now);
    if (season !== previous) {
      previous = season;
      onChange(season);
    }
    if (active)
      cancelTimer = clock.schedule(
        refresh,
        Math.max(1, Math.min(MAX_SEASON_CHECK_MS, nextSeasonStart(now).getTime() - now.getTime())),
      );
  }
  const unsubscribe = clock.onResume(refresh);
  try {
    refresh();
  } catch (error) {
    active = false;
    cancelTimer();
    unsubscribe();
    throw error;
  }
  return () => {
    if (!active) return;
    active = false;
    cancelTimer();
    unsubscribe();
  };
}

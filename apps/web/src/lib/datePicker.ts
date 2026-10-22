export type CalendarDate = { year: number; month: number; day: number };

export function parseCalendarDate(value: string): CalendarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function dateString(year: number, month: number, day: number): string {
  if (year < 1 || year > 9999) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function utcNoon(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

export function lagosToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((part) => parts.find(({ type }) => type === part)?.value)
    .join('-');
}

export function calendarMinimum(min: string | undefined, today = lagosToday()): string {
  return min && parseCalendarDate(min) && min > today ? min : today;
}

export function addCalendarDays(value: string, amount: number): string {
  if (!parseCalendarDate(value) || !Number.isInteger(amount)) return '';
  const date = utcNoon(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addCalendarMonths(value: string, amount: number): string {
  const date = parseCalendarDate(value);
  if (!date || !Number.isInteger(amount)) return '';
  const index = date.year * 12 + date.month - 1 + amount;
  const year = Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  return dateString(year, month, Math.min(date.day, daysInMonth(year, month)));
}

export function calendarWeeks(value: string): (string | null)[][] {
  const date = parseCalendarDate(value);
  if (!date) return [];
  const first = dateString(date.year, date.month, 1);
  const offset = utcNoon(first).getUTCDay();
  const length = daysInMonth(date.year, date.month);
  const cells = Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > length ? null : dateString(date.year, date.month, day);
  });
  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
}

export function calendarKeyDate(
  value: string,
  key: string,
  min: string,
  shift = false,
): string | null {
  if (!parseCalendarDate(value) || !parseCalendarDate(min)) return null;
  const weekday = utcNoon(value).getUTCDay();
  let next: string;
  switch (key) {
    case 'ArrowLeft':
      next = addCalendarDays(value, -1);
      break;
    case 'ArrowRight':
      next = addCalendarDays(value, 1);
      break;
    case 'ArrowUp':
      next = addCalendarDays(value, -7);
      break;
    case 'ArrowDown':
      next = addCalendarDays(value, 7);
      break;
    case 'Home':
      next = addCalendarDays(value, -weekday);
      break;
    case 'End':
      next = addCalendarDays(value, 6 - weekday);
      break;
    case 'PageUp':
      next = addCalendarMonths(value, shift ? -12 : -1);
      break;
    case 'PageDown':
      next = addCalendarMonths(value, shift ? 12 : 1);
      break;
    default:
      return null;
  }
  return next ? (next < min ? min : next) : value;
}

export function formatCalendarDate(value: string, weekday = false): string {
  if (!parseCalendarDate(value)) return '';
  return new Intl.DateTimeFormat('en-NG', {
    weekday: weekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcNoon(value));
}

export function stayDatesError(start: string, end: string): string | null {
  if (!start && !end) return null;
  if (!start || !end) return 'Choose both check-in and check-out dates.';
  if (end <= start) return 'Check-out must be at least one day after check-in.';
  return null;
}

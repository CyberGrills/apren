import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addCalendarDays,
  addCalendarMonths,
  calendarKeyDate,
  calendarMinimum,
  calendarWeeks,
  formatCalendarDate,
  lagosToday,
  parseCalendarDate,
  stayDatesError,
} from './datePicker.ts';

describe('calendar date values', () => {
  it('accepts real dates and Gregorian leap years without normalizing invalid input', () => {
    assert.deepEqual(parseCalendarDate('2028-02-29'), { year: 2028, month: 2, day: 29 });
    assert.ok(parseCalendarDate('2000-02-29'));
    for (const invalid of [
      '1900-02-29',
      '2026-02-29',
      '2026-04-31',
      '2026-13-01',
      '2026-00-01',
      '0000-01-01',
      '2026-1-01',
      '2026-01-00',
      '2026-01-01T00:00:00Z',
      '',
    ]) {
      assert.equal(parseCalendarDate(invalid), null, invalid);
    }
  });

  it('adds days across month, year and daylight-saving boundaries as calendar dates', () => {
    assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addCalendarDays('2028-03-01', -1), '2028-02-29');
    assert.equal(addCalendarDays('2026-03-08', 1), '2026-03-09');
    assert.equal(addCalendarDays('2026-11-01', 1), '2026-11-02');
    assert.equal(addCalendarDays('0001-01-01', -1), '');
    assert.equal(addCalendarDays('9999-12-31', 1), '');
    assert.equal(addCalendarDays('2026-02-30', 1), '');
  });

  it('keeps the nearest day when changing to a shorter month or year', () => {
    assert.equal(addCalendarMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addCalendarMonths('2028-01-31', 1), '2028-02-29');
    assert.equal(addCalendarMonths('2028-02-29', 12), '2029-02-28');
    assert.equal(addCalendarMonths('2026-01-31', -1), '2025-12-31');
    assert.equal(addCalendarMonths('9999-12-01', 1), '');
  });

  it('builds complete Sunday-first weeks without offering adjacent-month dates', () => {
    const weeks = calendarWeeks('2026-02-22');
    assert.equal(weeks.length, 4);
    assert.deepEqual(weeks[0], [
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
      '2026-02-06',
      '2026-02-07',
    ]);
    assert.equal(weeks.flat().filter(Boolean).length, 28);
    assert.equal(calendarWeeks('2026-08-01').length, 6);
    assert.deepEqual(calendarWeeks('invalid'), []);
  });

  it('uses Lagos midnight rather than the device timezone for the earliest available day', () => {
    assert.equal(lagosToday(new Date('2026-10-22T22:59:59Z')), '2026-10-22');
    assert.equal(lagosToday(new Date('2026-10-22T23:00:00Z')), '2026-10-23');
    assert.equal(calendarMinimum('2026-10-21', '2026-10-22'), '2026-10-22');
    assert.equal(calendarMinimum('2026-10-25', '2026-10-22'), '2026-10-25');
    assert.equal(calendarMinimum('invalid', '2026-10-22'), '2026-10-22');
    assert.match(formatCalendarDate('2026-10-22', true), /Thursday.*22 October 2026/);
  });
});

describe('calendar keyboard navigation', () => {
  const min = '2026-10-22';

  it('moves by days and weeks and stops at the earliest selectable date', () => {
    assert.equal(calendarKeyDate(min, 'ArrowLeft', min), min);
    assert.equal(calendarKeyDate(min, 'ArrowUp', min), min);
    assert.equal(calendarKeyDate(min, 'ArrowRight', min), '2026-10-23');
    assert.equal(calendarKeyDate(min, 'ArrowDown', min), '2026-10-29');
    assert.equal(calendarKeyDate(min, 'Home', min), min);
    assert.equal(calendarKeyDate(min, 'End', min), '2026-10-24');
    assert.equal(calendarKeyDate('2026-10-31', 'ArrowRight', min), '2026-11-01');
  });

  it('pages by month or year while preserving valid days and minimum bounds', () => {
    assert.equal(calendarKeyDate('2027-01-31', 'PageDown', min), '2027-02-28');
    assert.equal(calendarKeyDate('2028-02-29', 'PageDown', min, true), '2029-02-28');
    assert.equal(calendarKeyDate('2026-11-02', 'PageUp', min), min);
    assert.equal(calendarKeyDate('2027-01-01', 'PageUp', min, true), min);
    assert.equal(calendarKeyDate(min, 'Tab', min), null);
    assert.equal(calendarKeyDate('9999-12-31', 'ArrowRight', min), '9999-12-31');
  });
});

it('stay search allows discovery without dates and requires a complete ordered range', () => {
  assert.equal(stayDatesError('', ''), null);
  assert.equal(stayDatesError('2027-01-01', ''), 'Choose both check-in and check-out dates.');
  assert.equal(stayDatesError('', '2027-01-02'), 'Choose both check-in and check-out dates.');
  assert.match(stayDatesError('2027-01-02', '2027-01-02') ?? '', /at least one day/);
  assert.match(stayDatesError('2027-01-03', '2027-01-02') ?? '', /at least one day/);
  assert.equal(stayDatesError('2027-01-02', '2027-01-03'), null);
});

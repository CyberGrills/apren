import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextSeasonStart,
  seasonAt,
  watchSeason,
  type Season,
  type SeasonClock,
} from '../../apps/web/src/lib/season.ts';

const monthly: Season[] = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
];
for (const [index, season] of monthly.entries()) {
  test(`month ${index + 1} uses the ${season} campaign`, () => {
    assert.equal(seasonAt(new Date(Date.UTC(2026, index, 15))), season);
  });
}
for (const [date, before, after] of [
  ['2026-02-28T23:00:00Z', 'winter', 'spring'],
  ['2026-05-31T23:00:00Z', 'spring', 'summer'],
  ['2026-08-31T23:00:00Z', 'summer', 'autumn'],
  ['2026-11-30T23:00:00Z', 'autumn', 'winter'],
  ['2028-02-29T23:00:00Z', 'winter', 'spring'],
] as const) {
  test(`Lagos changes season exactly at ${date}`, () => {
    const boundary = Date.parse(date);
    assert.equal(seasonAt(new Date(boundary - 1)), before);
    assert.equal(seasonAt(new Date(boundary)), after);
    assert.equal(nextSeasonStart(new Date(boundary - 1)).getTime(), boundary);
    assert.ok(nextSeasonStart(new Date(boundary)).getTime() > boundary);
  });
}
test('New Year stays in winter and schedules March in the next calendar year', () => {
  assert.equal(seasonAt(new Date('2026-12-31T23:00:00Z')), 'winter');
  assert.equal(
    nextSeasonStart(new Date('2026-12-15T12:00:00Z')).toISOString(),
    '2027-02-28T23:00:00.000Z',
  );
});
test('explicit Lagos calendar ignores the host timezone', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['Pacific/Honolulu', 'Asia/Tokyo', 'UTC']) {
      process.env.TZ = zone;
      assert.equal(seasonAt(new Date('2026-08-31T23:00:00Z')), 'autumn');
      assert.equal(
        nextSeasonStart(new Date('2026-08-31T22:59:59Z')).toISOString(),
        '2026-08-31T23:00:00.000Z',
      );
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
test('an invalid calendar date cannot silently select a campaign', () => {
  assert.throws(() => seasonAt(new Date(Number.NaN)), RangeError);
  assert.throws(() => nextSeasonStart(new Date(Number.NaN)), RangeError);
});

class FakeClock implements SeasonClock {
  time: number;
  timers = new Map<number, { callback: () => void; delay: number }>();
  resumes = new Set<() => void>();
  private id = 0;
  constructor(date: string) {
    this.time = Date.parse(date);
  }
  now = () => new Date(this.time);
  schedule = (callback: () => void, delay: number) => {
    const id = ++this.id;
    this.timers.set(id, { callback, delay });
    return () => {
      this.timers.delete(id);
    };
  };
  onResume = (callback: () => void) => {
    this.resumes.add(callback);
    return () => {
      this.resumes.delete(callback);
    };
  };
  tick() {
    const next = this.timers.entries().next().value;
    assert.ok(next);
    this.time += next[1].delay;
    this.timers.delete(next[0]);
    next[1].callback();
  }
  resume(date?: string) {
    if (date) this.time = Date.parse(date);
    for (const callback of this.resumes) callback();
  }
}
test('an already open page changes at the season boundary without reloading', () => {
  const clock = new FakeClock('2026-11-30T22:59:59Z');
  const observed: Season[] = [];
  const stop = watchSeason((season) => observed.push(season), clock);
  assert.deepEqual(observed, ['autumn']);
  assert.equal([...clock.timers.values()][0]?.delay, 1000);
  clock.tick();
  assert.deepEqual(observed, ['autumn', 'winter']);
  assert.equal(clock.timers.size, 1);
  stop();
});
test('long seasons use one bounded timer and do not publish unchanged themes', () => {
  const clock = new FakeClock('2026-06-12T12:00:00Z');
  const observed: Season[] = [];
  const stop = watchSeason((season) => observed.push(season), clock);
  for (let index = 0; index < 5; index++) {
    assert.equal(clock.timers.size, 1);
    assert.ok([...clock.timers.values()].every((timer) => timer.delay > 0 && timer.delay <= 60000));
    clock.tick();
  }
  assert.deepEqual(observed, ['summer']);
  stop();
});
test('resume after sleep selects the current campaign rather than replaying skipped seasons', () => {
  const clock = new FakeClock('2026-02-15T10:00:00Z');
  const observed: Season[] = [];
  const stop = watchSeason((season) => observed.push(season), clock);
  clock.resume('2026-10-15T10:00:00Z');
  assert.deepEqual(observed, ['winter', 'autumn']);
  assert.equal(clock.timers.size, 1);
  stop();
});
test('clock correction backwards restores the matching season', () => {
  const clock = new FakeClock('2026-06-15T10:00:00Z');
  const observed: Season[] = [];
  const stop = watchSeason((season) => observed.push(season), clock);
  clock.resume('2026-02-15T10:00:00Z');
  assert.deepEqual(observed, ['summer', 'winter']);
  stop();
});
test('cleanup removes the timer and resume listener and tolerates a late callback', () => {
  const clock = new FakeClock('2026-08-31T22:59:59Z');
  const observed: Season[] = [];
  const stop = watchSeason((season) => observed.push(season), clock);
  const late = [...clock.timers.values()][0]?.callback;
  stop();
  stop();
  assert.equal(clock.timers.size, 0);
  assert.equal(clock.resumes.size, 0);
  clock.resume('2026-09-01T10:00:00Z');
  late?.();
  assert.deepEqual(observed, ['summer']);
});
test('a StrictMode-style teardown and remount leaves one active watcher', () => {
  const clock = new FakeClock('2026-02-28T22:59:59Z');
  const first = watchSeason(() => {}, clock);
  first();
  const observed: Season[] = [];
  const stop = watchSeason((season) => observed.push(season), clock);
  assert.equal(clock.timers.size, 1);
  assert.equal(clock.resumes.size, 1);
  clock.tick();
  assert.deepEqual(observed, ['winter', 'spring']);
  stop();
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { optimizeHotelBookings } from '../src/hotelBooking.ts';
import type { HotelBookingCandidate } from '../src/hotelBooking.ts';

const asOf = '2026-10-19T12:00:00.000Z';
const candidate = (
  id: string,
  priceMinor: string,
  city = 'Lagos',
  remaining = 4,
  amenities: string[] = ['Wi-Fi', 'Pool'],
): HotelBookingCandidate => ({
  id,
  title: `Hotel ${id}`,
  city,
  priceMinor,
  amenities,
  windows: [
    { id: `${id}-20`, serviceDate: '2026-10-20', startAt: '2026-10-20T13:00:00.000Z', endAt: '2026-10-21T10:00:00.000Z', capacity: 8, remaining, },
    { id: `${id}-21`, serviceDate: '2026-10-21', startAt: '2026-10-21T13:00:00.000Z', endAt: '2026-10-22T10:00:00.000Z', capacity: 8, remaining, },
  ],
});

describe('7even real-time hotel booking optimizer', () => {
  it('ranks all date-available hotels and explains the live availability used', () => {
    const result = optimizeHotelBookings([
      candidate('expensive', '2500000', 'Lagos', 4),
      candidate('budget', '1000000', 'Lagos', 4),
      candidate('more-rooms', '1500000', 'Lagos', 8),
    ], {
      checkInDate: '2026-10-20',
      checkOutDate: '2026-10-22',
      rooms: 2,
      city: 'Lagos',
      amenities: ['wi-fi'],
      asOf,
    });

    assert.equal(result.length, 3);
    assert.equal(result[0]?.id, 'budget');
    assert.equal(result[0]?.nights, 2);
    assert.equal(result[0]?.roomsRequested, 2);
    assert.equal(result[0]?.roomsAvailable, 4);
    assert.equal(result[0]?.estimatedBaseTotalMinor, '4000000');
    assert.equal(result[0]?.policyVersion, '7even-hotel-ranking-v1');
    assert.equal(result[0]?.checkedAt, new Date(asOf).toISOString());
    assert.ok(result[0]?.reasons.some((reason) => /live inventory/i.test(reason)));
    assert.ok(result[0]?.matchScore >= 0 && result[0]?.matchScore <= 100);
  });

  it('excludes hotels without inventory for every requested night', () => {
    const missingSecondNight = candidate('gap', '700000', 'Lagos', 5);
    missingSecondNight.windows = missingSecondNight.windows.slice(0, 1);
    const shortCapacity = candidate('short', '500000', 'Lagos', 1);
    const expired = candidate('expired', '400000', 'Lagos', 5);
    expired.windows = expired.windows.map((window) => ({ ...window, endAt: '2026-10-18T10:00:00.000Z' }));

    const result = optimizeHotelBookings([missingSecondNight, shortCapacity, expired], {
      checkInDate: '2026-10-20',
      checkOutDate: '2026-10-22',
      rooms: 2,
      asOf,
    });
    assert.deepEqual(result, []);
  });

  it('selects each hotel’s next available night when dates are omitted', () => {
    const hotel = candidate('next', '200000', 'Uyo', 3);
    hotel.windows = [
      { id: 'past', serviceDate: '2026-10-18', startAt: '2026-10-18T13:00:00.000Z', endAt: '2026-10-19T10:00:00.000Z', capacity: 5, remaining: 5 },
      { id: 'next', serviceDate: '2026-10-20', startAt: '2026-10-20T13:00:00.000Z', endAt: '2026-10-21T10:00:00.000Z', capacity: 5, remaining: 3 },
    ];
    const result = optimizeHotelBookings([hotel], { asOf });
    assert.equal(result[0]?.checkInDate, '2026-10-20');
    assert.equal(result[0]?.checkOutDate, '2026-10-21');
    assert.equal(result[0]?.nights, 1);
  });

  it('respects an exact base-subtotal budget and requested amenities', () => {
    const result = optimizeHotelBookings([
      candidate('in-budget', '100000', 'Lagos', 5, ['Wi-Fi']),
      candidate('over-budget', '300000', 'Lagos', 5, ['Wi-Fi', 'Pool']),
    ], {
      checkInDate: '2026-10-20',
      checkOutDate: '2026-10-21',
      maxBaseTotalMinor: '100000',
      amenities: ['Wi-Fi', 'Pool'],
      asOf,
    });
    assert.deepEqual(result.map((hotel) => hotel.id), ['in-budget']);
    assert.ok(result[0]?.reasons.some((reason) => /0 of 2 requested amenities/i.test(reason)));
  });

  it('rejects invalid room counts, past dates, invalid ranges, and budgets', () => {
    const hotels = [candidate('hotel', '100000')];
    assert.throws(() => optimizeHotelBookings(hotels, { rooms: 0, asOf }));
    assert.throws(() => optimizeHotelBookings(hotels, { checkInDate: '2026-10-18', asOf }));
    assert.throws(() => optimizeHotelBookings(hotels, { checkOutDate: '2026-10-21', asOf }));
    assert.throws(() => optimizeHotelBookings(hotels, { checkInDate: '2026-10-20', checkOutDate: '2026-10-20', asOf }));
    assert.throws(() => optimizeHotelBookings(hotels, { maxBaseTotalMinor: '12.5', asOf }));
  });

  it('does not return a hotel when duplicated windows make date capacity ambiguous', () => {
    const hotel = candidate('duplicate', '100000');
    hotel.windows = [...hotel.windows, { ...hotel.windows[0]!, id: 'duplicate-night' }];
    assert.deepEqual(optimizeHotelBookings([hotel], {
      checkInDate: '2026-10-20',
      checkOutDate: '2026-10-21',
      asOf,
    }), []);
  });
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parsePositiveId,
  parseDate,
  validText,
  validCurrency,
  calculateReservationPrice,
  matchesReservationRequest
} = require("../src/reservationRules");

test("positive IDs reject zero, negatives, unsafe integers and malformed values", () => {
  assert.equal(parsePositiveId("12"), 12);
  assert.equal(parsePositiveId("0"), null);
  assert.equal(parsePositiveId("-1"), null);
  assert.equal(parsePositiveId("1x"), null);
  assert.equal(parsePositiveId("9007199254740992"), null);
});

test("date parsing rejects invalid values", () => {
  assert.ok(parseDate("2026-11-01T12:00:00Z") instanceof Date);
  assert.equal(parseDate("not-a-date"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
});

test("reservation intervals must end after they start", () => {
  const start = parseDate("2026-11-01T12:00:00Z");
  const later = parseDate("2026-11-01T13:00:00Z");
  const earlier = parseDate("2026-11-01T11:00:00Z");
  assert.ok(later > start);
  assert.ok(!(earlier > start));
});

test("text and currency validators reject invalid input", () => {
  assert.equal(validText("  Booking  ", 20), true);
  assert.equal(validText("   ", 20), false);
  assert.equal(validText("longer than limit", 4), false);
  assert.equal(validCurrency("NGN"), true);
  assert.equal(validCurrency("ngn"), false);
  assert.equal(validCurrency("US"), false);
});

test("reservation totals multiply nightly rates by the number of nights", () => {
  assert.equal(calculateReservationPrice(2500000, "per_night", "2026-11-20T11:00:00Z", "2026-11-23T11:00:00Z", 2), 7500000);
});

test("per-person and per-booking rates use the correct unit", () => {
  assert.equal(calculateReservationPrice(500000, "per_person", "2026-11-20T11:00:00Z", "2026-11-23T11:00:00Z", 3), 1500000);
  assert.equal(calculateReservationPrice(500000, "per_booking", "2026-11-20T11:00:00Z", "2026-11-23T11:00:00Z", 3), 500000);
  assert.equal(calculateReservationPrice(Number.MAX_SAFE_INTEGER, "per_night", "2026-11-20T11:00:00Z", "2026-11-23T11:00:00Z", 1), null);
});

test("same idempotency key replay matches the original request", () => {
  const reservation = {
    property_id: "7",
    resource_id: "12",
    starts_at: new Date("2026-11-01T12:00:00.000Z"),
    ends_at: new Date("2026-11-01T13:00:00.000Z"),
    guest_count: 2,
    guest_note: "quiet room"
  };
  const request = {
    propertyId: 7,
    resourceId: 12,
    startsAt: new Date("2026-11-01T12:00:00Z"),
    endsAt: new Date("2026-11-01T13:00:00Z"),
    guestCount: 2,
    guestNote: " quiet room "
  };
  assert.equal(matchesReservationRequest(reservation, request), true);
});

test("same idempotency key cannot silently replay a different reservation", () => {
  const reservation = {
    property_id: "7",
    resource_id: "12",
    starts_at: new Date("2026-11-01T12:00:00.000Z"),
    ends_at: new Date("2026-11-01T13:00:00.000Z"),
    guest_count: 2,
    guest_note: "quiet room"
  };
  const base = {
    propertyId: 7,
    resourceId: 12,
    startsAt: new Date("2026-11-01T12:00:00Z"),
    endsAt: new Date("2026-11-01T13:00:00Z"),
    guestCount: 2,
    guestNote: "quiet room"
  };
  for (const changed of [
    { ...base, propertyId: 8 },
    { ...base, resourceId: 13 },
    { ...base, startsAt: new Date("2026-11-01T12:30:00Z") },
    { ...base, endsAt: new Date("2026-11-01T14:00:00Z") },
    { ...base, guestCount: 3 },
    { ...base, guestNote: "different request" }
  ]) {
    assert.equal(matchesReservationRequest(reservation, changed), false);
  }
});

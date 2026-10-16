function parsePositiveId(value) {
  if (!/^[1-9]\d*$/.test(String(value || ""))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds);
}

function validText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 &&
    value.trim().length <= maxLength;
}

function validCurrency(value) {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function calculateReservationPrice(priceMinor, pricingUnit, startsAt, endsAt, guestCount) {
  const rate = Number(priceMinor);
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isSafeInteger(rate) || rate < 0 || !Number.isFinite(start) ||
      !Number.isFinite(end) || end <= start || !Number.isSafeInteger(guestCount) || guestCount < 1) {
    return null;
  }
  let multiplier = 1;
  if (pricingUnit === "per_night") multiplier = Math.max(1, Math.ceil((end - start) / 86400000));
  else if (pricingUnit === "per_person") multiplier = guestCount;
  else if (pricingUnit !== "per_booking") return null;
  const total = rate * multiplier;
  return Number.isSafeInteger(total) ? total : null;
}

function matchesReservationRequest(reservation, request) {
  const sameInstant = (left, right) => {
    const leftTime = new Date(left).getTime();
    const rightTime = new Date(right).getTime();
    return Number.isFinite(leftTime) && Number.isFinite(rightTime) &&
      leftTime === rightTime;
  };

  return String(reservation.property_id) === String(request.propertyId) &&
    String(reservation.resource_id) === String(request.resourceId) &&
    sameInstant(reservation.starts_at, request.startsAt) &&
    sameInstant(reservation.ends_at, request.endsAt) &&
    Number(reservation.guest_count) === request.guestCount &&
    String(reservation.guest_note || "").trim() === String(request.guestNote || "").trim();
}

module.exports = {
  parsePositiveId,
  parseDate,
  validText,
  validCurrency,
  calculateReservationPrice,
  matchesReservationRequest
};

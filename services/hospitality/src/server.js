const express = require("express");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const pool = require("../../shared/db");
const { parsePositiveId, parseDate, validText, validCurrency, calculateReservationPrice, matchesReservationRequest } = require("./reservationRules");

const app = express();
const PORT = Number(process.env.HOSPITALITY_PORT || 4007);
const JWT_SECRET = process.env.APREN_JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("APREN_JWT_SECRET is required for hospitality authentication");
}

app.disable("x-powered-by");
app.use(express.json({
  limit: "1mb",
  verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); }
}));

async function paystackRequest(path, options = {}) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw httpError(503, "Paystack is not configured. Set PAYSTACK_SECRET_KEY before enabling online payments.");
  const response = await fetch("https://api.paystack.co" + path, {
    ...options,
    headers: {
      authorization: "Bearer " + secret,
      "content-type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== true) {
    const error = httpError(502, data.message || "Paystack request failed");
    error.paystackResponse = data;
    throw error;
  }
  return data.data;
}

function paystackReference() {
  return "seven-" + Date.now() + "-" + crypto.randomBytes(10).toString("hex");
}

function safeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string" ||
      !/^[a-f0-9]{128}$/i.test(left) || !/^[a-f0-9]{128}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

async function markPaystackPayment(reference, transaction) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT pay.*, reservation.status AS reservation_status FROM hospitality_payments pay JOIN hospitality_reservations reservation ON reservation.id = pay.reservation_id WHERE pay.provider = 'paystack' AND pay.provider_reference = $1 FOR UPDATE OF pay",
      [reference]
    );
    const payment = found.rows[0];
    if (!payment) { await client.query("ROLLBACK"); return { ignored: true }; }
    if (String(transaction.reference) !== String(payment.provider_reference) ||
        Number(transaction.amount) !== Number(payment.amount_minor) ||
        String(transaction.currency).toUpperCase() !== String(payment.currency).trim().toUpperCase()) {
      throw httpError(409, "Paystack transaction reference, amount or currency did not match the stored payment");
    }
    if (payment.status === "refunded" || payment.refund_status === "processed") {
      await client.query("COMMIT");
      return { verified: true, status: "refunded", refunded: true };
    }
    if (transaction.status !== "success") {
      if (payment.status === "pending") {
        await client.query("UPDATE hospitality_payments SET status = 'failed', provider_response = $2::jsonb, updated_at = NOW() WHERE id = $1",
          [payment.id, JSON.stringify({ status: transaction.status, gateway_response: transaction.gateway_response || null })]);
        await client.query("UPDATE hospitality_reservations SET payment_status = 'failed', updated_at = NOW() WHERE id = $1 AND payment_status <> 'paid'", [payment.reservation_id]);
      }
      await client.query("COMMIT");
      return { verified: false, status: transaction.status };
    }
    if (payment.status !== "succeeded") {
      await client.query(
        "UPDATE hospitality_payments SET status = 'succeeded', provider_response = $2::jsonb, updated_at = NOW() WHERE id = $1",
        [payment.id, JSON.stringify({ status: transaction.status, paid_at: transaction.paid_at || null, channel: transaction.channel || null })]
      );
      await client.query(
        "UPDATE hospitality_reservations SET payment_status = 'paid', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW() WHERE id = $1",
        [payment.reservation_id]
      );
      await client.query(
        "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,NULL,'payment_received',$2,$2,$3::jsonb)",
        [payment.reservation_id, payment.reservation_status, JSON.stringify({ provider: "paystack", reference })]
      );
    }
    await client.query("COMMIT");
    return { verified: true, status: "success" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseCoordinate(value, min, max) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : NaN;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function drivingRoute(originLat, originLng, propertyLat, propertyLng) {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration" },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
          destination: { location: { latLng: { latitude: propertyLat, longitude: propertyLng } } },
          travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", computeAlternativeRoutes: false, units: "METRIC"
        }),
        signal: AbortSignal.timeout(4500)
      });
      if (response.ok) {
        const data = await response.json();
        const route = data.routes && data.routes[0];
        const seconds = route && Number.parseFloat(String(route.duration || "").replace(/s$/, ""));
        if (route && Number.isFinite(route.distanceMeters) && Number.isFinite(seconds)) {
          return { driveDistanceKm: Number((route.distanceMeters / 1000).toFixed(1)), driveMinutes: Math.max(1, Math.ceil(seconds / 60)), routingProvider: "google_maps" };
        }
      }
    } catch {
      // Use the configured OSRM fallback when Google Routes is unavailable.
    }
  }
  const base = process.env.OSRM_BASE_URL;
  if (!base) return null;
  try {
    const url = base.replace(/\/+$/, "") + "/route/v1/driving/" +
      [originLng, originLat].join(",") + ";" + [propertyLng, propertyLat].join(",") +
      "?overview=false&alternatives=false&steps=false";
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) return null;
    const data = await response.json();
    const route = data.routes && data.routes[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null;
    return { driveDistanceKm: Number((route.distance / 1000).toFixed(1)), driveMinutes: Math.max(1, Math.ceil(route.duration / 60)), routingProvider: "osrm" };
  } catch {
    return null;
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function authenticate(req, res, next) {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const token = authorization.slice(7).trim();
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: "apren-identity",
      audience: "apren-api"
    });

    const userId = parsePositiveId(payload.sub);
    if (!userId || !payload.jti) {
      return res.status(401).json({ error: "Invalid access token" });
    }

    // Enforce session revocation even if the service is called outside the gateway.
    const session = await pool.query(
      `SELECT id
       FROM user_sessions
       WHERE token_jti = $1
         AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [payload.jti, userId]
    );

    if (!session.rowCount) {
      return res.status(401).json({ error: "Session expired or revoked" });
    }

    req.user = {
      id: userId,
      role: payload.role,
      email: payload.email
    };
    return next();
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired access token" });
    }
    console.error("Hospitality session validation failed:", error.message);
    return res.status(503).json({ error: "Authentication service unavailable" });
  }
}

async function requirePropertyRole(propertyId, userId, allowedRoles) {
  const result = await pool.query(
    `SELECT role
     FROM hospitality_property_memberships
     WHERE property_id = $1 AND user_id = $2`,
    [propertyId, userId]
  );
  const role = result.rows[0]?.role;
  if (!role || !allowedRoles.includes(role)) {
    throw httpError(403, "You do not have permission to manage this property");
  }
  return role;
}

app.get("/health", asyncRoute(async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ service: "7even-hospitality", status: "ok" });
}));

app.get("/hospitality/discover", asyncRoute(async (req, res) => {
  const city = typeof req.query.city === "string" && req.query.city.trim()
    ? req.query.city.trim().slice(0, 80) : "Uyo";
  const origin = typeof req.query.origin === "string" ? req.query.origin.trim().slice(0, 180) : "";
  const originType = ["airport", "bus_terminal", "in_uyo", "other"].includes(req.query.originType) ? req.query.originType : "other";
  const checkIn = req.query.checkIn ? parseDate(req.query.checkIn) : null;
  const checkOut = req.query.checkOut ? parseDate(req.query.checkOut) : null;
  const guests = req.query.guests === undefined ? 1 : Number(req.query.guests);
  const budgetNaira = req.query.budgetNaira === undefined || req.query.budgetNaira === ""
    ? null : Number(req.query.budgetNaira);
  const originLat = parseCoordinate(req.query.originLat, -90, 90);
  const originLng = parseCoordinate(req.query.originLng, -180, 180);
  if (Number.isNaN(originLat) || Number.isNaN(originLng) || ((originLat === null) !== (originLng === null))) {
    throw httpError(400, "originLat and originLng must be supplied together as valid coordinates");
  }
  if ((req.query.checkIn && !checkIn) || (req.query.checkOut && !checkOut) ||
      (checkIn && checkOut && checkOut <= checkIn)) {
    throw httpError(400, "Provide valid check-in and check-out dates; check-out must be later");
  }
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 20) {
    throw httpError(400, "guests must be an integer between 1 and 20");
  }
  if (budgetNaira !== null && (!Number.isFinite(budgetNaira) || budgetNaira < 0 || budgetNaira > 100000000)) {
    throw httpError(400, "budgetNaira must be a valid non-negative amount");
  }
  const sql = "SELECT p.id AS property_id, p.name AS property_name, p.property_type, " +
    "p.description AS property_description, p.address, p.city, p.country_code, p.timezone, " +
    "p.currency AS property_currency, p.latitude, p.longitude, p.coordinates_verified, " +
    "p.verification_status, p.contact_name, p.contact_phone, p.contact_email, p.website_url, " +
    "r.id AS resource_id, r.name AS resource_name, " +
    "r.resource_type, r.description AS resource_description, r.capacity, r.inventory_count, " +
    "r.price_minor::text AS price_minor, r.currency, COALESCE(r.pricing_unit, 'per_night') AS pricing_unit, " +
    "GREATEST(r.inventory_count - COALESCE(bookings.booked_count, 0), 0)::int AS available_units " +
    "FROM hospitality_properties p JOIN hospitality_resources r ON r.property_id = p.id " +
    "LEFT JOIN LATERAL (SELECT COUNT(*)::int AS booked_count FROM hospitality_reservations b " +
    "WHERE b.resource_id = r.id AND b.status IN ('pending', 'confirmed') " +
    "AND (b.status <> 'pending' OR b.hold_expires_at > NOW()) " +
    "AND $1::timestamptz IS NOT NULL AND $2::timestamptz IS NOT NULL " +
    "AND b.starts_at < $2::timestamptz AND b.ends_at > $1::timestamptz) bookings ON TRUE " +
    "WHERE p.status = 'active' AND r.status = 'active' AND p.city ILIKE $3 " +
    "AND r.resource_type = 'room' AND r.capacity >= $4 " +
    "AND ($5::bigint IS NULL OR r.price_minor <= $5::bigint) " +
    "AND ($1::timestamptz IS NULL OR $2::timestamptz IS NULL OR " +
    "GREATEST(r.inventory_count - COALESCE(bookings.booked_count, 0), 0) > 0) " +
    "ORDER BY CASE " +
    "WHEN $6 = 'airport' AND (p.address ILIKE '%airport%' OR p.name ILIKE '%airport%') THEN 0 " +
    "WHEN $6 = 'bus_terminal' AND (p.address ILIKE '%itam%' OR p.address ILIKE '%park road%' OR p.address ILIKE '%motor park%' OR p.address ILIKE '%bus terminal%' OR p.name ILIKE '%terminal%') THEN 0 " +
    "WHEN $7 <> '' AND (p.address ILIKE '%' || $7 || '%' OR p.name ILIKE '%' || $7 || '%') THEN 0 " +
    "ELSE 1 END, r.price_minor ASC, p.name ASC LIMIT 100";
  const result = await pool.query(sql, [
    checkIn, checkOut, "%" + city + "%", guests,
    budgetNaira === null ? null : Math.round(budgetNaira * 100), originType, origin
  ]);
  const properties = new Map();
  for (const row of result.rows) {
    const key = String(row.property_id);
    if (!properties.has(key)) {
      properties.set(key, {
        id: row.property_id, name: row.property_name, propertyType: row.property_type,
        description: row.property_description, address: row.address, city: row.city,
        countryCode: row.country_code, timezone: row.timezone, currency: row.property_currency,
        latitude: row.latitude, longitude: row.longitude,
        coordinatesVerified: row.coordinates_verified,
        verificationStatus: row.verification_status,
        contactName: row.contact_name, contactPhone: row.contact_phone,
        contactEmail: row.contact_email, websiteUrl: row.website_url,
        distanceKm: originLat !== null && row.coordinates_verified && row.latitude !== null && row.longitude !== null
          ? Number(distanceKm(originLat, originLng, Number(row.latitude), Number(row.longitude)).toFixed(1)) : null,
        resources: []
      });
    }
    properties.get(key).resources.push({
      id: row.resource_id, name: row.resource_name, type: row.resource_type,
      description: row.resource_description, capacity: row.capacity,
      inventoryCount: row.inventory_count,
      availableUnits: checkIn && checkOut ? row.available_units : null,
      priceMinor: row.price_minor, currency: row.currency, pricingUnit: row.pricing_unit
    });
  }
  const propertyList = Array.from(properties.values());
  if (originLat !== null) {
    propertyList.sort((a, b) => {
      const aDistance = a.distanceKm === null ? Number.POSITIVE_INFINITY : a.distanceKm;
      const bDistance = b.distanceKm === null ? Number.POSITIVE_INFINITY : b.distanceKm;
      return aDistance - bDistance || Number(a.resources[0]?.priceMinor || 0) - Number(b.resources[0]?.priceMinor || 0);
    });
    if (process.env.GOOGLE_MAPS_API_KEY || process.env.OSRM_BASE_URL) {
      const routeCandidates = propertyList.filter(property =>
        property.coordinatesVerified && property.latitude !== null && property.longitude !== null
      ).slice(0, 20);
      await Promise.all(routeCandidates.map(async property => {
        const route = await drivingRoute(originLat, originLng, Number(property.latitude), Number(property.longitude));
        if (route) Object.assign(property, route);
      }));
      propertyList.sort((a, b) => {
        const aMinutes = a.driveMinutes === undefined ? Number.POSITIVE_INFINITY : a.driveMinutes;
        const bMinutes = b.driveMinutes === undefined ? Number.POSITIVE_INFINITY : b.driveMinutes;
        return aMinutes - bMinutes ||
          (a.distanceKm === null ? Number.POSITIVE_INFINITY : a.distanceKm) -
          (b.distanceKm === null ? Number.POSITIVE_INFINITY : b.distanceKm) ||
          Number(a.resources[0]?.priceMinor || 0) - Number(b.resources[0]?.priceMinor || 0);
      });
    }
  }
  res.json({
    city, origin: origin || null, originCoordinatesProvided: originLat !== null,
    routingProviderConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.OSRM_BASE_URL),
    checkedAvailability: Boolean(checkIn && checkOut),
    count: properties.size, properties: propertyList,
    notice: properties.size
      ? "Results use active properties in the hospitality database. Confirm the booking with the property before travelling."
      : "No matching live property listings are currently available in the database. No invented hotels or availability have been substituted."
  });
}));

app.post("/hospitality/arrival-intents", asyncRoute(async (req, res) => {
  const {
    originType, originLabel, city = "Uyo", need = "hotel_now",
    budgetNaira, guestCount = 1, checkIn, checkOut
  } = req.body || {};
  const origins = ["airport", "bus_terminal", "in_uyo", "other"];
  const needs = ["hotel_now", "hotel_later", "transport", "food", "full_arrival"];
  const parsedIn = checkIn ? parseDate(checkIn) : null;
  const parsedOut = checkOut ? parseDate(checkOut) : null;
  if (!origins.includes(originType) || !validText(originLabel, 180)) {
    throw httpError(400, "Choose an arrival point type and provide its name");
  }
  if (!validText(city, 80) || !needs.includes(need)) throw httpError(400, "A valid city and arrival need are required");
  if (!Number.isSafeInteger(guestCount) || guestCount < 1 || guestCount > 20) {
    throw httpError(400, "guestCount must be an integer between 1 and 20");
  }
  if (budgetNaira !== undefined && budgetNaira !== null &&
      (!Number.isFinite(budgetNaira) || budgetNaira < 0 || budgetNaira > 100000000)) {
    throw httpError(400, "budgetNaira must be a valid non-negative amount");
  }
  if ((checkIn && !parsedIn) || (checkOut && !parsedOut) ||
      (parsedIn && parsedOut && parsedOut <= parsedIn)) {
    throw httpError(400, "Check-out must be later than check-in");
  }
  const saved = await pool.query(
    "INSERT INTO hospitality_arrival_intents (origin_type, origin_label, city, need, budget_minor, guest_count, check_in, check_out) " +
    "VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, origin_type, origin_label, city, need, guest_count, created_at",
    [originType, originLabel.trim(), city.trim(), need,
      budgetNaira === undefined || budgetNaira === null ? null : Math.round(budgetNaira * 100),
      guestCount, parsedIn, parsedOut]
  );
  res.status(201).json({
    intent: saved.rows[0],
    message: "Arrival needs saved. Recommendations only use real listings currently in the database."
  });
}));

app.get("/hospitality/admin/properties", authenticate, asyncRoute(async (req, res) => {
  if (req.user.role !== "admin") throw httpError(403, "Administrator access required");
  const status = ["unverified", "pending", "verified", "rejected"].includes(req.query.status)
    ? req.query.status : null;
  const result = await pool.query(
    `SELECT id, owner_user_id, name, property_type, description, address, city,
            latitude, longitude, coordinates_verified, verification_status,
            contact_name, contact_phone, contact_email, website_url, created_at
     FROM hospitality_properties
     WHERE ($1::text IS NULL OR verification_status = $1)
     ORDER BY created_at DESC
     LIMIT 500`,
    [status]
  );
  res.json({ properties: result.rows });
}));

app.get("/hospitality/properties", authenticate, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT id, owner_user_id, name, property_type, description, address, city,
            country_code, timezone, currency, status, latitude, longitude,
            coordinates_verified, verification_status, contact_name, contact_phone,
            contact_email, website_url
     FROM hospitality_properties
     WHERE status = 'active' AND owner_user_id = $1
     ORDER BY name, id
     LIMIT 200`,
    [req.user.id]
  );
  res.json({ properties: result.rows });
}));

app.post("/hospitality/properties", authenticate, asyncRoute(async (req, res) => {
  const {
    name, propertyType, description = "", address = "", city = "",
    countryCode = "NG", timezone = "Africa/Lagos", currency = "NGN",
    latitude, longitude, contactName = "", contactPhone = "", contactEmail = "", websiteUrl = ""
  } = req.body || {};

  const validTypes = ["hotel", "guesthouse", "restaurant", "venue", "short_stay", "other"];

  if (!validText(name, 160) || !validTypes.includes(propertyType)) {
    throw httpError(400, "A valid property name and propertyType are required");
  }
  if (![description, address, city, timezone].every(value =>
    typeof value === "string" && value.length <= 2000
  )) {
    throw httpError(400, "One or more text fields are invalid");
  }
  if (typeof countryCode !== "string" || !/^[A-Z]{2}$/.test(countryCode)) {
    throw httpError(400, "countryCode must be a two-letter uppercase code");
  }
  if (!validCurrency(currency)) {
    throw httpError(400, "currency must be a three-letter uppercase code");
  }
  const parsedLatitude = latitude === undefined || latitude === null || latitude === "" ? null : parseCoordinate(latitude, -90, 90);
  const parsedLongitude = longitude === undefined || longitude === null || longitude === "" ? null : parseCoordinate(longitude, -180, 180);
  if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude) || ((parsedLatitude === null) !== (parsedLongitude === null))) {
    throw httpError(400, "Provide both valid latitude and longitude, or leave both empty");
  }
  if (![contactName, contactPhone, contactEmail, websiteUrl].every(value => typeof value === "string" && value.length <= 240) ||
      (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) ||
      (websiteUrl && !/^https?:\/\//i.test(websiteUrl))) {
    throw httpError(400, "Contact fields must be valid and websiteUrl must use http or https");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const property = await client.query(
      `INSERT INTO hospitality_properties
         (owner_user_id, name, property_type, description, address, city,
          country_code, timezone, currency, latitude, longitude, contact_name,
          contact_phone, contact_email, website_url, verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending')
       RETURNING *`,
      [
        req.user.id, name.trim(), propertyType, description.trim(),
        address.trim(), city.trim(), countryCode, timezone.trim(), currency,
        parsedLatitude, parsedLongitude, contactName.trim(), contactPhone.trim(),
        contactEmail.trim().toLowerCase(), websiteUrl.trim()
      ]
    );

    await client.query(
      `INSERT INTO hospitality_property_memberships(property_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [property.rows[0].id, req.user.id]
    );

    await client.query("COMMIT");
    res.status(201).json({ property: property.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.post("/hospitality/properties/:propertyId/location-verification", authenticate,
  asyncRoute(async (req, res) => {
    if (req.user.role !== "admin") throw httpError(403, "Administrator access required");
    const propertyId = parsePositiveId(req.params.propertyId);
    const status = req.body?.status;
    if (!propertyId || !["verified", "rejected", "pending", "unverified"].includes(status)) {
      throw httpError(400, "Provide a valid property ID and verification status");
    }
    const result = await pool.query(
      `UPDATE hospitality_properties
       SET verification_status = $2,
           coordinates_verified = ($2 = 'verified' AND latitude IS NOT NULL AND longitude IS NOT NULL),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, verification_status, coordinates_verified`,
      [propertyId, status]
    );
    if (!result.rowCount) throw httpError(404, "Property not found");
    res.json({ property: result.rows[0] });
  })
);

app.get("/hospitality/properties/:propertyId/resources", authenticate,
  asyncRoute(async (req, res) => {
    const propertyId = parsePositiveId(req.params.propertyId);
    if (!propertyId) throw httpError(400, "Invalid property ID");

    const property = await pool.query(
      "SELECT id FROM hospitality_properties WHERE id = $1 AND status = 'active'",
      [propertyId]
    );
    if (!property.rowCount) throw httpError(404, "Property not found");

    const result = await pool.query(
      `SELECT id, property_id, name, resource_type, description, capacity,
              inventory_count, price_minor, currency, pricing_unit, status
       FROM hospitality_resources
       WHERE property_id = $1 AND status = 'active'
       ORDER BY name, id`,
      [propertyId]
    );
    res.json({ resources: result.rows });
  })
);

app.post("/hospitality/properties/:propertyId/resources", authenticate,
  asyncRoute(async (req, res) => {
    const propertyId = parsePositiveId(req.params.propertyId);
    if (!propertyId) throw httpError(400, "Invalid property ID");

    await requirePropertyRole(propertyId, req.user.id, ["owner", "manager", "staff"]);

    const {
      name, resourceType, description = "", capacity = 1,
      inventoryCount = 1, priceMinor = 0, currency = "NGN", pricingUnit = "per_night"
    } = req.body || {};

    const resourceTypes = ["room", "table", "venue", "service", "unit"];
    const pricingUnits = ["per_night", "per_booking", "per_person"];
    if (!validText(name, 160) || !resourceTypes.includes(resourceType) || !pricingUnits.includes(pricingUnit)) {
      throw httpError(400, "A valid resource name and resourceType are required");
    }
    if (!Number.isSafeInteger(capacity) || capacity < 1 ||
        !Number.isSafeInteger(inventoryCount) || inventoryCount < 1 ||
        !Number.isSafeInteger(priceMinor) || priceMinor < 0) {
      throw httpError(400, "capacity, inventoryCount and priceMinor must be valid non-negative integers; capacity and inventoryCount must be positive");
    }
    if (typeof description !== "string" || description.length > 2000 ||
        !validCurrency(currency)) {
      throw httpError(400, "Invalid description or currency");
    }

    const result = await pool.query(
      `INSERT INTO hospitality_resources
         (property_id, name, resource_type, description, capacity,
          inventory_count, price_minor, currency, pricing_unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        propertyId, name.trim(), resourceType, description.trim(),
        capacity, inventoryCount, priceMinor, currency, pricingUnit
      ]
    );

    res.status(201).json({ resource: result.rows[0] });
  })
);

app.post("/hospitality/properties/:propertyId/reservations", authenticate,
  asyncRoute(async (req, res) => {
    const propertyId = parsePositiveId(req.params.propertyId);
    if (!propertyId) throw httpError(400, "Invalid property ID");

    const resourceId = parsePositiveId(req.body?.resourceId);
    const startsAt = parseDate(req.body?.startsAt);
    const endsAt = parseDate(req.body?.endsAt);
    const guestCount = req.body?.guestCount ?? 1;
    const guestNote = req.body?.guestNote ?? "";
    const key = req.get("Idempotency-Key");

    if (!resourceId || !startsAt || !endsAt || endsAt <= startsAt) {
      throw httpError(400, "resourceId, valid startsAt and endsAt are required; endsAt must be later than startsAt");
    }
    if (!Number.isSafeInteger(guestCount) || guestCount < 1) {
      throw httpError(400, "guestCount must be a positive integer");
    }
    if (typeof guestNote !== "string" || guestNote.length > 2000) {
      throw httpError(400, "guestNote must be a string of at most 2000 characters");
    }
    if (!validText(key, 200) || key.trim().length < 8) {
      throw httpError(400, "An Idempotency-Key header of 8 to 200 characters is required");
    }

    // Fast retry path: return the original reservation for the same guest and key.
    const previous = await pool.query(
      `SELECT * FROM hospitality_reservations
       WHERE guest_user_id = $1 AND idempotency_key = $2`,
      [req.user.id, key.trim()]
    );
    if (previous.rowCount) {
      const existing = previous.rows[0];
      if (!matchesReservationRequest(existing, {
        propertyId, resourceId, startsAt, endsAt, guestCount, guestNote
      })) {
        throw httpError(409, "Idempotency-Key was already used with a different reservation request");
      }
      return res.status(200).json({
        reservation: existing,
        idempotentReplay: true
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Serializes booking attempts for this resource, preventing concurrent
      // requests from both consuming the same remaining inventory.
      const resourceResult = await client.query(
        `SELECT r.id, r.property_id, r.capacity, r.inventory_count,
                r.price_minor, r.currency, r.pricing_unit, r.status, p.status AS property_status
         FROM hospitality_resources r
         JOIN hospitality_properties p ON p.id = r.property_id
         WHERE r.id = $1 AND r.property_id = $2
         FOR UPDATE OF r`,
        [resourceId, propertyId]
      );

      const resource = resourceResult.rows[0];
      if (!resource || resource.status !== "active" || resource.property_status !== "active") {
        throw httpError(404, "Available resource not found");
      }
      if (guestCount > resource.capacity) {
        throw httpError(400, "guestCount exceeds this resource's capacity");
      }
      const totalPriceMinor = calculateReservationPrice(
        resource.price_minor, resource.pricing_unit || "per_night", startsAt, endsAt, guestCount
      );
      if (totalPriceMinor === null) {
        throw httpError(400, "Reservation total is invalid or exceeds the supported amount range");
      }

      const overlap = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM hospitality_reservations
         WHERE resource_id = $1
           AND status IN ('pending', 'confirmed')
           AND (status <> 'pending' OR hold_expires_at > NOW())
           AND starts_at < $3
           AND ends_at > $2`,
        [resourceId, startsAt, endsAt]
      );

      if (overlap.rows[0].count >= resource.inventory_count) {
        throw httpError(409, "This resource has no inventory available for the selected time");
      }

      const inserted = await client.query(
        `INSERT INTO hospitality_reservations
           (property_id, resource_id, guest_user_id, starts_at, ends_at,
            guest_count, status, price_minor, currency, idempotency_key, guest_note)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10)
         RETURNING *`,
        [
          propertyId, resourceId, req.user.id, startsAt, endsAt, guestCount,
          totalPriceMinor, resource.currency, key.trim(), guestNote.trim()
        ]
      );

      const reservation = inserted.rows[0];
      await client.query(
        `INSERT INTO hospitality_reservation_events
           (reservation_id, actor_user_id, event_type, previous_status, new_status, details)
         VALUES ($1,$2,'reservation_created',NULL,'pending',$3::jsonb)`,
        [
          reservation.id, req.user.id,
          JSON.stringify({ source: "7even", resourceId, propertyId })
        ]
      );

      await client.query("COMMIT");
      return res.status(201).json({ reservation, idempotentReplay: false });
    } catch (error) {
      await client.query("ROLLBACK");

      // Handle the rare race where the same idempotency key was submitted twice.
      if (error.code === "23505") {
        const existing = await pool.query(
          `SELECT * FROM hospitality_reservations
           WHERE guest_user_id = $1 AND idempotency_key = $2`,
          [req.user.id, key.trim()]
        );
        if (existing.rowCount) {
          const reservation = existing.rows[0];
          if (!matchesReservationRequest(reservation, {
            propertyId, resourceId, startsAt, endsAt, guestCount, guestNote
          })) {
            throw httpError(409, "Idempotency-Key was already used with a different reservation request");
          }
          return res.status(200).json({
            reservation,
            idempotentReplay: true
          });
        }
      }
      throw error;
    } finally {
      client.release();
    }
  })
);

app.post("/hospitality/properties/:propertyId/reservations/:reservationId/confirm", authenticate,
  asyncRoute(async (req, res) => {
    const propertyId = parsePositiveId(req.params.propertyId);
    const reservationId = parsePositiveId(req.params.reservationId);
    if (!propertyId || !reservationId) throw httpError(400, "Invalid property or reservation ID");
    await requirePropertyRole(propertyId, req.user.id, ["owner", "manager"]);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT * FROM hospitality_reservations WHERE id = $1 AND property_id = $2 FOR UPDATE",
        [reservationId, propertyId]
      );
      const reservation = found.rows[0];
      if (!reservation) throw httpError(404, "Reservation not found");
      if (reservation.status === "confirmed") {
        await client.query("COMMIT");
        return res.json({ reservation, replay: true });
      }
      if (reservation.status !== "pending") throw httpError(409, "Only pending reservations can be confirmed");
      if (reservation.hold_expires_at && new Date(reservation.hold_expires_at) <= new Date()) {
        throw httpError(409, "This reservation hold expired; ask the guest to make a new request");
      }
      const updated = await client.query(
        "UPDATE hospitality_reservations SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
        [reservationId]
      );
      await client.query(
        "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,$2,'reservation_confirmed','pending','confirmed',$3::jsonb)",
        [reservationId, req.user.id, JSON.stringify({ source: "property_dashboard" })]
      );
      await client.query("COMMIT");
      return res.json({ reservation: updated.rows[0], replay: false });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

app.post("/hospitality/reservations/:reservationId/cancel", authenticate,
  asyncRoute(async (req, res) => {
    const reservationId = parsePositiveId(req.params.reservationId);
    if (!reservationId) throw httpError(400, "Invalid reservation ID");
    const reason = req.body?.reason ?? "";
    if (typeof reason !== "string" || reason.length > 500) throw httpError(400, "Cancellation reason must be at most 500 characters");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM hospitality_reservations WHERE id = $1 FOR UPDATE", [reservationId]);
      const reservation = found.rows[0];
      if (!reservation) throw httpError(404, "Reservation not found");
      const membership = await client.query(
        "SELECT role FROM hospitality_property_memberships WHERE property_id = $1 AND user_id = $2",
        [reservation.property_id, req.user.id]
      );
      const role = membership.rows[0]?.role;
      const isGuest = String(reservation.guest_user_id) === String(req.user.id);
      if (!isGuest && !["owner", "manager"].includes(role)) {
        throw httpError(403, "Only the guest or property owner/manager can cancel this reservation");
      }
      if (reservation.status === "cancelled") {
        await client.query("COMMIT");
        return res.json({ reservation, replay: true });
      }
      if (!["pending", "confirmed"].includes(reservation.status)) {
        throw httpError(409, "This reservation can no longer be cancelled");
      }
      if (reservation.payment_status === "paid") {
        throw httpError(409, "Payment has been collected; the refund workflow must be completed before this reservation can be cancelled. No cancellation was applied.");
      }
      const pendingOnlinePayment = await client.query(
        "SELECT id FROM hospitality_payments WHERE reservation_id = $1 AND provider = 'paystack' AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
        [reservationId]
      );
      if (pendingOnlinePayment.rowCount) {
        throw httpError(409, "An online payment session is unresolved. Verify the Paystack result before cancelling this reservation.");
      }
      const updated = await client.query(
        "UPDATE hospitality_reservations SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
        [reservationId, reason.trim()]
      );
      await client.query(
        "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,$2,'reservation_cancelled',$3,'cancelled',$4::jsonb)",
        [reservationId, req.user.id, reservation.status, JSON.stringify({ reason: reason.trim(), actorRole: isGuest ? "guest" : role })]
      );
      await client.query("COMMIT");
      return res.json({ reservation: updated.rows[0], replay: false });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

app.post("/hospitality/reservations/:reservationId/payment-intents", authenticate,
  asyncRoute(async (req, res) => {
    const reservationId = parsePositiveId(req.params.reservationId);
    if (!reservationId) throw httpError(400, "Invalid reservation ID");
    const provider = req.body?.provider;
    if (!["paystack", "cash_at_property"].includes(provider)) {
      throw httpError(400, "provider must be paystack or cash_at_property");
    }
    if (provider === "paystack") {
      if (!process.env.PAYSTACK_SECRET_KEY) throw httpError(503, "Paystack is not configured. Set PAYSTACK_SECRET_KEY before enabling online payments.");
      if (!req.user.email) throw httpError(400, "A valid account email is required for Paystack checkout");
      const foundReservation = await pool.query(
        "SELECT * FROM hospitality_reservations WHERE id = $1",
        [reservationId]
      );
      const reservation = foundReservation.rows[0];
      if (!reservation) throw httpError(404, "Reservation not found");
      if (String(reservation.guest_user_id) !== String(req.user.id)) throw httpError(403, "Only the reservation guest can initiate payment");
      if (!["pending", "confirmed"].includes(reservation.status)) throw httpError(409, "Payment is not available for this reservation status");
      if (reservation.payment_status === "paid") throw httpError(409, "This reservation is already marked as paid");
      const existingPayment = await pool.query(
        "SELECT id, reservation_id, amount_minor, currency, provider, provider_reference, status, checkout_url, created_at FROM hospitality_payments WHERE reservation_id = $1 AND provider = 'paystack' AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
        [reservationId]
      );
      if (existingPayment.rowCount) {
        const payment = existingPayment.rows[0];
        return res.json({ payment, checkoutUrl: payment.checkout_url, reference: payment.provider_reference, message: "An existing Paystack checkout session was recovered." });
      }
      const reference = paystackReference();
      const transaction = await paystackRequest("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: req.user.email,
          amount: String(reservation.price_minor),
          currency: reservation.currency,
          reference,
          ...(process.env.PAYSTACK_CALLBACK_URL ? { callback_url: process.env.PAYSTACK_CALLBACK_URL } : {}),
          metadata: JSON.stringify({ reservationId: Number(reservation.id), userId: req.user.id, type: "hospitality_reservation" })
        })
      });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const payment = await client.query(
          "INSERT INTO hospitality_payments (reservation_id, guest_user_id, amount_minor, currency, provider, provider_reference, status, checkout_url, provider_response) VALUES ($1,$2,$3,$4,'paystack',$5,'pending',$6,$7::jsonb) RETURNING id, reservation_id, amount_minor, currency, provider, provider_reference, status, checkout_url, created_at",
          [reservationId, req.user.id, reservation.price_minor, reservation.currency, reference, transaction.authorization_url, JSON.stringify({ access_code: transaction.access_code })]
        );
        await client.query("UPDATE hospitality_reservations SET payment_status = 'pending', updated_at = NOW() WHERE id = $1", [reservationId]);
        await client.query(
          "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,$2,'payment_pending',$3,$3,$4::jsonb)",
          [reservationId, req.user.id, reservation.status, JSON.stringify({ paymentId: payment.rows[0].id, provider: "paystack", reference })]
        );
        await client.query("COMMIT");
        return res.status(201).json({ payment: payment.rows[0], checkoutUrl: transaction.authorization_url, reference, message: "Paystack checkout initialized. Payment will only be marked paid after server-side verification." });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM hospitality_reservations WHERE id = $1 FOR UPDATE", [reservationId]);
      const reservation = found.rows[0];
      if (!reservation) throw httpError(404, "Reservation not found");
      if (String(reservation.guest_user_id) !== String(req.user.id)) {
        throw httpError(403, "Only the reservation guest can initiate payment");
      }
      if (!["pending", "confirmed"].includes(reservation.status)) {
        throw httpError(409, "Payment is not available for this reservation status");
      }
      if (reservation.payment_status === "paid") throw httpError(409, "This reservation is already marked as paid");
      const payment = await client.query(
        "INSERT INTO hospitality_payments (reservation_id, guest_user_id, amount_minor, currency, provider, status) VALUES ($1,$2,$3,$4,'cash_at_property','pending') RETURNING id, reservation_id, amount_minor, currency, provider, status, created_at",
        [reservationId, req.user.id, reservation.price_minor, reservation.currency]
      );
      await client.query(
        "UPDATE hospitality_reservations SET payment_status = 'pending', updated_at = NOW() WHERE id = $1",
        [reservationId]
      );
      await client.query(
        "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,$2,'payment_pending',$3,$3,$4::jsonb)",
        [reservationId, req.user.id, reservation.status, JSON.stringify({ paymentId: payment.rows[0].id, provider: "cash_at_property" })]
      );
      await client.query("COMMIT");
      return res.status(201).json({
        payment: payment.rows[0],
        message: "Payment is pending and has not been received. Pay at the property; staff must reconcile it."
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

app.post("/hospitality/payments/verify", authenticate, asyncRoute(async (req, res) => {
  const reference = req.body?.reference;
  if (typeof reference !== "string" || !/^[A-Za-z0-9.=\-]{8,120}$/.test(reference)) {
    throw httpError(400, "A valid Paystack reference is required");
  }
  const found = await pool.query(
    "SELECT id, guest_user_id, status, amount_minor, currency FROM hospitality_payments WHERE provider = 'paystack' AND provider_reference = $1",
    [reference]
  );
  const payment = found.rows[0];
  if (!payment || String(payment.guest_user_id) !== String(req.user.id)) {
    throw httpError(404, "Paystack payment not found for this account");
  }
  if (payment.status === "succeeded") return res.json({ verified: true, paymentStatus: "paid", message: "Payment was already verified." });
  if (payment.status === "refunded") return res.json({ verified: true, paymentStatus: "refunded", message: "Payment has been refunded." });
  const transaction = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference));
  const outcome = await markPaystackPayment(reference, transaction);
  return res.json({
    verified: outcome.verified === true,
    paymentStatus: outcome.refunded ? "refunded" : outcome.verified ? "paid" : "failed",
    providerStatus: outcome.status || transaction.status,
    message: outcome.refunded ? "This Paystack payment has already been refunded." : outcome.verified ? "Paystack payment verified by the server." : "Paystack did not confirm a successful payment."
  });
}));

app.post("/hospitality/webhooks/paystack", asyncRoute(async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw httpError(503, "Paystack webhook is not configured");
  const signature = req.get("x-paystack-signature") || "";
  const expected = crypto.createHmac("sha512", secret).update(req.rawBody || Buffer.from(JSON.stringify(req.body))).digest("hex");
  if (!safeEqualHex(signature, expected)) throw httpError(401, "Invalid Paystack webhook signature");
  const event = req.body || {};
  const data = event.data || {};
  if (event.event === "charge.success" && data.reference) {
    const transaction = await paystackRequest("/transaction/verify/" + encodeURIComponent(String(data.reference)));
    await markPaystackPayment(String(data.reference), transaction);
    return res.json({ received: true });
  }
  if (["refund.processed", "refund.failed", "refund.pending", "refund.processing"].includes(event.event) && data.id) {
    const status = event.event === "refund.processed" ? "processed"
      : event.event === "refund.failed" ? "failed"
      : event.event === "refund.processing" ? "processing" : "pending";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT * FROM hospitality_payments WHERE provider = 'paystack' AND provider_refund_id = $1 FOR UPDATE",
        [String(data.id)]
      );
      const payment = found.rows[0];
      if (payment) {
        await client.query(
          "UPDATE hospitality_payments SET refund_status = $2, status = CASE WHEN $2 = 'processed' THEN 'refunded' ELSE status END, refunded_at = CASE WHEN $2 = 'processed' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END, provider_response = COALESCE(provider_response, '{}'::jsonb) || jsonb_build_object('refundWebhook', $3::jsonb), updated_at = NOW() WHERE id = $1",
          [payment.id, status, JSON.stringify({ event: event.event, status: data.status || status })]
        );
        if (status === "processed") {
          await client.query("UPDATE hospitality_reservations SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1", [payment.reservation_id]);
          await client.query(
            "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,NULL,'payment_refunded',$2,$2,$3::jsonb)",
            [payment.reservation_id, "paid", JSON.stringify({ provider: "paystack", refundId: String(data.id) })]
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return res.json({ received: true });
}));

app.post("/hospitality/reservations/:reservationId/refunds", authenticate, asyncRoute(async (req, res) => {
  const reservationId = parsePositiveId(req.params.reservationId);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 200) : "Reservation refund requested";
  if (!reservationId) throw httpError(400, "Invalid reservation ID");
  const found = await pool.query(
    "SELECT r.*, p.provider, p.provider_reference, p.status AS payment_record_status, p.refund_status, p.provider_refund_id FROM hospitality_reservations r JOIN LATERAL (SELECT * FROM hospitality_payments WHERE reservation_id = r.id ORDER BY created_at DESC LIMIT 1) p ON TRUE WHERE r.id = $1",
    [reservationId]
  );
  const row = found.rows[0];
  if (!row) throw httpError(404, "Reservation or payment not found");
  const membership = await pool.query(
    "SELECT role FROM hospitality_property_memberships WHERE property_id = $1 AND user_id = $2",
    [row.property_id, req.user.id]
  );
  const isGuest = String(row.guest_user_id) === String(req.user.id);
  if (!isGuest && !["owner", "manager"].includes(membership.rows[0]?.role)) throw httpError(403, "Only the guest or property owner/manager can request a refund");
  if (row.payment_status !== "paid" || row.payment_record_status !== "succeeded") throw httpError(409, "Only a verified, paid reservation can be refunded");
  if (row.provider !== "paystack" || !row.provider_reference) throw httpError(409, "This payment was not processed by Paystack. The property must complete and record any cash refund before cancellation.");
  if (["pending", "processing", "processed"].includes(row.refund_status)) throw httpError(409, "A refund has already been requested for this payment");
  const refund = await paystackRequest("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: row.provider_reference, customer_note: reason, merchant_note: "7even reservation refund " + reservationId })
  });
  const status = refund.status === "processed" || refund.status === "success" ? "processed"
    : refund.status === "processing" ? "processing"
    : refund.status === "needs-attention" ? "needs_attention" : "pending";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE hospitality_payments SET refund_status = $2, provider_refund_id = $3, refund_amount_minor = $4, refund_requested_at = NOW(), refunded_at = CASE WHEN $2 = 'processed' THEN NOW() ELSE refunded_at END, status = CASE WHEN $2 = 'processed' THEN 'refunded' ELSE status END, provider_response = COALESCE(provider_response, '{}'::jsonb) || jsonb_build_object('refundRequest', $5::jsonb), updated_at = NOW() WHERE provider = 'paystack' AND provider_reference = $1",
      [row.provider_reference, status, String(refund.id), Number(refund.amount || row.price_minor), JSON.stringify({ status: refund.status || status })]
    );
    if (status === "processed") {
      await client.query("UPDATE hospitality_reservations SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1", [reservationId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return res.status(202).json({
    refundStatus: status,
    message: status === "processed" ? "Refund confirmed by Paystack. You may now cancel the reservation if needed." : "Refund request submitted to Paystack. The reservation remains paid until Paystack confirms the refund."
  });
}));

app.post("/hospitality/properties/:propertyId/reservations/:reservationId/payments/:paymentId/reconcile", authenticate,
  asyncRoute(async (req, res) => {
    const propertyId = parsePositiveId(req.params.propertyId);
    const reservationId = parsePositiveId(req.params.reservationId);
    const paymentId = parsePositiveId(req.params.paymentId);
    const outcome = req.body?.outcome;
    const confirmationNote = req.body?.confirmationNote;
    if (!propertyId || !reservationId || !paymentId) throw httpError(400, "Invalid property, reservation or payment ID");
    if (!["succeeded", "failed", "refunded"].includes(outcome)) throw httpError(400, "outcome must be succeeded, failed or refunded");
    await requirePropertyRole(propertyId, req.user.id, ["owner", "manager", "staff"]);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const reservationResult = await client.query(
        "SELECT * FROM hospitality_reservations WHERE id = $1 AND property_id = $2 FOR UPDATE",
        [reservationId, propertyId]
      );
      const reservation = reservationResult.rows[0];
      if (!reservation) throw httpError(404, "Reservation not found");
      const paymentResult = await client.query(
        "SELECT * FROM hospitality_payments WHERE id = $1 AND reservation_id = $2 FOR UPDATE",
        [paymentId, reservationId]
      );
      const payment = paymentResult.rows[0];
      if (!payment) throw httpError(404, "Payment record not found");
      if (payment.provider !== "cash_at_property" && payment.provider !== "manual") {
        throw httpError(409, "Only in-person or manual payments can be reconciled here");
      }
      if (outcome === "refunded") {
        if (payment.status !== "succeeded" || reservation.payment_status !== "paid") {
          throw httpError(409, "Only a successfully recorded paid reservation can be reconciled as refunded");
        }
        if (!validText(confirmationNote, 500)) throw httpError(400, "A refund confirmation note is required");
        await client.query(
          "UPDATE hospitality_payments SET status = 'refunded', refund_status = 'processed', refund_amount_minor = amount_minor, refund_requested_at = COALESCE(refund_requested_at, NOW()), refunded_at = NOW(), provider_response = COALESCE(provider_response, '{}'::jsonb) || jsonb_build_object('manualRefund', $2::jsonb), updated_at = NOW() WHERE id = $1",
          [paymentId, JSON.stringify({ reconciledBy: req.user.id, confirmationNote: confirmationNote.trim() })]
        );
        await client.query("UPDATE hospitality_reservations SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1", [reservationId]);
        await client.query(
          "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,$2,'payment_refunded',$3,$3,$4::jsonb)",
          [reservationId, req.user.id, reservation.status, JSON.stringify({ provider: payment.provider, method: "manual", confirmationNote: confirmationNote.trim() })]
        );
        await client.query("COMMIT");
        return res.json({ reservationPaymentStatus: "refunded", message: "Manual refund recorded. The guest can now cancel the reservation." });
      }
      if (payment.status === "succeeded" && outcome === "succeeded") {
        await client.query("COMMIT");
        return res.json({ payment, replay: true, message: "Payment was already reconciled as received." });
      }
      if (payment.status !== "pending") throw httpError(409, "Only pending payments can be reconciled");
      const updatedPayment = await client.query(
        "UPDATE hospitality_payments SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id, reservation_id, amount_minor, currency, provider, status, created_at, updated_at",
        [paymentId, outcome]
      );
      await client.query(
        "UPDATE hospitality_reservations SET payment_status = $2, paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $1",
        [reservationId, outcome === "succeeded" ? "paid" : "failed"]
      );
      await client.query(
        "INSERT INTO hospitality_reservation_events (reservation_id, actor_user_id, event_type, previous_status, new_status, details) VALUES ($1,$2,$3,$4,$4,$5::jsonb)",
        [reservationId, req.user.id, outcome === "succeeded" ? "payment_received" : "payment_failed", reservation.status,
          JSON.stringify({ paymentId, reconciledBy: req.user.id, provider: payment.provider })]
      );
      await client.query("COMMIT");
      return res.json({
        payment: updatedPayment.rows[0],
        reservationPaymentStatus: outcome === "succeeded" ? "paid" : "failed",
        message: outcome === "succeeded" ? "Payment recorded as received by property staff." : "Payment marked as not received."
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

app.get("/hospitality/reservations", authenticate, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT r.*, p.name AS property_name, resource.name AS resource_name,
            pay.provider AS payment_provider, pay.provider_reference AS payment_reference,
            pay.status AS payment_record_status, pay.refund_status, pay.checkout_url
     FROM hospitality_reservations r
     JOIN hospitality_properties p ON p.id = r.property_id
     JOIN hospitality_resources resource ON resource.id = r.resource_id
     LEFT JOIN LATERAL (
       SELECT provider, provider_reference, status, refund_status, checkout_url
       FROM hospitality_payments WHERE reservation_id = r.id
       ORDER BY created_at DESC LIMIT 1
     ) pay ON TRUE
     WHERE r.guest_user_id = $1
     ORDER BY r.created_at DESC
     LIMIT 200`,
    [req.user.id]
  );
  res.json({ reservations: result.rows });
}));

app.get("/hospitality/properties/:propertyId/reservations", authenticate,
  asyncRoute(async (req, res) => {
    const propertyId = parsePositiveId(req.params.propertyId);
    if (!propertyId) throw httpError(400, "Invalid property ID");

    await requirePropertyRole(propertyId, req.user.id, ["owner", "manager", "staff"]);

    const result = await pool.query(
      `SELECT r.*, resource.name AS resource_name,
              pay.id AS payment_id, pay.provider AS payment_provider, pay.status AS payment_record_status,
              pay.refund_status, pay.provider_reference AS payment_reference
       FROM hospitality_reservations r
       JOIN hospitality_resources resource ON resource.id = r.resource_id
       LEFT JOIN LATERAL (
         SELECT id, provider, provider_reference, status, refund_status
         FROM hospitality_payments WHERE reservation_id = r.id
         ORDER BY created_at DESC LIMIT 1
       ) pay ON TRUE
       WHERE r.property_id = $1
       ORDER BY r.starts_at DESC
       LIMIT 500`,
      [propertyId]
    );
    res.json({ reservations: result.rows });
  })
);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status) return res.status(error.status).json({ error: error.message });

  console.error("Hospitality service error:", error.message);
  return res.status(500).json({ error: "Hospitality service error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`7even hospitality service listening on :${PORT}`);
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BedDouble, Bus, CheckCircle2, Clock3, Hotel, LogIn, LogOut, MapPin, Plane, RefreshCw, Search, ShieldCheck, UserRound, Wallet, AlertCircle } from "lucide-react";
import "./HospitalityWorkspace.css";

const API_BASE = import.meta.env.VITE_GATEWAY_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:4000" : "http://" + window.location.hostname + ":4000");
const AIRPORT = { lat: "4.875833", lng: "8.098889" };
const emptyProperty = { name: "", propertyType: "hotel", description: "", address: "", city: "Uyo", contactName: "", contactPhone: "", contactEmail: "", websiteUrl: "", latitude: "", longitude: "" };
const emptyRoom = { name: "", description: "", capacity: "2", inventoryCount: "1", priceNaira: "", pricingUnit: "per_night" };

function money(minor, currency) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN", maximumFractionDigits: 0 }).format(Number(minor || 0) / 100);
}
function dateInput() {
  const date = new Date(Date.now() + 86400000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function endDate(start, nights) {
  const date = new Date(start);
  if (!start || !Number.isFinite(date.getTime())) return "";
  date.setDate(date.getDate() + Math.max(1, Number(nights) || 1));
  return date.toISOString();
}
function readable(value) { return String(value || "unknown").replaceAll("_", " "); }
function messageOf(error) { return error instanceof Error ? error.message : "Request failed. Please try again."; }

export default function HospitalityWorkspace() {
  const [tab, setTab] = useState("discover");
  const [arrival, setArrival] = useState({
    originType: "airport", originLabel: "Akwa Ibom Airport", originLat: AIRPORT.lat, originLng: AIRPORT.lng,
    need: "hotel_now", budget: "", guests: "1", checkIn: dateInput(), nights: "1"
  });
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem("seven_access_token") || ""; } catch { return ""; } });
  const [user, setUser] = useState(() => { try { return JSON.parse(sessionStorage.getItem("seven_user") || "null"); } catch { return null; } });
  const [showAccount, setShowAccount] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [propertyForm, setPropertyForm] = useState(emptyProperty);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [rooms, setRooms] = useState([]);
  const [partnerReservations, setPartnerReservations] = useState([]);
  const [reviewProperties, setReviewProperties] = useState([]);
  const checkout = useMemo(() => endDate(arrival.checkIn, arrival.nights), [arrival.checkIn, arrival.nights]);

  const api = useCallback(async (path, options = {}) => {
    const headers = { "content-type": "application/json", ...(options.headers || {}) };
    if (token) headers.authorization = "Bearer " + token;
    const response = await fetch(API_BASE + path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) {
        setToken(""); setUser(null);
        try { sessionStorage.removeItem("seven_access_token"); sessionStorage.removeItem("seven_user"); } catch {}
        window.dispatchEvent(new Event("apren:auth-changed"));
      }
      throw new Error(data.error || "Request failed (" + response.status + ")");
    }
    return data;
  }, [token]);

  const loadBookings = useCallback(async () => {
    if (!token) { setBookings([]); return; }
    const data = await api("/api/hospitality/reservations");
    setBookings(data.reservations || []);
  }, [api, token]);
  const loadProperties = useCallback(async () => {
    if (!token) { setProperties([]); return; }
    const data = await api("/api/hospitality/properties");
    setProperties(data.properties || []);
  }, [api, token]);
  const loadRooms = useCallback(async id => {
    if (!token || !id) { setRooms([]); return; }
    const data = await api("/api/hospitality/properties/" + id + "/resources");
    setRooms(data.resources || []);
  }, [api, token]);
  const loadPartnerReservations = useCallback(async id => {
    if (!token || !id) { setPartnerReservations([]); return; }
    const data = await api("/api/hospitality/properties/" + id + "/reservations");
    setPartnerReservations(data.reservations || []);
  }, [api, token]);
  const loadReviewProperties = useCallback(async () => {
    if (!token || user?.role !== "admin") { setReviewProperties([]); return; }
    const data = await api("/api/hospitality/admin/properties?status=pending");
    setReviewProperties(data.properties || []);
  }, [api, token, user]);

  useEffect(() => {
    if (token) {
      loadBookings().catch(() => {});
      loadProperties().catch(() => {});
      loadReviewProperties().catch(() => {});
    }
  }, [token, loadBookings, loadProperties, loadReviewProperties]);
  useEffect(() => {
    if (selectedPropertyId && token) {
      loadRooms(selectedPropertyId).catch(() => {});
      loadPartnerReservations(selectedPropertyId).catch(() => {});
    }
  }, [selectedPropertyId, token, loadRooms, loadPartnerReservations]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!token || !reference) return undefined;
    let active = true;
    api("/api/hospitality/payments/verify", { method: "POST", body: JSON.stringify({ reference }) })
      .then(data => {
        if (!active) return;
        setTab("bookings");
        setNotice(data.message || "Payment verification completed.");
        return loadBookings();
      })
      .then(() => {
        if (active) window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(err => { if (active) setError(messageOf(err)); });
    return () => { active = false; };
  }, [token, api, loadBookings]);

  function updateArrival(key, value) {
    setArrival(current => {
      const next = { ...current, [key]: value };
      if (key === "originType") {
        next.originLabel = value === "airport" ? "Akwa Ibom Airport" : "";
        next.originLat = value === "airport" ? AIRPORT.lat : "";
        next.originLng = value === "airport" ? AIRPORT.lng : "";
      }
      if (key === "originLabel") {
        const label = value.trim().toLowerCase();
        if (label === "aktc / nsik motors — itam industrial layout") {
          next.originLat = "5.0507533";
          next.originLng = "7.8890556";
        } else if (label === "abc transport — no. 17, monsignor akpan mbak avenue") {
          next.originLat = "5.0554974";
          next.originLng = "7.8832061";
        } else if (label !== "akwa ibom airport") {
          next.originLat = "";
          next.originLng = "";
        }
      }
      return next;
    });
  }
  function field(label, id, value, onChange, props = {}) {
    return <label className="seven-field" htmlFor={id}><span>{label}</span><input id={id} value={value} onChange={event => onChange(event.target.value)} {...props} /></label>;
  }

  async function searchStays(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const params = new URLSearchParams({ city: "Uyo", origin: arrival.originLabel, originType: arrival.originType, guests: arrival.guests, checkIn: new Date(arrival.checkIn).toISOString(), checkOut: checkout });
      if (arrival.budget !== "") params.set("budgetNaira", arrival.budget);
      if (arrival.originLat !== "" && arrival.originLng !== "") { params.set("originLat", arrival.originLat); params.set("originLng", arrival.originLng); }
      const hotelNeed = ["hotel_now", "hotel_later", "full_arrival"].includes(arrival.need);
      if (hotelNeed) {
        const data = await api("/api/hospitality/discover?" + params.toString(), { method: "GET", headers: {} });
        setResults(data);
      } else {
        setResults(null);
      }
      const saved = await api("/api/hospitality/arrival-intents", { method: "POST", body: JSON.stringify({
        originType: arrival.originType, originLabel: arrival.originLabel, city: "Uyo", need: arrival.need,
        budgetNaira: arrival.budget === "" ? null : Number(arrival.budget), guestCount: Number(arrival.guests),
        checkIn: new Date(arrival.checkIn).toISOString(), checkOut: checkout
      }) });
      setNotice(!hotelNeed && arrival.need === "transport"
        ? "Your transport need is saved. Live transport-provider discovery is not connected yet, so no unverified options are shown."
        : !hotelNeed && arrival.need === "food"
          ? "Your food need is saved. Live food-provider discovery is not connected yet, so no unverified options are shown."
          : saved.message || "Arrival search updated.");
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }

  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = authMode === "register" ? authForm : { email: authForm.email, password: authForm.password };
      const response = await fetch(API_BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Account request failed");
      setToken(data.accessToken); setUser(data.user); setShowAccount(false);
      try { sessionStorage.setItem("seven_access_token", data.accessToken); sessionStorage.setItem("seven_user", JSON.stringify(data.user)); } catch {}
      window.dispatchEvent(new Event("apren:auth-changed"));
      setNotice("Signed in as " + (data.user?.name || data.user?.email) + ".");
      setAuthForm({ name: "", email: authForm.email, password: "" });
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }

  async function createBooking(property, resource) {
    if (!token) { setShowAccount(true); setError("Sign in or create an account to request this room."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/hospitality/properties/" + property.id + "/reservations", {
        method: "POST", headers: { "Idempotency-Key": "seven-" + crypto.randomUUID() },
        body: JSON.stringify({ resourceId: resource.id, startsAt: new Date(arrival.checkIn).toISOString(), endsAt: checkout, guestCount: Number(arrival.guests), guestNote: "" })
      });
      setNotice(data.idempotentReplay ? "Existing reservation request recovered." : "Reservation request created. It remains pending until the property confirms it.");
      setTab("bookings"); await loadBookings();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }

  async function cancelBooking(id) {
    if (!window.confirm("Cancel this reservation? Paid reservations cannot be cancelled until refunds are supported.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await api("/api/hospitality/reservations/" + id + "/cancel", { method: "POST", body: JSON.stringify({ reason: "Cancelled by guest" }) }); setNotice("Reservation cancelled."); await loadBookings(); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function requestPaystackPayment(id) {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/hospitality/reservations/" + id + "/payment-intents", { method: "POST", body: JSON.stringify({ provider: "paystack" }) });
      if (!data.checkoutUrl) throw new Error("Paystack did not return a checkout URL.");
      window.location.assign(data.checkoutUrl);
    } catch (err) { setError(messageOf(err)); setBusy(false); }
  }
  async function verifyPaystackPayment(reference) {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/hospitality/payments/verify", { method: "POST", body: JSON.stringify({ reference }) });
      setNotice(data.message || "Payment verification completed.");
      await loadBookings();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function requestRefund(id) {
    if (!window.confirm("Request a refund from Paystack? The booking remains paid until Paystack confirms the refund.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/hospitality/reservations/" + id + "/refunds", { method: "POST", body: JSON.stringify({ reason: "Guest requested a reservation refund" }) });
      setNotice(data.message || "Refund request submitted.");
      await loadBookings();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function requestCashPayment(id) {
    setBusy(true); setError(""); setNotice("");
    try { const data = await api("/api/hospitality/reservations/" + id + "/payment-intents", { method: "POST", body: JSON.stringify({ provider: "cash_at_property" }) }); setNotice(data.message || "Cash payment is pending; it has not been marked as received."); await loadBookings(); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function createProperty(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const body = { ...propertyForm, latitude: propertyForm.latitude === "" ? null : Number(propertyForm.latitude), longitude: propertyForm.longitude === "" ? null : Number(propertyForm.longitude) };
      const data = await api("/api/hospitality/properties", { method: "POST", body: JSON.stringify(body) });
      await loadProperties(); setSelectedPropertyId(String(data.property.id)); setPropertyForm(emptyProperty);
      setNotice("Property registered. Details and coordinates remain unverified until administrator review.");
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function createRoom(event) {
    event.preventDefault();
    if (!selectedPropertyId) { setError("Create or select a property first."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/hospitality/properties/" + selectedPropertyId + "/resources", { method: "POST", body: JSON.stringify({
        name: roomForm.name, resourceType: "room", description: roomForm.description,
        capacity: Number(roomForm.capacity), inventoryCount: Number(roomForm.inventoryCount),
        priceMinor: Math.round(Number(roomForm.priceNaira) * 100), currency: "NGN", pricingUnit: roomForm.pricingUnit
      }) });
      await loadRooms(selectedPropertyId); setRoomForm(emptyRoom); setNotice("Room added to property inventory.");
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function confirmReservation(propertyId, reservationId) {
    setBusy(true); setError(""); setNotice("");
    try { await api("/api/hospitality/properties/" + propertyId + "/reservations/" + reservationId + "/confirm", { method: "POST", body: JSON.stringify({}) }); setNotice("Reservation confirmed."); await loadPartnerReservations(propertyId); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function reviewProperty(propertyId, status) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/hospitality/properties/" + propertyId + "/location-verification", { method: "POST", body: JSON.stringify({ status }) });
      setNotice("Property verification updated to " + status + ".");
      await loadReviewProperties();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function reconcileCashPayment(propertyId, reservationId, paymentId, outcome) {
    const label = outcome === "succeeded" ? "Confirm cash has actually been received?" : "Mark that cash was not received?";
    if (!window.confirm(label)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/hospitality/properties/" + propertyId + "/reservations/" + reservationId + "/payments/" + paymentId + "/reconcile", {
        method: "POST", body: JSON.stringify({ outcome })
      });
      setNotice(data.message || "Cash payment reconciled.");
      await loadPartnerReservations(propertyId);
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function reconcileCashRefund(propertyId, reservationId, paymentId) {
    const confirmationNote = window.prompt("Record the cash refund reference or confirmation details:");
    if (!confirmationNote || !confirmationNote.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/hospitality/properties/" + propertyId + "/reservations/" + reservationId + "/payments/" + paymentId + "/reconcile", {
        method: "POST", body: JSON.stringify({ outcome: "refunded", confirmationNote: confirmationNote.trim() })
      });
      setNotice(data.message || "Manual refund recorded.");
      await loadPartnerReservations(propertyId);
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function signOut() {
    try { if (token) await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }); } catch {}
    setToken(""); setUser(null); setBookings([]); setProperties([]); setPartnerReservations([]); setRooms([]);
    try { sessionStorage.removeItem("seven_access_token"); sessionStorage.removeItem("seven_user"); } catch {}
    window.dispatchEvent(new Event("apren:auth-changed"));
    setNotice("You have signed out.");
  }

  return (
    <div className="scroll seven-workspace">
      <div className="seven-head">
        <div><div className="seven-brand">7even Hospitality · intelligence by āprən</div><div className="seven-title">Arrive with a plan.</div></div>
        <button className="seven-account" onClick={() => setShowAccount(v => !v)}>{user ? <UserRound size={15} /> : <LogIn size={15} />}{user ? user.name || "Account" : "Sign in"}</button>
      </div>
      <div className="seven-tabs" role="tablist" aria-label="Hospitality workspace">
        <button className={"seven-tab" + (tab === "discover" ? " active" : "")} onClick={() => setTab("discover")}>Find a stay</button>
        <button className={"seven-tab" + (tab === "bookings" ? " active" : "")} onClick={() => { setTab("bookings"); loadBookings().catch(err => setError(messageOf(err))); }}>My bookings</button>
        <button className={"seven-tab" + (tab === "partner" ? " active" : "")} onClick={() => { setTab("partner"); loadProperties().catch(err => setError(messageOf(err))); }}>Hotel partner</button>
      </div>

      {showAccount && <section className="seven-auth">
        <div className="seven-auth-head"><h3>{user ? "Your account" : authMode === "register" ? "Create your 7even account" : "Sign in to 7even"}</h3>{user ? <button className="seven-link" onClick={signOut}><LogOut size={12} /> Sign out</button> : <button className="seven-link" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Create account" : "I have an account"}</button>}</div>
        {user ? <p className="seven-muted">{user.email} · Your reservations and property dashboard are linked to this account.</p> : <form onSubmit={submitAuth}>
          {authMode === "register" && field("Full name", "seven-auth-name", authForm.name, value => setAuthForm(v => ({ ...v, name: value })), { required: true, minLength: 2, maxLength: 120, autoComplete: "name" })}
          {field("Email address", "seven-auth-email", authForm.email, value => setAuthForm(v => ({ ...v, email: value })), { required: true, type: "email", autoComplete: "email" })}
          {field("Password", "seven-auth-password", authForm.password, value => setAuthForm(v => ({ ...v, password: value })), { required: true, type: "password", minLength: 8, autoComplete: authMode === "register" ? "new-password" : "current-password" })}
          <button className="seven-primary" disabled={busy} type="submit">{busy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"} <ArrowRight size={15} /></button>
          <p className="seven-muted">Access token stays in this browser session and is cleared when you sign out or the session expires.</p>
        </form>}
      </section>}
      {notice && <div className="seven-status" role="status">{notice}</div>}
      {error && <div className="seven-status error" role="alert"><AlertCircle size={15} /> {error}</div>}

      {tab === "discover" && <>
        <section className="seven-hero"><small>First destination · Uyo, Akwa Ibom</small><h2>From arrival point to the right room.</h2><p>Tell us where you are arriving, when you need a room and your budget. Results use live property inventory—not invented listings.</p><div className="seven-meta"><span><Plane size={12} /> Airport</span><span><Bus size={12} /> Bus terminals</span><span><ShieldCheck size={12} /> Evidence-led</span></div></section>
        <form className="seven-card" onSubmit={searchStays}>
          <h3>Plan your arrival</h3><p className="seven-muted">Distance appears only when origin coordinates and administrator-verified property coordinates are available. Airport coordinates are prefilled; terminal coordinates must be supplied if known.</p>
          <label className="seven-field" htmlFor="seven-origin-type"><span>Arrival type</span><select id="seven-origin-type" value={arrival.originType} onChange={e => updateArrival("originType", e.target.value)}><option value="airport">Akwa Ibom Airport</option><option value="bus_terminal">Bus terminal / motor park</option><option value="in_uyo">Already in Uyo</option><option value="other">Other arrival point</option></select></label>
          {field("Arrival point / landmark", "seven-origin", arrival.originLabel, value => updateArrival("originLabel", value), { required: true, maxLength: 180, placeholder: "Airport, terminal or Uyo area", list: "seven-landmarks" })}
          <datalist id="seven-landmarks"><option value="Akwa Ibom Airport" /><option value="AKTC / Nsik Motors — Itam Industrial Layout" /><option value="GIGM — Monsignor Akpan Avenue, Itam" /><option value="ABC Transport — Long Distance Bus Terminal, Park Road, Itam" /><option value="ABC Transport — Ikot Ekpene Road, Uyo" /><option value="ABC Transport — No. 17, Monsignor Akpan Mbak Avenue" /></datalist>
          <div className="seven-grid">
            {field("Latitude (optional)", "seven-origin-lat", arrival.originLat, value => updateArrival("originLat", value), { type: "number", step: "any", min: -90, max: 90, placeholder: "Coordinates" })}
            {field("Longitude (optional)", "seven-origin-lng", arrival.originLng, value => updateArrival("originLng", value), { type: "number", step: "any", min: -180, max: 180, placeholder: "Coordinates" })}
            <label className="seven-field" htmlFor="seven-need"><span>Priority</span><select id="seven-need" value={arrival.need} onChange={e => updateArrival("need", e.target.value)}><option value="hotel_now">Room immediately</option><option value="hotel_later">Room later</option><option value="full_arrival">Full arrival help</option><option value="transport">Transport first</option><option value="food">Food first</option></select></label>
            {field("Budget per night (₦)", "seven-budget", arrival.budget, value => updateArrival("budget", value), { type: "number", min: 0, step: 500, placeholder: "Any budget" })}
            <label className="seven-field" htmlFor="seven-guests"><span>Guests</span><select id="seven-guests" value={arrival.guests} onChange={e => updateArrival("guests", e.target.value)}>{Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{n} {n === 1 ? "guest" : "guests"}</option>)}</select></label>
            {field("Check-in", "seven-checkin", arrival.checkIn, value => updateArrival("checkIn", value), { type: "datetime-local", required: true })}
            <label className="seven-field" htmlFor="seven-nights"><span>Length of stay</span><select id="seven-nights" value={arrival.nights} onChange={e => updateArrival("nights", e.target.value)}>{[1, 2, 3, 4, 5, 7, 14].map(n => <option key={n} value={String(n)}>{n} {n === 1 ? "night" : "nights"}</option>)}</select></label>
          </div>
          <button className="seven-primary" disabled={busy || !arrival.originLabel.trim() || !arrival.checkIn} type="submit">{busy ? <RefreshCw size={15} /> : <Search size={15} />}{busy ? "Searching live inventory…" : "Find suitable rooms"} <ArrowRight size={15} /></button>
        </form>
        <div className="seven-status notice"><ShieldCheck size={15} /> Room availability is date-specific. A reservation request is not confirmed until the property accepts it.</div>
        {results && <>
          <div className="seven-section-title">Uyo accommodation <span className="seven-muted">· {results.count} properties</span></div>
          {!results.properties.length ? <div className="seven-empty"><BedDouble size={25} /><h3>No matching live rooms yet</h3><p>{results.notice} The next step is onboarding real hotels and room inventory.</p></div> :
            results.properties.map(property => <article className="seven-result" key={property.id}>
              <div className="seven-result-head"><div><h3>{property.name}</h3><div className="seven-muted">{[property.address, property.city].filter(Boolean).join(", ")}</div></div><span className="seven-chip">{property.verificationStatus === "verified" ? <ShieldCheck size={12} /> : <Clock3 size={12} />}{readable(property.verificationStatus)}</span></div>
              {property.description && <p className="seven-muted">{property.description}</p>}
              <div className="seven-meta">{property.driveMinutes !== undefined && <span><MapPin size={12} /> {property.driveMinutes} min drive · {property.driveDistanceKm} km road</span>}{property.distanceKm !== null && <span>{property.distanceKm} km straight-line</span>}{property.contactName && <span>Contact: {property.contactName}</span>}{property.contactPhone && <span>Phone: {property.contactPhone}</span>}{property.contactEmail && <span>Email: {property.contactEmail}</span>}{property.websiteUrl && <span><a href={property.websiteUrl} target="_blank" rel="noreferrer">Property website</a></span>}</div>
              {!property.coordinatesVerified && <p className="seven-muted">Distance not shown: property coordinates are not verified.</p>}
              {property.resources.map(resource => <div className="seven-room" key={resource.id}><div className="seven-result-head"><div><strong>{resource.name}</strong><div className="seven-muted">{resource.description || "Room"} · sleeps {resource.capacity}</div><div className="seven-price">{money(resource.priceMinor, resource.currency)} <small>{resource.pricingUnit === "per_night" ? "per night" : resource.pricingUnit === "per_person" ? "per person" : "per booking"}</small></div></div><span className="seven-chip">{results.checkedAvailability ? resource.availableUnits + " available" : "dates unchecked"}</span></div>{results.checkedAvailability && resource.availableUnits > 0 && <button className="seven-primary" type="button" disabled={busy} onClick={() => createBooking(property, resource)}>Request this room <ArrowRight size={14} /></button>}</div>)}
            </article>)}
          <p className="seven-muted">{results.notice}</p>
        </>}
      </>}

      {tab === "bookings" && <>
        <div className="seven-section-title">My reservations</div>
        {!token ? <div className="seven-empty"><UserRound size={24} /><p>Sign in to view reservations, cancel eligible bookings and track payment status.</p><button className="seven-primary" onClick={() => setShowAccount(true)}>Sign in or create account</button></div> :
          bookings.length === 0 ? <div className="seven-empty"><BedDouble size={24} /><p>No reservations are linked to this account yet.</p><button className="seven-secondary" onClick={() => setTab("discover")}>Find a stay</button></div> :
          bookings.map(item => <article className="seven-card" key={item.id}>
            <div className="seven-result-head"><div><h3>{item.property_name || "Property reservation"}</h3><div className="seven-muted">{item.resource_name} · {new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleDateString()}</div></div><span className="seven-chip">{readable(item.status)}</span></div>
            <div className="seven-meta"><span>{item.guest_count} guests</span><span>{money(item.price_minor, item.currency)} total</span><span>Payment: {readable(item.payment_status)}</span>{item.payment_provider && <span>Via {readable(item.payment_provider)}</span>}</div>
            {item.hold_expires_at && item.status === "pending" && <p className="seven-muted">Reservation hold expires: {new Date(item.hold_expires_at).toLocaleString()}</p>}
            <div className="seven-actions">
              {["pending", "confirmed"].includes(item.status) && item.payment_status !== "paid" && !(item.payment_status === "pending" && item.payment_provider === "paystack") && <button className="seven-secondary" disabled={busy} onClick={() => cancelBooking(item.id)}>Cancel request</button>}
              {["pending", "confirmed"].includes(item.status) && ["unpaid", "failed"].includes(item.payment_status) && <button className="seven-secondary" disabled={busy} onClick={() => requestPaystackPayment(item.id)}><Wallet size={13} /> Pay online</button>}
              {["pending", "confirmed"].includes(item.status) && ["unpaid", "failed"].includes(item.payment_status) && <button className="seven-secondary" disabled={busy} onClick={() => requestCashPayment(item.id)}>Pay at property</button>}
              {item.payment_status === "pending" && item.payment_provider === "paystack" && item.checkout_url && <button className="seven-secondary" disabled={busy} onClick={() => window.location.assign(item.checkout_url)}>Continue checkout</button>}
              {item.payment_status === "pending" && item.payment_provider === "paystack" && item.payment_reference && <button className="seven-secondary" disabled={busy} onClick={() => verifyPaystackPayment(item.payment_reference)}>Verify payment</button>}
              {item.payment_status === "paid" && item.payment_provider === "paystack" && !["pending", "processing", "processed"].includes(item.refund_status) && <button className="seven-secondary" disabled={busy} onClick={() => requestRefund(item.id)}>Request refund</button>}
            </div>
            {item.payment_status === "pending" && item.payment_provider === "cash_at_property" && <p className="seven-muted">Cash payment is pending and has not been marked as received. Property staff must reconcile it.</p>}
            {item.payment_status === "pending" && item.payment_provider === "paystack" && <p className="seven-muted">Online payment has not been verified. Use Verify payment to check the provider directly; cancellation is paused while this checkout is unresolved.</p>}
            {item.refund_status && ["pending", "processing"].includes(item.refund_status) && <p className="seven-status notice">Refund status: {readable(item.refund_status)}. This reservation remains paid until Paystack confirms completion.</p>}
            {item.payment_status === "paid" && item.payment_provider === "cash_at_property" && <p className="seven-muted">A cash payment is recorded. Contact the property to complete and record any refund before cancelling.</p>}
          </article>)
        }
        <div className="seven-status notice">Online payment requires PAYSTACK_SECRET_KEY on the server. Payments are verified server-side; refunds remain pending until Paystack confirms completion. Cash refunds must be recorded by the property.</div>
      </>}

      {tab === "partner" && <>
        <div className="seven-section-title">Hotel partner workspace</div><p className="seven-muted">Register your property, publish real rooms and manage incoming reservation requests. Submitted information is not automatically verified.</p>
        {user?.role === "admin" && <section className="seven-card"><h3>Property verification queue</h3><p className="seven-muted">Review submitted address, contact details and coordinates before marking a property verified. Verification enables distance ranking only when coordinates are present.</p>{!reviewProperties.length ? <p className="seven-muted">No pending properties.</p> : reviewProperties.map(item => <div className="seven-room" key={item.id}><strong>{item.name}</strong><div className="seven-muted">{item.address}, {item.city}</div><div className="seven-meta"><span>{item.contact_name || "No contact name"}</span><span>{item.contact_phone || "No phone"}</span><span>{item.contact_email || "No email"}</span><span>{item.latitude == null ? "No coordinates" : item.latitude + ", " + item.longitude}</span></div><div className="seven-actions"><button className="seven-secondary" disabled={busy} onClick={() => reviewProperty(item.id, "verified")}>Verify property</button><button className="seven-secondary" disabled={busy} onClick={() => reviewProperty(item.id, "rejected")}>Reject</button></div></div>)}</section>}
        {!token ? <div className="seven-empty"><Hotel size={24} /><p>Sign in or create a 7even account to register and manage a property.</p><button className="seven-primary" onClick={() => { setShowAccount(true); setAuthMode("register"); }}>Create partner account</button></div> : <>
          <form className="seven-card" onSubmit={createProperty}><h3>Register a property</h3>
            {field("Hotel / property name", "seven-property-name", propertyForm.name, value => setPropertyForm(v => ({ ...v, name: value })), { required: true, maxLength: 160 })}
            <label className="seven-field" htmlFor="seven-property-type"><span>Property type</span><select id="seven-property-type" value={propertyForm.propertyType} onChange={e => setPropertyForm(v => ({ ...v, propertyType: e.target.value }))}><option value="hotel">Hotel</option><option value="guesthouse">Guesthouse</option><option value="short_stay">Short stay</option><option value="other">Other</option></select></label>
            {field("Full street address", "seven-property-address", propertyForm.address, value => setPropertyForm(v => ({ ...v, address: value })), { required: true, maxLength: 500 })}
            <div className="seven-grid">
              {field("City", "seven-property-city", propertyForm.city, value => setPropertyForm(v => ({ ...v, city: value })), { required: true, maxLength: 80 })}
              {field("Contact person", "seven-contact-name", propertyForm.contactName, value => setPropertyForm(v => ({ ...v, contactName: value })), { maxLength: 240 })}
              {field("Contact phone", "seven-contact-phone", propertyForm.contactPhone, value => setPropertyForm(v => ({ ...v, contactPhone: value })), { type: "tel", maxLength: 240 })}
              {field("Contact email", "seven-contact-email", propertyForm.contactEmail, value => setPropertyForm(v => ({ ...v, contactEmail: value })), { type: "email", maxLength: 240 })}
              {field("Website URL", "seven-website", propertyForm.websiteUrl, value => setPropertyForm(v => ({ ...v, websiteUrl: value })), { type: "url", placeholder: "https://", maxLength: 240 })}
              {field("Latitude (optional)", "seven-property-lat", propertyForm.latitude, value => setPropertyForm(v => ({ ...v, latitude: value })), { type: "number", step: "any", min: -90, max: 90 })}
              {field("Longitude (optional)", "seven-property-lng", propertyForm.longitude, value => setPropertyForm(v => ({ ...v, longitude: value })), { type: "number", step: "any", min: -180, max: 180 })}
            </div>
            <label className="seven-field" htmlFor="seven-property-description"><span>Description</span><textarea id="seven-property-description" value={propertyForm.description} onChange={e => setPropertyForm(v => ({ ...v, description: e.target.value }))} maxLength={2000} placeholder="Describe the facilities and experience" /></label>
            <button className="seven-primary" disabled={busy} type="submit">Register property <ArrowRight size={15} /></button>
          </form>
          <section className="seven-card"><h3>Your properties</h3>{!properties.length ? <p className="seven-muted">No active properties on this account yet.</p> : <label className="seven-field" htmlFor="seven-select-property"><span>Select property</span><select id="seven-select-property" value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}><option value="">Choose property</option>{properties.map(property => <option key={property.id} value={property.id}>{property.name} · {readable(property.verification_status)}</option>)}</select></label>}{selectedPropertyId && <div className="seven-status notice">Property selected. Location and identity verification are separate from listing creation.</div>}</section>
          {selectedPropertyId && <>
            <form className="seven-card" onSubmit={createRoom}><h3>Add a room</h3>
              {field("Room / unit name", "seven-room-name", roomForm.name, value => setRoomForm(v => ({ ...v, name: value })), { required: true, maxLength: 160, placeholder: "Standard room, Deluxe room…" })}
              {field("Room description", "seven-room-description", roomForm.description, value => setRoomForm(v => ({ ...v, description: value })), { maxLength: 2000 })}
              <div className="seven-grid">{field("Maximum guests", "seven-room-capacity", roomForm.capacity, value => setRoomForm(v => ({ ...v, capacity: value })), { type: "number", min: 1, max: 20, required: true })}{field("Units in inventory", "seven-room-inventory", roomForm.inventoryCount, value => setRoomForm(v => ({ ...v, inventoryCount: value })), { type: "number", min: 1, required: true })}{field("Price in naira", "seven-room-price", roomForm.priceNaira, value => setRoomForm(v => ({ ...v, priceNaira: value })), { type: "number", min: 0, step: 100, required: true })}<label className="seven-field" htmlFor="seven-room-pricing"><span>Rate applies</span><select id="seven-room-pricing" value={roomForm.pricingUnit} onChange={e => setRoomForm(v => ({ ...v, pricingUnit: e.target.value }))}><option value="per_night">Per night</option><option value="per_booking">Per booking</option><option value="per_person">Per person</option></select></label></div>
              <button className="seven-primary" disabled={busy} type="submit">Add room to inventory <ArrowRight size={15} /></button>
            </form>
            <section className="seven-card"><h3>Room inventory</h3>{!rooms.length ? <p className="seven-muted">No rooms added yet.</p> : rooms.map(room => <div className="seven-room" key={room.id}><strong>{room.name}</strong><div className="seven-muted">{room.capacity} guests · {room.inventory_count} units</div><div className="seven-price">{money(room.price_minor, room.currency)} <small>{readable(room.pricing_unit)}</small></div></div>)}</section>
            <section className="seven-card"><h3>Incoming reservations</h3>{!partnerReservations.length ? <p className="seven-muted">No reservations for this property yet.</p> : partnerReservations.map(item => <div className="seven-room" key={item.id}><div className="seven-result-head"><div><strong>{item.resource_name}</strong><div className="seven-muted">{new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleDateString()}</div></div><span className="seven-chip">{readable(item.status)}</span></div><div className="seven-meta"><span>{item.guest_count} guests</span><span>{money(item.price_minor, item.currency)}</span></div>{item.status === "pending" && <button className="seven-primary" disabled={busy} type="button" onClick={() => confirmReservation(selectedPropertyId, item.id)}><CheckCircle2 size={14} /> Confirm reservation</button>}{item.payment_provider === "cash_at_property" && item.payment_record_status === "pending" && <><button className="seven-secondary" disabled={busy} type="button" onClick={() => reconcileCashPayment(selectedPropertyId, item.id, item.payment_id, "succeeded")}>Mark cash received</button><button className="seven-secondary" disabled={busy} type="button" onClick={() => reconcileCashPayment(selectedPropertyId, item.id, item.payment_id, "failed")}>Mark not received</button></>}{item.payment_status === "paid" && item.payment_provider === "cash_at_property" && item.payment_record_status === "succeeded" && <button className="seven-secondary" disabled={busy} type="button" onClick={() => reconcileCashRefund(selectedPropertyId, item.id, item.payment_id)}>Record completed cash refund</button>}</div>)}</section>
          </>}
        </>}
      </>}
      <div className="seven-footer">Respect traveller intent first. Optimize the decision second.</div>
    </div>
  );
}

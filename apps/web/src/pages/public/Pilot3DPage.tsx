import { ArrowDownRight, BedDouble, Compass, LocateFixed, MapPin, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../../components/ui.tsx';
import { stayDatesError } from '../../lib/datePicker.ts';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';
import './Pilot3DPage.css';

export function Pilot3DPage() {
  const navigate = useNavigate();
  const { showError } = useFeedback();
  const [searching, setSearching] = useState(false);
  const [destination, setDestination] = useState('Uyo, Akwa Ibom');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [budget, setBudget] = useState('80000');
  const [guests, setGuests] = useState('2');

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching) return;
    const dateError = stayDatesError(checkIn, checkOut);
    if (dateError) { showError(dateError); return; }
    const query = new URLSearchParams({ kind: 'STAY', city: destination.trim() });
    if (checkIn) query.set('startDate', checkIn);
    if (checkOut) query.set('endDate', checkOut);
    if (budget.trim() && Number.isFinite(Number(budget))) query.set('maxBaseTotalMinor', String(Math.round(Number(budget) * 100)));
    query.set('rooms', guests);
    setSearching(true);
    window.setTimeout(() => navigate(`/explore?${query.toString()}`), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650);
  }

  return (
    <div className="public-page pilot3d-page">
      <PublicHeader />
      <main id="main-content">
        <section className="pilot3d-hero public-container">
          <div className="pilot3d-copy">
            <span className="public-eyebrow"><Sparkles size={14} aria-hidden="true" /> 7even × āprən · virtual pilot</span>
            <h1>Your next stay.<br /><em>In a new dimension.</em></h1>
            <p>Explore stays through a living 3D-inspired travel space. Search stays, compare verified details, and book with confidence.</p>
            <div className="pilot3d-trust"><span><LocateFixed size={16} /> Location-led discovery</span><span><BedDouble size={16} /> Hotel-first booking</span></div>
          </div>
          <div className={`pilot3d-world ${searching ? "is-searching" : ""}`} role="img" aria-label="Interactive 3D-inspired destination map preview. Search to see available verified stays.">
            <div className="pilot3d-world-grid" />
            <div className="pilot3d-route route-one" />
            <div className="pilot3d-route route-two" />
            <div className="pilot3d-block block-one"><span /></div>
            <div className="pilot3d-block block-two"><span /></div>
            <div className="pilot3d-block block-three"><span /></div>
            <div className="pilot3d-pin pin-one"><MapPin size={18} /><span>Destination</span></div>
            <div className="pilot3d-pin pin-two"><BedDouble size={18} /><span>Verified stays only</span></div>
            <div className="pilot3d-avatar" aria-hidden="true"><div className="avatar-shadow" /><div className="avatar-body"><i /><b /><span /></div></div>
            <div className="pilot3d-map-caption"><span className="pilot3d-live-dot" /> 3D world preview <small>Live hotel data appears after search</small></div>
            <div className="pilot3d-compass"><Compass size={18} /></div>
          </div>
        </section>
        <section className="pilot3d-search-wrap public-container" aria-label="Search hotel stays">
          <form className="pilot3d-search" onSubmit={submitSearch}>
            <label className="pilot3d-input destination-input"><span>Where to?</span><input value={destination} onChange={event => setDestination(event.target.value)} placeholder="City, area or hotel" required maxLength={120} /></label>
            <label className="pilot3d-input"><span>Check in</span><input type="date" value={checkIn} onChange={event => setCheckIn(event.target.value)} /></label>
            <label className="pilot3d-input"><span>Check out</span><input type="date" min={checkIn || undefined} value={checkOut} onChange={event => setCheckOut(event.target.value)} /></label>
            <label className="pilot3d-input"><span>Total stay budget (₦)</span><input inputMode="numeric" type="number" min="0" step="1000" value={budget} onChange={event => setBudget(event.target.value)} /></label>
            <label className="pilot3d-input"><span>Rooms</span><select value={guests} onChange={event => setGuests(event.target.value)}><option value="1">1 room</option><option value="2">2 rooms</option><option value="3">3 rooms</option><option value="4">4 rooms</option><option value="5">5+ rooms</option></select></label>
            <button className="btn btn-primary pilot3d-submit" type="submit" disabled={searching}><Search size={18} /> {searching ? "Finding stays…" : "Explore stays"} <ArrowDownRight size={17} /></button>
          </form>
          <p className="pilot3d-search-note" aria-live="polite">{searching ? "Your guide is heading out to find stays… " : ""}Search results use 7even's existing discovery flow. A listing is not bookable unless its availability and rate are confirmed.</p>
        </section>
        <section className="pilot3d-journey public-container">
          <div><span className="public-eyebrow">The experience we’re building</span><h2>Move through the stay,<br /><em>not just a list.</em></h2></div>
          <div className="pilot3d-steps">
            <article><span>01</span><h3>Explore the map</h3><p>Your guide moves through the destination as you search. Hotel pins will only represent sourced, verified properties.</p></article>
            <article><span>02</span><h3>Step into the lobby</h3><p>Preview hotel and room spaces built from partner-approved photos, videos, address and property details.</p></article>
            <article><span>03</span><h3>Confirm your stay</h3><p>Review the actual room terms, current rate and cancellation policy before any real payment flow is enabled.</p></article>
          </div>
        </section>
        <section className="pilot3d-safety public-container"><div><Sparkles size={18} /><strong>Virtual pilot · safe by design</strong></div><p>This is the first visual layer, not a live 3D map or payment confirmation. No sample hotel pins, room inventory, prices, or successful-payment animation are fabricated. Those interactions will be connected after verified inventory, partner assets and sandbox checkout are ready.</p></section>
      </main>
      <PublicFooter />
    </div>
  );
}

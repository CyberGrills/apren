import { ArrowLeft, ArrowRight, Check, ChevronRight, CreditCard, MapPin, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader, addDays, friendlyDate, localDateNow } from './PublicShell.tsx';

type Stage = 'search' | 'property' | 'room' | 'details' | 'summary' | 'checkout' | 'confirmed';
const rooms = [
  { id: 'courtyard', name: 'Courtyard King', detail: 'King bed · 2 guests · 32 m²', price: 85000, image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1100&q=82' },
  { id: 'garden', name: 'Garden Suite', detail: 'King bed · 2 guests · 48 m²', price: 125000, image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1100&q=82' },
] as const;
const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
const makeReference = () => `7D-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export function DemoStayPage() {
  const [stage, setStage] = useState<Stage>('search');
  const [arrival, setArrival] = useState(addDays(localDateNow(), 14));
  const [departure, setDeparture] = useState(addDays(localDateNow(), 16));
  const [guests, setGuests] = useState('2');
  const [roomId, setRoomId] = useState<(typeof rooms)[number]['id']>('courtyard');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [reference, setReference] = useState('');
  const [checkoutAcknowledged, setCheckoutAcknowledged] = useState(false);
  const selectedRoom = rooms.find((room) => room.id === roomId) ?? rooms[0];
  const nights = useMemo(() => Math.max(1, Math.round((Date.parse(departure) - Date.parse(arrival)) / 86400000)), [arrival, departure]);
  const subtotal = selectedRoom.price * nights;
  const serviceFee = Math.round(subtotal * 0.05);
  const total = subtotal + serviceFee;
  const validDates = arrival >= localDateNow() && departure > arrival;
  const steps: Stage[] = ['search', 'property', 'room', 'details', 'summary', 'checkout', 'confirmed'];
  const stepLabels = ['Search', 'Stay', 'Room', 'Guest', 'Review', 'Checkout', 'Done'];
  const stepIndex = steps.indexOf(stage);
  function completeDemo() {
    if (!checkoutAcknowledged) return;
    setReference(makeReference());
    setStage('confirmed');
  }
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="public-container demo-stay-page" id="main-content">
        <div className="demo-stay-topline">
          <Link to="/" className="public-text-link"><ArrowLeft size={16} /> Back to 7even</Link>
          <span className="demo-only-pill">DEMO ONLY · NO REAL BOOKING</span>
        </div>
        <div className="demo-progress" aria-label={`Step ${stepIndex + 1} of 7: ${stepLabels[stepIndex]}`}>
          {stepLabels.map((label, index) => <div className={index <= stepIndex ? 'is-current' : ''} key={label}><span>{index < stepIndex ? <Check size={12} /> : index + 1}</span><small>{label}</small></div>)}
        </div>
        {stage === 'search' && <section className="demo-intro">
          <span className="public-eyebrow">A guided preview of booking on 7even</span>
          <h1>Find your next<br /><em>good stay.</em></h1>
          <p>Explore a sample property and walk through a complete booking journey. Every property detail and price on this page is illustrative.</p>
          <form className="demo-search-panel" onSubmit={(event) => { event.preventDefault(); if (validDates) setStage('property'); }}>
            <label>Destination<input value="Uyo, Akwa Ibom" readOnly /></label>
            <label>Check in<input type="date" min={localDateNow()} value={arrival} onChange={(event) => setArrival(event.target.value)} required /></label>
            <label>Check out<input type="date" min={addDays(arrival, 1)} value={departure} onChange={(event) => setDeparture(event.target.value)} required /></label>
            <label>Guests<select value={guests} onChange={(event) => setGuests(event.target.value)}><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option></select></label>
            <button className="btn btn-primary" type="submit" disabled={!validDates}>Explore demo stay <ArrowRight size={17} /></button>
          </form>
          {!validDates && <p className="demo-validation" role="alert">Choose a check-out date after check-in and a check-in date that is not in the past.</p>}
          <div className="demo-disclosure"><ShieldCheck size={18} /><p><strong>Safe to explore.</strong> This preview does not connect to live hotel inventory, reserve a room, or collect payment details.</p></div>
        </section>}
        {stage === 'property' && <section className="demo-property">
          <div className="demo-property-heading"><div><span className="public-eyebrow">Uyo · Akwa Ibom State</span><h1>The Seven Courtyard</h1><p><MapPin size={15} /> A fictional demonstration property in Uyo, Nigeria</p></div><span className="demo-only-pill">DEMO PROPERTY</span></div>
          <div className="demo-gallery"><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1500&q=85" alt="Illustrative contemporary hotel courtyard" /><img src="https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82" alt="Illustrative hotel suite" /><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82" alt="Illustrative hotel lounge" /></div>
          <div className="demo-property-columns"><div><h2>A slower kind of stay.</h2><p>The Seven Courtyard is a fictional property created to demonstrate how guests can discover a stay, compare rooms and review booking details on 7even. The photographs are editorial illustrations and do not depict a verified hotel.</p><div className="demo-amenities"><span>Quiet courtyard</span><span>Breakfast lounge</span><span>Fast Wi-Fi</span><span>24-hour front desk</span></div></div><aside className="demo-side-card"><span className="public-eyebrow">Your selected dates</span><strong>{friendlyDate(arrival)} – {friendlyDate(departure)}</strong><span>{nights} nights · {guests} guests</span><button className="btn btn-primary" onClick={() => setStage('room')}>Choose a room <ArrowRight size={16} /></button></aside></div>
        </section>}
        {stage === 'room' && <section className="demo-flow-section"><span className="public-eyebrow">The Seven Courtyard · Demo rooms</span><h1>Choose your <em>room.</em></h1><p className="demo-muted">Illustrative rates only. No room is being held or reserved.</p><div className="demo-room-list">{rooms.map((room) => <article className={roomId === room.id ? 'demo-room-card selected' : 'demo-room-card'} key={room.id}><img src={room.image} alt={`Illustrative ${room.name}`} /><div><h2>{room.name}</h2><p>{room.detail}</p><strong>{money(room.price)} <small>/ night · demo rate</small></strong><button className={roomId === room.id ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setRoomId(room.id)} aria-pressed={roomId === room.id}>{roomId === room.id ? 'Selected' : 'Select room'}</button></div></article>)}</div><div className="demo-actions"><button className="btn btn-secondary" onClick={() => setStage('property')}>Back</button><button className="btn btn-primary" onClick={() => setStage('details')}>Continue <ArrowRight size={16} /></button></div></section>}
        {stage === 'details' && <section className="demo-flow-section demo-narrow"><span className="public-eyebrow">Guest details</span><h1>Who’s <em>travelling?</em></h1><p className="demo-muted">Use fictional details if you prefer. This information stays in this browser session and is not submitted to a hotel.</p><form className="demo-guest-form" onSubmit={(event) => { event.preventDefault(); setStage('summary'); }}><label>Guest name<input autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} required maxLength={100} /></label><label>Email address<input type="email" autoComplete="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} required maxLength={160} /></label><div className="demo-actions"><button type="button" className="btn btn-secondary" onClick={() => setStage('room')}>Back</button><button className="btn btn-primary" type="submit">Review booking <ArrowRight size={16} /></button></div></form></section>}
        {stage === 'summary' && <section className="demo-flow-section demo-narrow"><span className="public-eyebrow">Booking summary</span><h1>Take a final <em>look.</em></h1><div className="demo-summary-card"><div className="demo-summary-title"><div><span className="public-eyebrow">DEMO PROPERTY</span><h2>The Seven Courtyard</h2><p>Uyo, Akwa Ibom State</p></div><span className="demo-only-pill">NOT BOOKABLE</span></div><dl><div><dt>Room</dt><dd>{selectedRoom.name}</dd></div><div><dt>Guest</dt><dd>{guestName}</dd></div><div><dt>Dates</dt><dd>{friendlyDate(arrival)} – {friendlyDate(departure)}</dd></div><div><dt>Stay</dt><dd>{nights} nights · {guests} guests</dd></div><div><dt>{money(selectedRoom.price)} × {nights} nights</dt><dd>{money(subtotal)}</dd></div><div><dt>Demo service fee (5%)</dt><dd>{money(serviceFee)}</dd></div><div className="demo-total"><dt>Illustrative total</dt><dd>{money(total)}</dd></div></dl><p className="demo-disclaimer">This is a demonstration quote, not a hotel offer or amount payable. Taxes and actual hotel terms are not represented.</p></div><div className="demo-actions"><button className="btn btn-secondary" onClick={() => setStage('details')}>Back</button><button className="btn btn-primary" onClick={() => setStage('checkout')}>Continue to demo checkout <ArrowRight size={16} /></button></div></section>}
        {stage === 'checkout' && <section className="demo-flow-section demo-narrow"><span className="public-eyebrow">Simulated checkout</span><h1>See how checkout <em>works.</em></h1><div className="demo-checkout-panel"><CreditCard size={28} /><h2>No card details needed.</h2><p>This is a safe simulation. No payment provider is contacted, no money is collected and no hotel reservation is created.</p><label className="demo-check-row"><input type="checkbox" checked={checkoutAcknowledged} onChange={(event) => setCheckoutAcknowledged(event.target.checked)} /> I understand this is a demo transaction and no money will be collected.</label><button className="btn btn-primary" disabled={!checkoutAcknowledged} onClick={completeDemo}>Simulate demo checkout <ArrowRight size={16} /></button><p className="demo-disclaimer">Transaction status: DEMO ONLY · NOT PAID</p></div><div className="demo-actions"><button className="btn btn-secondary" onClick={() => setStage('summary')}>Back to summary</button></div></section>}
        {stage === 'confirmed' && <section className="demo-flow-section demo-narrow demo-confirmed"><span className="demo-confirm-icon"><Check size={30} /></span><span className="public-eyebrow">Demo journey complete</span><h1>That’s the <em>journey.</em></h1><p>Your simulated checkout has completed. This is not a real reservation and no payment was made.</p><div className="demo-receipt"><div className="demo-receipt-head"><span>7EVEN · DEMO RECEIPT</span><strong>NOT A PAYMENT RECEIPT</strong></div><h2>The Seven Courtyard</h2><p>Uyo, Akwa Ibom State · Fictional demo property</p><dl><div><dt>Demo reference</dt><dd>{reference}</dd></div><div><dt>Guest</dt><dd>{guestName}</dd></div><div><dt>Email</dt><dd>{guestEmail}</dd></div><div><dt>Room</dt><dd>{selectedRoom.name}</dd></div><div><dt>Dates</dt><dd>{friendlyDate(arrival)} – {friendlyDate(departure)}</dd></div><div><dt>Guests</dt><dd>{guests}</dd></div><div><dt>Illustrative total</dt><dd>{money(total)}</dd></div><div><dt>Transaction</dt><dd>Demo transaction — no money collected</dd></div><div><dt>Payment status</dt><dd>NOT PAID · SIMULATED</dd></div></dl><p className="demo-disclaimer">This demo receipt is for product demonstration only. It cannot be used to claim payment, check in, or access a real hotel.</p></div><button className="btn btn-primary" onClick={() => { setStage('search'); setGuestName(''); setGuestEmail(''); setReference(''); setCheckoutAcknowledged(false); }}>Start another demo journey <ChevronRight size={16} /></button></section>}
      </main>
      <PublicFooter />
    </div>
  );
}

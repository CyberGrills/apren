import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, MapPin, Utensils, Music2, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

const officialSite = 'https://ibomfest.akwaibomstate.gov.ng/';
const officialSchedule = 'https://ibomfest.akwaibomstate.gov.ng/schedule';

const highlights = [
  { date: '30 NOV', title: 'Opening Ceremony', detail: 'Carnival Street Party and the unveiling of Ibom Kitchen. 4:00–7:00 PM, according to the published programme.' },
  { date: '06 DEC', title: 'Ibom Air Day', detail: 'A festival day celebrating Ibom Air and the people who connect Akwa Ibom to the world.' },
  { date: '18 DEC', title: 'Akwa Ibom Christmas Carols Festival', detail: 'Peace on Earth, Goodwill to Men · Amphitheatre, Unity Park.' },
  { date: '20 DEC', title: 'Mbopo Akwa Ibom', detail: 'The 31-LGA cultural pageant · Arise Palm Banquet Hall, Brooks Street, Uyo.' },
  { date: '31 DEC', title: 'Cross-Over Service', detail: 'Welcome the new year with the festival community at Unity Park.' },
];

export function ChristmasUnpluggedPage() {
  return (
    <div className="public-page christmas-page">
      <PublicHeader />
      <main id="main-content">
        <section className="christmas-hero" aria-labelledby="christmas-title">
          <div className="public-container christmas-hero-inner">
            <Link className="christmas-back" to="/explore"><ArrowLeft size={16} aria-hidden="true" /> Back to explore</Link>
            <p className="public-eyebrow">7EVEN · SEASONAL EXPERIENCE · UYO, AKWA IBOM</p>
            <p className="christmas-edition">EDITION 04</p>
            <h1 id="christmas-title">Christmas <em>Unplugged.</em></h1>
            <p className="christmas-subtitle">Taste of Akwa Ibom: Our Food, Culture and Heritage.</p>
            <div className="christmas-meta">
              <span><CalendarDays size={17} aria-hidden="true" /> 30 November 2026 – 1 January 2027</span>
              <span><MapPin size={17} aria-hidden="true" /> Unity Park, Uyo, Akwa Ibom</span>
              <span>Free entry · organiser-published information</span>
            </div>
            <div className="christmas-hero-actions">
              <a className="btn btn-primary" href={officialSchedule} target="_blank" rel="noopener noreferrer">See official programme <ExternalLink size={16} aria-hidden="true" /></a>
              <Link className="btn btn-secondary" to="/explore?kind=STAY&state=Akwa%20Ibom&city=Uyo">Explore stays in Uyo <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <p className="christmas-disclosure">7EVEN is independently featuring this public event for discovery. This page does not imply an official partnership, ticketing relationship or endorsement.</p>
          </div>
        </section>

        <section className="christmas-intro public-container" aria-labelledby="christmas-intro-title">
          <div>
            <p className="public-eyebrow">A state-wide celebration</p>
            <h2 id="christmas-intro-title">One destination. Thirty-one local stories.</h2>
          </div>
          <div className="christmas-intro-copy">
            <p>Across 33 festive days, the festival brings together the food, music, dance, crafts and cultural heritage of Akwa Ibom’s 31 local government areas.</p>
            <p>Explore the programme before you go. Dates and details can change, so the organisers’ website remains the source of truth for the latest schedule and visitor information.</p>
            <a className="christmas-text-link" href={officialSite} target="_blank" rel="noopener noreferrer">Visit the official festival website <ExternalLink size={15} aria-hidden="true" /></a>
          </div>
        </section>

        <section className="christmas-highlights" aria-labelledby="christmas-highlights-title">
          <div className="public-container">
            <div className="christmas-section-heading">
              <div><p className="public-eyebrow">Save the dates</p><h2 id="christmas-highlights-title">Festival highlights</h2></div>
              <a className="christmas-text-link" href={officialSchedule} target="_blank" rel="noopener noreferrer">Full programme <ExternalLink size={15} aria-hidden="true" /></a>
            </div>
            <div className="christmas-event-grid">
              {highlights.map((event) => (
                <article className="christmas-event-card" key={event.title}>
                  <span className="christmas-event-date">{event.date}</span>
                  <h3>{event.title}</h3>
                  <p>{event.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="christmas-discover public-container" aria-label="Explore Akwa Ibom">
          <article><Utensils size={22} aria-hidden="true" /><p className="public-eyebrow">Ibom Kitchen</p><h2>Come hungry for local flavour.</h2><p>Discover the festival’s food showcase and the dishes presented by communities across the state.</p><a href={officialSite} target="_blank" rel="noopener noreferrer">Explore festival food <ExternalLink size={14} aria-hidden="true" /></a></article>
          <article><Landmark size={22} aria-hidden="true" /><p className="public-eyebrow">Culture & heritage</p><h2>Meet the stories behind the celebration.</h2><p>Explore cultural showcases, crafts, traditions and the 31-LGA programme.</p><a href={officialSite} target="_blank" rel="noopener noreferrer">Explore LGA showcases <ExternalLink size={14} aria-hidden="true" /></a></article>
          <article><Music2 size={22} aria-hidden="true" /><p className="public-eyebrow">Music & events</p><h2>Find your day at the festival.</h2><p>Check flagship events, carols, performances and programme updates.</p><a href={officialSchedule} target="_blank" rel="noopener noreferrer">Browse the schedule <ExternalLink size={14} aria-hidden="true" /></a></article>
        </section>

        <section className="christmas-plan" aria-labelledby="christmas-plan-title">
          <div className="public-container christmas-plan-inner">
            <div><p className="public-eyebrow">Make a trip of it</p><h2 id="christmas-plan-title">Stay a little longer in Uyo.</h2><p>Browse 7EVEN for published stays and dining listings. Availability, prices and booking status are shown only when supplied and confirmed by the relevant business.</p></div>
            <div className="christmas-plan-actions">
              <Link className="btn btn-primary" to="/explore?kind=STAY&state=Akwa%20Ibom&city=Uyo">Find a stay <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link className="btn btn-secondary" to="/explore?kind=DINING&state=Akwa%20Ibom&city=Uyo">Explore dining</Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

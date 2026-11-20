import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, MapPin, Utensils, Music2, Landmark, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

const officialSite = 'https://ibomfest.akwaibomstate.gov.ng/';
const officialSchedule = 'https://ibomfest.akwaibomstate.gov.ng/schedule';

const lgaShowcases = [
  { name: 'Ika', date: 'Tue 1 Dec 2026', dishes: ['Mkpafeere', 'Ichichop Ntokajen', 'Atama', 'Ubobok Ukom'] },
  { name: 'Uyo', date: 'Wed 2 Dec 2026', dishes: ['Ubeed', 'Afia Efere Ebod ye Iyak', 'Afang ye Fufu', 'Usung Ikpong ye Efere Ibaba'] },
  { name: 'Ikot Ekpene', date: 'Thu 3 Dec 2026', dishes: ['Ubo Akpapa', 'Ubo Ndiyong', 'Afere Afang', 'Afere Atama Abak'] },
  { name: 'Nsit Ibom', date: 'Fri 4 Dec 2026', dishes: ['Editan Ibat', 'Atama Abak', 'Etidod ye Fufu'] },
  { name: 'Oron', date: 'Sat 5 Dec 2026', dishes: ['Otong ma Iwe Ekpang', "Fisherman's Soup", 'Efere Ibaba ma Fufu'] },
  { name: 'ONNA', date: 'Sun 6 Dec 2026', dishes: ['Efere Usung', 'Ntimme Abakpa', 'Efere Afang', 'Edikang Ikong'] },
  { name: 'Ini', date: 'Mon 7 Dec 2026', dishes: ['Nsana Soup', 'Ndise Soup', 'Mkpafeere Soup ye Usung Iwa', 'Iwuk Edesi'] },
  { name: 'Ibesikpo Asutan', date: 'Tue 8 Dec 2026', dishes: ['Ubo Nkong', 'Akara Iwa', 'Efere Atama', 'Efere Editan'] },
  { name: 'Eastern Obolo', date: 'Wed 9 Dec 2026', dishes: ['Grogro Soup', 'Usum Uka', "Fisherman's Soup"] },
  { name: 'Mbo', date: 'Thu 10 Dec 2026', dishes: ['Okime ma Owieng', 'Efere Ndek Ayak ma Fufu', 'Afang'] },
  { name: 'Nsit Atai', date: 'Fri 11 Dec 2026', dishes: ['Akume ye Anem', 'Afere Ibaba', 'Efere Atama'] },
  { name: 'Ikono', date: 'Sat 12 Dec 2026', dishes: ['Efere Nsana ye Mkpafeere', 'Ekpang Nkukwo', 'Afere Akananwan'] },
  { name: 'Essien Udim', date: 'Sun 13 Dec 2026', dishes: ['Efere Mkpafeere', 'Ekpang Nkukwo', 'Efere Abak Atama'] },
  { name: 'Ibiono Ibom', date: 'Mon 14 Dec 2026', dishes: ['Asa Abakpa', 'Efere Nyama', 'MTN Rice / Iwuk Edesi', 'Efere Editan'] },
  { name: 'Mkpat Enin', date: 'Tue 15 Dec 2026', dishes: ['Ubobok Ukom', 'Ototok Mboro', 'Afere Editan', 'Afere Atama'] },
  { name: 'Ikot Abasi', date: 'Wed 16 Dec 2026', dishes: ['Nyama Idim', 'Afere Mmakrak', "Fisherman's Soup"] },
  { name: 'Nsit Ubium', date: 'Thu 17 Dec 2026', dishes: ['Abek Akpapa', 'Oto-Iwa', 'Abak', 'Efere Atama'] },
  { name: 'Uruan', date: 'Sat 19 Dec 2026', dishes: ['Efere Nyama', "Fisherman's Soup", 'Ukwok Afang', 'Edikang Ikong'] },
  { name: 'Oruk Anam', date: 'Sun 20 Dec 2026', dishes: ['Afere Ibaba', 'Ubo Nkong Efere', 'Atama Abak'] },
  { name: 'Obot Akara', date: 'Mon 21 Dec 2026', dishes: ['Afere Ukpatörök', 'Ubo Akpakpa', 'Atong Ibat'] },
  { name: 'Ukanafun', date: 'Tue 22 Dec 2026', dishes: ['Ubo Nkong Efere', 'Afere Mkpafeere', 'Afere Ibaba'] },
  { name: 'Etinan', date: 'Wed 23 Dec 2026', dishes: ['Asa Iwa', 'Usung Ikpong ye Afia Efere', 'Efere Afang ye Fufu'] },
  { name: 'Esit Eket', date: 'Thu 24 Dec 2026', dishes: ['Efere Mmeme', "Fisherman's Soup"] },
  { name: 'Udung Uko', date: 'Thu 24 Dec 2026', dishes: ['Obu ma Atita Iwe', 'Iwekpang ma Otong'] },
  { name: 'Abak', date: 'Sat 26 Dec 2026', dishes: ['Imaha', 'Nyama Soup', 'Ubobok Ukom', 'Afere Abak'] },
  { name: 'Ibeno', date: 'Sun 27 Dec 2026', dishes: ['Afere Mbu Eyak', 'Afia Efere', "Fisherman's Soup"] },
  { name: 'Urue-Offong/Oruko', date: 'Mon 28 Dec 2026', dishes: ['Iwe Ekpang ma Otong', 'Oto Abre', "Fisherman's Soup"] },
  { name: 'Itu', date: 'Tue 29 Dec 2026', dishes: ['Mkpafeere', "Fisherman's Soup", 'Abak Atama'] },
  { name: 'Etim Ekpo', date: 'Wed 30 Dec 2026', dishes: ['Afere Afang', 'Ukad ye Local Sauce', 'Afere Editan'] },
  { name: 'Okobo', date: 'Thu 31 Dec 2026', dishes: ['Efre Otong', 'Efre Ibaba', 'Fisherman Soup'] },
  { name: 'Eket', date: 'Fri 1 Jan 2027', dishes: ['Efukabu', 'Akpafai Ntokon', 'Abak Nkong', 'Afere Ndakiyak'] },
];

const highlights = [
  { date: '30 NOV', title: 'Opening Ceremony', detail: 'Carnival Street Party and the unveiling of Ibom Kitchen. 4:00–7:00 PM, according to the published programme.' },
  { date: '06 DEC', title: 'Ibom Air Day', detail: 'A festival day celebrating Ibom Air and the people who connect Akwa Ibom to the world.' },
  { date: '18 DEC', title: 'Akwa Ibom Christmas Carols Festival', detail: 'Peace on Earth, Goodwill to Men · Amphitheatre, Unity Park.' },
  { date: '20 DEC', title: 'Mbopo Akwa Ibom', detail: 'The 31-LGA cultural pageant · Arise Palm Banquet Hall, Brooks Street, Uyo.' },
  { date: '31 DEC', title: 'Cross-Over Service', detail: 'Welcome the new year with the festival community at Unity Park.' },
];

export function ChristmasUnpluggedPage() {
  const [lgaSearch, setLgaSearch] = useState('');
  const filteredLgas = useMemo(() => {
    const query = lgaSearch.trim().toLocaleLowerCase();
    if (!query) return lgaShowcases;
    return lgaShowcases.filter((lga) =>
      lga.name.toLocaleLowerCase().includes(query) ||
      lga.dishes.some((dish) => dish.toLocaleLowerCase().includes(query))
    );
  }, [lgaSearch]);

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

        <section className="christmas-lga-section" aria-labelledby="christmas-lga-title">
          <div className="public-container">
            <div className="christmas-section-heading">
              <div>
                <p className="public-eyebrow">One LGA. One showcase.</p>
                <h2 id="christmas-lga-title">Explore all 31 local stories.</h2>
                <p className="christmas-lga-intro">Find your local government area, check its published showcase day and discover the dishes listed by the festival organisers.</p>
              </div>
              <a className="christmas-text-link" href="https://ibomfest.akwaibomstate.gov.ng/lgas" target="_blank" rel="noopener noreferrer">Official 31-LGA directory <ExternalLink size={15} aria-hidden="true" /></a>
            </div>
            <label className="christmas-lga-search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search local government areas or dishes</span>
              <input
                type="search"
                value={lgaSearch}
                onChange={(event) => setLgaSearch(event.target.value)}
                placeholder="Search an LGA or local dish"
                autoComplete="off"
              />
            </label>
            <p className="christmas-lga-count" aria-live="polite">Showing {filteredLgas.length} of 31 local government areas</p>
            {filteredLgas.length > 0 ? (
              <div className="christmas-lga-grid">
                {filteredLgas.map((lga) => (
                  <article className="christmas-lga-card" key={lga.name}>
                    <div className="christmas-lga-card-top">
                      <span className="christmas-lga-mark" aria-hidden="true">{lga.name.slice(0, 1)}</span>
                      <div>
                        <p className="christmas-lga-date">{lga.date}</p>
                        <h3>{lga.name}</h3>
                      </div>
                    </div>
                    <p className="christmas-lga-dishes-label">Festival-listed dishes</p>
                    <ul>{lga.dishes.map((dish) => <li key={dish}>{dish}</li>)}</ul>
                  </article>
                ))}
              </div>
            ) : (
              <div className="christmas-lga-empty" role="status">
                <p>No LGA or dish matches “{lgaSearch}”.</p>
                <button type="button" onClick={() => setLgaSearch('')}>Clear search</button>
              </div>
            )}
            <p className="christmas-lga-source">Dates and dish names are transcribed from the festival organiser’s published directory. The organiser’s page is the source of truth if the programme changes.</p>
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

import type { Offering } from '@7even/contracts';
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, OfferingCard } from '../../components/ui.tsx';
import { useSeason } from '../../context/SeasonContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { seasonalCampaigns } from '../../lib/seasonalCampaigns.ts';
import { editorialImages, localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';
import '../../styles/nigerian-localization.css';

type LanguageStyle = 'en' | 'pcm';
type StayPurpose = 'ANY' | 'COUPLES' | 'BUSINESS' | 'FAMILY' | 'SOFT_LIFE';

const purposeLabels: Record<StayPurpose, { en: string; pcm: string }> = {
  ANY: { en: 'Any kind of stay', pcm: 'Any kind stay' },
  COUPLES: { en: 'Couples / romantic', pcm: 'For two of una' },
  BUSINESS: { en: 'Business trip', pcm: 'Work trip' },
  FAMILY: { en: 'Family stay', pcm: 'Family time' },
  SOFT_LIFE: { en: 'Relaxation / soft life', pcm: 'Soft life and enjoyment' },
};

export function LandingPage() {
  const navigate = useNavigate();
  const campaign = seasonalCampaigns[useSeason()];
  const [language, setLanguage] = useState<LanguageStyle>(() => {
    try {
      return localStorage.getItem('7even-language-style') === 'pcm' ? 'pcm' : 'en';
    } catch {
      return 'en';
    }
  });
  const [city, setCity] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState<StayPurpose>('ANY');
  const [budget, setBudget] = useState('');
  const { data, loading, error, reload } = useApi<Offering[]>('/offerings?kind=STAY&pageSize=3');
  const pcm = language === 'pcm';

  function changeLanguage(next: LanguageStyle) {
    setLanguage(next);
    try {
      localStorage.setItem('7even-language-style', next);
    } catch {
      // Language switching still works when browser storage is unavailable.
    }
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams({ kind: 'STAY' });
    if (city.trim()) query.set('city', city.trim());
    if (date) query.set('startDate', date);
    if (endDate) query.set('endDate', endDate);
    if (purpose !== 'ANY') query.set('tripPurpose', purpose.toLowerCase());
    if (budget && Number.isFinite(Number(budget)) && Number(budget) > 0) {
      query.set('maxBudgetNaira', String(Math.round(Number(budget))));
    }
    navigate(`/explore?${query}`);
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content">
        <section className="public-container landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <div className="seven-language-switch" role="group" aria-label="Language style">
              <button type="button" aria-pressed={!pcm} className={!pcm ? 'active' : ''} onClick={() => changeLanguage('en')}>English</button>
              <button type="button" aria-pressed={pcm} className={pcm ? 'active' : ''} onClick={() => changeLanguage('pcm')}>Naija Pidgin</button>
            </div>
            <span className="public-eyebrow">{pcm ? 'Your next stay, we go sort am.' : 'Good stays. Nigeria first.'}</span>
            <span className="seasonal-campaign-label">{campaign.label}</span>
            <h1 id="landing-title">{pcm ? <>Where you wan <em>stay?</em></> : <>Find your kind of <em>stay.</em></>}</h1>
            <p>{pcm
              ? 'Weekend getaway, work trip, or small enjoyment? Find a place wey match your plan and budget.'
              : 'A weekend away, a work trip, or time to unwind. Find a place that fits your plans and budget.'}</p>
            <div className="landing-footnote">
              <span aria-hidden="true">07</span>
              <p>Your dates. Your budget.<br />Your kind of comfort.</p>
            </div>
          </div>
          <figure className="landing-hero-image">
            <img src={campaign.image.src} alt={campaign.image.alt} width={campaign.image.width} height={campaign.image.height} fetchPriority="high" />
            <figcaption><span>{campaign.image.caption}</span><span>{campaign.image.credit}</span></figcaption>
          </figure>
          <form className="landing-search seven-stay-search" onSubmit={search} aria-label={pcm ? 'Find hotel' : 'Find a stay'}>
            <div>
              <label htmlFor="home-city"><MapPin size={13} aria-hidden="true" /> {pcm ? 'Where you dey go?' : 'Destination'}</label>
              <input id="home-city" placeholder={pcm ? 'Lagos, Abuja, PH...' : 'City or neighbourhood'} value={city} onChange={(e) => setCity(e.target.value)} maxLength={160} />
            </div>
            <div>
              <label htmlFor="home-date"><CalendarDays size={13} aria-hidden="true" /> Check-in</label>
              <input id="home-date" type="date" min={localDateNow()} value={date} onChange={(e) => { setDate(e.target.value); if (endDate && endDate <= e.target.value) setEndDate(''); }} />
            </div>
            <div>
              <label htmlFor="home-end-date"><CalendarDays size={13} aria-hidden="true" /> Check-out</label>
              <input id="home-end-date" type="date" min={date || localDateNow()} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">{pcm ? 'Find my stay' : 'Find a stay'} <ArrowUpRight size={19} aria-hidden="true" /></button>
            <div className="seven-preference-row">
              <div>
                <label htmlFor="home-purpose">{pcm ? 'Wetin be the plan?' : 'What kind of trip?'}</label>
                <select id="home-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as StayPurpose)}>
                  {(Object.keys(purposeLabels) as StayPurpose[]).map((key) => <option value={key} key={key}>{purposeLabels[key][language]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="home-budget">{pcm ? 'Your budget per night (₦)' : 'Budget per night (₦)'}</label>
                <input id="home-budget" inputMode="numeric" type="number" min="1" step="1000" placeholder={pcm ? 'How much you wan spend?' : 'e.g. 50000'} value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
            </div>
          </form>
        </section>
        <section className="public-container landing-places" aria-labelledby="places-title">
          <div className="public-section-heading">
            <div><span className="public-eyebrow">{pcm ? 'Places wey fit your plan' : 'Places worth a look'}</span><h2 id="places-title">{pcm ? <>Make your next <br />stay count.</> : <>A good place <br />to call yours.</>}</h2></div>
            <div>
              <p>{pcm ? 'Real stays, clear prices, and room availability wey the hotel don confirm.' : 'Hotel stays with clear pricing and availability confirmed by the property.'}</p>
              <Link to="/explore?kind=STAY" className="public-text-link">{pcm ? 'See available stays' : 'Explore all stays'} <ArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>
          {loading && <Loading />}
          {error && <ErrorNotice message={error} retry={reload} />}
          {data && data.length > 0 && <div className="landing-offering-grid">{data.map((offering) => <OfferingCard key={offering.id} offering={offering} />)}</div>}
          {data?.length === 0 && <EmptyState title={pcm ? 'We never list available stays for here yet.' : 'No bookable stays are listed here yet.'} description={pcm ? 'We go show hotel rooms when the property don confirm price and availability. No guesswork.' : 'Hotels appear when the property has confirmed its rates and room availability.'} action={<Link className="btn btn-secondary" to="/business/apply">{pcm ? 'You manage a hotel? Join 7even' : 'List your hotel on 7even'}</Link>} />}
        </section>
        <section className="landing-editorial" aria-labelledby="local-title">
          <div className="public-container landing-editorial-grid">
            <figure><img src={editorialImages.beach} alt="Visitors enjoying the coast in Nigeria." width="1000" height="1200" loading="lazy" /><figcaption>Explore closer to home · Editorial photograph</figcaption></figure>
            <div>
              <span className="public-eyebrow">{pcm ? 'Your city, your pace' : 'Make room for yourself'}</span>
              <h2 id="local-title">{pcm ? <>Small escape. <br /><em>Big enjoyment.</em></> : <>A change of scene. <br /><em>Close to home.</em></>}</h2>
              <p>{pcm ? 'From Lagos weekends to Abuja work trips and Port Harcourt staycations, choose the area, comfort and price wey work for you.' : 'From Lagos weekends to Abuja work trips and Port Harcourt staycations, choose the location, comfort and price that work for you.'}</p>
              <Link to="/explore?kind=STAY" className="public-text-link">{pcm ? 'Find your next stay' : 'Explore hotel stays'} <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <div className="landing-local-note">
                <span className="public-eyebrow">{pcm ? 'Your choice comes first' : 'Your preferences come first'}</span>
                <p>{pcm ? 'Choose your budget, dates and the kind of trip. We go use am to narrow the options, but na confirmed hotel details go decide wetin you fit book.' : 'Choose your budget, dates and trip purpose. Recommendations can narrow the options, but confirmed hotel details determine what you can book.'}</p>
                <Link to="/explore?kind=STAY">{pcm ? 'Personalise your search' : 'Personalise your search'} <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            </div>
          </div>
        </section>
        <section className="public-container landing-business" aria-labelledby="for-business-title">
          <div><span className="public-eyebrow">For hotel owners and teams</span><h2 id="for-business-title">Your rooms. <br />More guests.</h2></div>
          <div>
            <p>{pcm ? 'Manage your room details, rates and availability in one place. Guests see what your team has actually confirmed.' : 'Manage your room details, rates and availability in one workspace. Guests see what your team has actually confirmed.'}</p>
            <Link className="btn btn-primary" to="/business/apply">{pcm ? 'List your hotel' : 'List your hotel on 7even'} <ArrowUpRight size={18} aria-hidden="true" /></Link>
            <p className="public-small">{pcm ? 'No fake rooms. No surprise prices. Just clear booking details.' : 'No invented rooms. No surprise prices. Clear booking details.'}</p>
          </div>
        </section>
        <div className="public-container landing-image-note">Hotel photography is illustrative and does not represent confirmed inventory or availability.</div>
      </main>
      <PublicFooter />
    </div>
  );
}

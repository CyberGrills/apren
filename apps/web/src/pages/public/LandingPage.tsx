import type { Offering, Sector } from '@7even/contracts';
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, OfferingCard } from '../../components/ui.tsx';
import { useSeason } from '../../context/SeasonContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { seasonalCampaigns } from '../../lib/seasonalCampaigns.ts';
import { editorialImages, localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function LandingPage() {
  const navigate = useNavigate();
  const campaign = seasonalCampaigns[useSeason()];
  const [kind, setKind] = useState<Sector>('STAY');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('');
  const { data, loading, error, reload } = useApi<Offering[]>('/offerings?pageSize=3');
  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams({ kind });
    if (city.trim()) query.set('city', city.trim());
    if (date) query.set('startDate', date);
    navigate(`/explore?${query}`);
  }
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content">
        <section className="public-container landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <span className="public-eyebrow">Good places. Nigeria first.</span>
            <span className="seasonal-campaign-label">{campaign.label}</span>
            <h1 id="landing-title">
              Rooms, tables
              <br />
              and <em>days out.</em>
            </h1>
            <p>{campaign.message}</p>
            <div className="landing-footnote">
              <span aria-hidden="true">07</span>
              <p>
                For a night away, a long lunch,
                <br />
                or the part of your city
                <br />
                you haven't met yet.
              </p>
            </div>
          </div>
          <figure className="landing-hero-image">
            <img
              src={campaign.image.src}
              alt={campaign.image.alt}
              width={campaign.image.width}
              height={campaign.image.height}
              fetchPriority="high"
            />
            <figcaption>
              <span>{campaign.image.caption}</span>
              <span>{campaign.image.credit}</span>
            </figcaption>
          </figure>
          <form className="landing-search" onSubmit={search} aria-label="Find a place">
            <div className="landing-search-kind">
              <label htmlFor="home-kind">Your plan</label>
              <select
                id="home-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as Sector)}
              >
                <option value="STAY">A place to stay</option>
                <option value="DINING">A table to book</option>
                <option value="EXPERIENCE">Something to do</option>
              </select>
            </div>
            <div>
              <label htmlFor="home-city">
                <MapPin size={13} aria-hidden="true" /> Where
              </label>
              <input
                id="home-city"
                placeholder="Any city in Nigeria"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={160}
              />
            </div>
            <div>
              <label htmlFor="home-date">
                <CalendarDays size={13} aria-hidden="true" /> When
              </label>
              <input
                id="home-date"
                type="date"
                min={localDateNow()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Find a place <ArrowUpRight size={19} aria-hidden="true" />
            </button>
          </form>
        </section>
        <section className="public-container landing-places" aria-labelledby="places-title">
          <div className="public-section-heading">
            <div>
              <span className="public-eyebrow">Worth a look / 01</span>
              <h2 id="places-title">
                A little room for
                <br />a good weekend.
              </h2>
            </div>
            <div>
              <p>
                A stay, dinner, something to do.
                <br />
                One place to keep your plans.
              </p>
              <Link to="/explore" className="public-text-link">
                See all places <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          {loading && <Loading />}
          {error && <ErrorNotice message={error} retry={reload} />}
          {data && data.length > 0 && (
            <div className="landing-offering-grid">
              {data.map((offering) => (
                <OfferingCard key={offering.id} offering={offering} />
              ))}
            </div>
          )}
          {data?.length === 0 && (
            <EmptyState
              title="Good places are on their way."
              description="Businesses will appear here once they have joined 7even and published their availability."
              action={
                <Link className="btn btn-secondary" to="/business/apply">
                  Bring your business
                </Link>
              }
            />
          )}
        </section>
        <section className="landing-editorial" aria-labelledby="local-title">
          <div className="public-container landing-editorial-grid">
            <figure>
              <img
                src={editorialImages.beach}
                alt="Two visitors beside the ocean in Lagos, Nigeria."
                width="1000"
                height="1200"
                loading="lazy"
              />
              <figcaption>On the coast in Lagos · Photo: Ben Iwara / Unsplash</figcaption>
            </figure>
            <div>
              <span className="public-eyebrow">Go a little further / 02</span>
              <h2 id="local-title">
                A change of scene.
                <br />
                <em>Close to home.</em>
              </h2>
              <p>
                A day by the water. Dinner without a rush. A room with no early alarm. You don't
                always need a long trip to make time for yourself.
              </p>
              <Link to="/explore?kind=EXPERIENCE" className="public-text-link">
                Find something to do <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <div className="landing-local-note">
                <span className="public-eyebrow">Your points stay with you</span>
                <p>
                  Earn points when eligible bookings are completed. See what you've earned and
                  choose rewards from participating businesses.
                </p>
                <Link to="/app/points">
                  How your points add up <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="public-container landing-business" aria-labelledby="for-business-title">
          <div>
            <span className="public-eyebrow">For the people behind the place / 03</span>
            <h2 id="for-business-title">
              More time for
              <br />
              your guests.
            </h2>
          </div>
          <div>
            <p>
              Your rooms, reservations and next arrivals in one workspace. See the days that need
              attention and the evidence behind each demand suggestion.
            </p>
            <Link className="btn btn-primary" to="/business/apply">
              Bring your business to 7even <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <p className="public-small">
              Stays, dining and experiences. Built to make room for more.
            </p>
          </div>
        </section>
        <div className="public-container landing-image-note">
          Editorial photographs are illustrative. They do not represent named businesses or
          available inventory.
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

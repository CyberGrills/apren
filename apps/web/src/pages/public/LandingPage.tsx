import type { NigeriaLocation, Offering, Sector } from '@7even/contracts';
import { BedDouble, Compass, Hotel, Search, SlidersHorizontal, Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DatePicker } from '../../components/DatePicker.tsx';
import { DestinationInput } from '../../components/LocationFields.tsx';
import { EmptyState, Loading, OfferingCard, useFeedback } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { stayDatesError } from '../../lib/datePicker.ts';
import { addDays, localDateNow, PublicFooter, PublicHeader, readSevenLanguage } from './PublicShell.tsx';

type MarketplaceKind = Sector | 'ALL';

const categories: { value: MarketplaceKind; label: string; Icon: typeof Hotel }[] = [
  { value: 'STAY', label: 'Hotels & stays', Icon: Hotel },
  { value: 'DINING', label: 'Dining', Icon: Utensils },
  { value: 'EXPERIENCE', label: 'Things to do', Icon: Compass },
];

const categoryHeadings: Record<MarketplaceKind, { title: string; description: string }> = {
  ALL: {
    title: 'Find your next good place.',
    description: 'Explore stays, dining and experiences from businesses listed on 7even.',
  },
  STAY: {
    title: 'Places to stay',
    description: 'Find a room for the night, a weekend away, or the trip you have been planning.',
  },
  DINING: {
    title: 'Tables worth booking',
    description: 'Discover restaurants and make room for a meal worth remembering.',
  },
  EXPERIENCE: {
    title: 'Make a day of it',
    description: 'Find local experiences and make more of the time you have.',
  },
};

export function LandingPage() {
  const navigate = useNavigate();
  const { showError } = useFeedback();
  const [kind, setKind] = useState<MarketplaceKind>('STAY');
  const [language, setLanguage] = useState(readSevenLanguage);
  useEffect(() => {
    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<'en' | 'pcm'>).detail;
      if (next === 'en' || next === 'pcm') setLanguage(next);
    };
    window.addEventListener('7even-language-change', onLanguageChange);
    return () => window.removeEventListener('7even-language-change', onLanguageChange);
  }, []);
  const [city, setCity] = useState('');
  const [destination, setDestination] = useState<NigeriaLocation | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rooms, setRooms] = useState('1');
  const listingPath =
    kind === 'ALL' ? '/offerings?pageSize=8' : `/offerings?kind=${kind}&pageSize=8`;
  const { data, loading, error, reload } = useApi<Offering[]>(listingPath);
  const isStaySearch = kind === 'STAY';

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dateError = isStaySearch ? stayDatesError(startDate, endDate) : null;
    if (dateError) {
      showError(dateError);
      return;
    }
    const query = new URLSearchParams();
    if (kind !== 'ALL') query.set('kind', kind);
    if (city.trim()) query.set('city', destination?.name ?? city.trim());
    if (destination) query.set('state', destination.state);
    if (startDate) query.set('startDate', startDate);
    if (isStaySearch && endDate) query.set('endDate', endDate);
    if (isStaySearch) query.set('rooms', rooms || '1');
    navigate(`/explore${query.size ? `?${query.toString()}` : ''}`);
  }

  const englishHeading = categoryHeadings[kind];
  const heading = language === 'pcm'
    ? {
        title: kind === 'STAY' ? 'Find where you go stay.' : kind === 'DINING' ? 'Food and table wey make sense.' : kind === 'EXPERIENCE' ? 'Make your day sweet.' : 'Find your next good place.',
        description: kind === 'STAY' ? 'Find room for night, weekend waka, or the trip wey you dey plan.' : kind === 'DINING' ? 'Find restaurant and book table for correct enjoyment.' : kind === 'EXPERIENCE' ? 'Discover things to do and enjoy your time.' : 'Explore stays, food and experiences for your area.',
      }
    : englishHeading;
  return (
    <div className="public-page seven-marketplace">
      <PublicHeader />
      <main id="main-content">
        <nav className="public-container seven-category-row" aria-label="Browse by category">
          {categories.map(({ value, label, Icon }) => (
            <button
              type="button"
              className={kind === value ? 'seven-category active' : 'seven-category'}
              key={value}
              onClick={() => {
                setKind(value);
              }}
              aria-pressed={kind === value}
            >
              <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
              <span>{language === 'pcm' ? ({ ALL: 'All', STAY: 'Places to stay', DINING: 'Food', EXPERIENCE: 'Things to do' } as Record<MarketplaceKind, string>)[value] : label}</span>
            </button>
          ))}
          <Link
            to={kind === 'ALL' ? '/explore' : `/explore?kind=${kind}`}
            className="seven-more-filters"
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>{language === 'pcm' ? 'More options' : 'More filters'}</span>
          </Link>
        </nav>

        <section className="seven-search-shell" aria-label="Search 7even">
          <form
            className={`seven-search-bar ${isStaySearch ? 'seven-search-stay' : 'seven-search-compact'}`}
            onSubmit={search}
          >
            <div className="seven-search-field seven-search-destination">
              <DestinationInput
                value={city}
                onChange={(value) => {
                  setCity(value);
                  setDestination(null);
                }}
                onSelect={(location) => {
                  setCity(location.name);
                  setDestination(location);
                }}
              />
            </div>
            {isStaySearch ? (
              <>
                <div className="seven-search-field">
                  <DatePicker
                    id="seven-checkin"
                    name="startDate"
                    label={language === 'pcm' ? 'When you dey come' : 'Check in'}
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      if (endDate && endDate <= value) setEndDate('');
                    }}
                  />
                </div>
                <div className="seven-search-field">
                  <DatePicker
                    id="seven-checkout"
                    name="endDate"
                    label={language === 'pcm' ? 'When you dey go' : 'Check out'}
                    value={endDate}
                    min={startDate ? addDays(startDate, 1) : localDateNow()}
                    onChange={setEndDate}
                  />
                </div>
                <div className="seven-search-field seven-search-rooms">
                  <label htmlFor="seven-rooms" className="seven-rooms-label"><BedDouble size={15} aria-hidden="true" /> Rooms</label>
                  <select
                    id="seven-rooms"
                    value={rooms}
                    onChange={(event) => setRooms(event.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6].map((count) => (
                      <option value={count} key={count}>
                        {count} {count === 1 ? 'room' : 'rooms'}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="seven-search-field">
                <DatePicker
                  id="seven-date"
                  name="startDate"
                  label="When"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
            )}
            <button className="seven-search-button" type="submit" aria-label="Search places">
              <Search size={20} aria-hidden="true" />
              <span>{language === 'pcm' ? 'Find am' : 'Search'}</span>
            </button>
          </form>
        </section>

        <section
          className="public-container seven-marketplace-results"
          aria-labelledby="seven-results-title"
        >
          <div className="seven-results-heading">
            <div>
              <p className="seven-kicker">{language === 'pcm' ? 'Find your next place with 7even' : 'Discover with 7even'}</p>
              <h1 id="seven-results-title">{heading.title}</h1>
              <p className="seven-results-description">{heading.description}</p>
            </div>
            <Link
              to={kind === 'ALL' ? '/explore' : `/explore?kind=${kind}`}
              className="seven-all-results"
            >
              View all <span aria-hidden="true">→</span>
            </Link>
          </div>

          {loading && <Loading />}
          {error && (
            <div className="seven-api-unavailable" role="status">
              <div>
                <h2>{language === 'pcm' ? 'We dey reconnect room availability' : 'Live 7even inventory is reconnecting'}</h2>
                <p>
                  Current 7even prices and room availability could not be loaded. Try again shortly;
                  we will not show unverified properties as bookable stays.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
                Try again
              </button>
            </div>
          )}
          {data && data.length > 0 && (
            <div className="seven-listing-grid">
              {data.map((offering) => (
                <OfferingCard key={offering.id} offering={offering} />
              ))}
            </div>
          )}
          {data?.length === 0 && (
            <EmptyState
              title={
                kind === 'STAY'
                  ? 'Your next stay is not listed just yet.'
                  : 'We are making room for more.'
              }
              description={
                kind === 'STAY'
                  ? '7even only shows properties that have passed the required verification review and have current room availability confirmed by their partner. Try another city or date, or come back as new stays are approved.'
                  : 'There are no published places in this category right now. New listings will appear after the business has completed onboarding and published its offering.'
              }
              action={
                <Link className="btn btn-secondary" to="/business/apply">
                  List your property or business
                </Link>
              }
            />
          )}


        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

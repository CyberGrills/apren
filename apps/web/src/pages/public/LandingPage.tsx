import type { NigeriaLocation, Offering, Sector } from '@7even/contracts';
import { BedDouble, Compass, LayoutGrid, Search, SlidersHorizontal, Utensils } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DatePicker } from '../../components/DatePicker.tsx';
import { DestinationInput } from '../../components/LocationFields.tsx';
import { EmptyState, Loading, OfferingCard, useFeedback } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { stayDatesError } from '../../lib/datePicker.ts';
import { listingsForKind } from '../../lib/nigeriaDirectory.ts';
import { DirectoryListingCard } from './DirectoryListingCard.tsx';
import { addDays, localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';

type MarketplaceKind = Sector | 'ALL';

const categories: { value: MarketplaceKind; label: string; Icon: typeof BedDouble }[] = [
  { value: 'ALL', label: 'All', Icon: LayoutGrid },
  { value: 'STAY', label: 'Stays', Icon: BedDouble },
  { value: 'DINING', label: 'Dining', Icon: Utensils },
  { value: 'EXPERIENCE', label: 'Experiences', Icon: Compass },
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

  const heading = categoryHeadings[kind];
  const directoryPreview =
    kind === 'ALL'
      ? (['STAY', 'DINING', 'EXPERIENCE'] as const).flatMap((category) =>
          listingsForKind(category).slice(0, 2),
        )
      : listingsForKind(kind).slice(0, 6);

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
              <span>{label}</span>
            </button>
          ))}
          <Link
            to={kind === 'ALL' ? '/explore' : `/explore?kind=${kind}`}
            className="seven-more-filters"
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>More filters</span>
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
                    label="Check in"
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
                    label="Check out"
                    value={endDate}
                    min={startDate ? addDays(startDate, 1) : localDateNow()}
                    onChange={setEndDate}
                  />
                </div>
                <div className="seven-search-field seven-search-rooms">
                  <label htmlFor="seven-rooms">Rooms</label>
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
              <span>Search</span>
            </button>
          </form>
        </section>

        <section
          className="public-container seven-marketplace-results"
          aria-labelledby="seven-results-title"
        >
          <div className="seven-results-heading">
            <div>
              <p className="seven-kicker">Discover with 7even</p>
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
                <h2>Live 7even inventory is reconnecting</h2>
                <p>
                  Current 7even prices, room availability and bookings are not available in this
                  preview yet. You can explore source-backed directory entries below, but they
                  cannot be booked through 7even.
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
                  ? '7even only shows properties that have passed the required verification review and have current room availability confirmed by their partner. Try another category, or come back as new stays are approved.'
                  : 'There are no published places in this category right now. New listings will appear after the business has completed onboarding and published its offering.'
              }
              action={
                <Link className="btn btn-secondary" to="/business/apply">
                  List your property or business
                </Link>
              }
            />
          )}

          {!loading && (Boolean(error) || data?.length === 0) && (
            <div className="seven-directory-preview">
              <div className="seven-directory-preview-heading">
                <div>
                  <p className="seven-kicker">The wider Nigeria directory</p>
                  <h2>Explore places by category</h2>
                  <p>
                    These source-linked leads help you discover places while the 7even partner
                    catalogue is being connected. They are not verified or bookable 7even offers.
                  </p>
                </div>
                <Link
                  className="seven-all-results"
                  to={kind === 'ALL' ? '/directory?kind=ALL' : `/directory?kind=${kind}`}
                >
                  Browse directory <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className="seven-directory-grid">
                {directoryPreview.map((listing) => (
                  <DirectoryListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              {kind === 'STAY' && (
                <Link className="seven-directory-all-states" to="/directory?kind=STAY">
                  Browse hotels by all 36 states and the FCT <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

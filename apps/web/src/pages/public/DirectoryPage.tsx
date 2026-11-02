import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.ts';
import {
  type DirectoryFilter,
  type DirectoryKind,
  type DirectoryListing,
  directoryKindLabels,
  directoryListingMatchKey,
  listingsForKind,
  type NigeriaStateDirectory,
  nigeriaStateDirectories,
} from '../../lib/nigeriaDirectory.ts';
import { BusinessDirectoryCard, type BusinessDirectoryProfile } from './BusinessDirectoryCard.tsx';
import { DirectoryListingCard } from './DirectoryListingCard.tsx';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

const tabs: { value: DirectoryFilter; label: string }[] = [
  { value: 'STAY', label: 'Stays' },
  { value: 'DINING', label: 'Dining' },
  { value: 'EXPERIENCE', label: 'Experiences' },
  { value: 'ALL', label: 'All categories' },
];

const validKinds = new Set<DirectoryFilter>(['STAY', 'DINING', 'EXPERIENCE', 'ALL']);

interface DirectoryApiResponse {
  states: NigeriaStateDirectory[];
  listings: DirectoryListing[];
  businesses?: BusinessDirectoryProfile[];
  businessesTotal?: number;
  total: number;
  page: number;
  pageSize: number;
}

export function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKind = (searchParams.get('kind') ?? 'STAY').toUpperCase() as DirectoryFilter;
  const kind: DirectoryFilter = validKinds.has(requestedKind) ? requestedKind : 'STAY';
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const directoryPath = `/directory?kind=${kind}&page=1&pageSize=100`;
  const {
    data: directoryData,
    loading: directoryLoading,
    error: directoryError,
    reload: reloadDirectory,
  } = useApi<DirectoryApiResponse>(directoryPath);

  const displayedStates = directoryData?.states?.length
    ? directoryData.states
    : nigeriaStateDirectories;

  const listings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-NG');
    const liveListings = directoryData?.listings ?? [];
    // Static hotel leads must never bypass the database's HIDDEN status.
    // Static non-hotel references remain directory-only fallback content.
    const staticFallback = listingsForKind(kind).filter((listing) => listing.kind !== 'STAY');
    const sourceListings = directoryData
      ? [
          ...liveListings,
          ...staticFallback.filter(
            (staticListing) =>
              !liveListings.some(
                (liveListing) =>
                  directoryListingMatchKey(liveListing) === directoryListingMatchKey(staticListing),
              ),
          ),
        ]
      : staticFallback;
    return sourceListings.filter((listing) => {
      if (stateFilter && listing.state !== stateFilter) return false;
      if (!query) return true;
      return [
        listing.name,
        listing.state,
        listing.city,
        listing.area,
        listing.address,
        listing.description,
      ]
        .join(' ')
        .toLocaleLowerCase('en-NG')
        .includes(query);
    });
  }, [kind, search, stateFilter, directoryData]);

  const businessProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-NG');
    return (directoryData?.businesses ?? []).filter((profile) => {
      if (kind !== 'ALL' && profile.kind !== kind) return false;
      if (stateFilter && profile.state !== stateFilter) return false;
      if (!query) return true;
      return [
        profile.name,
        profile.kind,
        profile.city,
        profile.state ?? '',
        profile.venueName ?? '',
        profile.address ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('en-NG')
        .includes(query);
    });
  }, [kind, search, stateFilter, directoryData]);

  function selectKind(nextKind: DirectoryFilter) {
    setSearchParams(nextKind === 'ALL' ? {} : { kind: nextKind });
    setStateFilter('');
  }

  const groupDescription: Record<DirectoryFilter, string> = {
    ALL: 'Browse approved 7even business profiles alongside source-backed discovery leads. Directory profiles are not booking offers.',
    STAY: 'Browse existing stay profiles and Nigerian state directories. Hotel verification and current partner-confirmed inventory are required before booking.',
    DINING:
      'Discover approved business profiles and sourced dining references. Table availability has not been verified by 7even.',
    EXPERIENCE:
      'Explore approved business profiles and cultural, nature and leisure destinations referenced by Nigerian tourism sources. Confirm access and operating conditions before travelling.',
  };

  return (
    <div className="public-page seven-marketplace seven-directory-page">
      <PublicHeader />
      <main id="main-content">
        <section className="public-container seven-directory-hero">
          <Link className="seven-directory-back" to="/">
            ← Back to 7even
          </Link>
          <p className="public-eyebrow">Nigeria discovery directory</p>
          <h1>Find the place, by name or by state.</h1>
          <p className="seven-directory-intro">{groupDescription[kind]}</p>

          <nav className="seven-directory-tabs" aria-label="Directory category">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                className={kind === tab.value ? 'seven-directory-tab active' : 'seven-directory-tab'}
                type="button"
                aria-pressed={kind === tab.value}
                onClick={() => selectKind(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="seven-directory-filters">
            <label className="seven-directory-filter-field">
              <span>Search name or location</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Try Uyo, Karrotify, Lagos…"
                autoComplete="off"
              />
            </label>
            <label className="seven-directory-filter-field">
              <span>State / territory</span>
              <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                <option value="">All locations</option>
                {displayedStates.map((state) => (
                  <option value={state.stateName} key={state.stateName}>
                    {state.stateName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {directoryError && (
            <div className="seven-api-unavailable seven-directory-api-note" role="status">
              <p>
                The live business directory is temporarily disconnected. Showing only the
                source-backed fallback directory; hidden hotel leads remain excluded.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void reloadDirectory()}
              >
                Retry live directory
              </button>
            </div>
          )}
          {directoryLoading && (
            <p className="seven-directory-loading" role="status">
              Loading business profiles and directory sources…
            </p>
          )}
        </section>

        {businessProfiles.length > 0 && (
          <section
            className="public-container seven-directory-content"
            aria-labelledby="seven-business-directory-title"
          >
            <div className="seven-directory-section-heading">
              <div>
                <p className="public-eyebrow">Canonical business records</p>
                <h2 id="seven-business-directory-title">Businesses listed on 7even</h2>
                <p className="seven-directory-intro">
                  These are approved business profiles, shown separately from bookable offerings.
                  Booking remains disabled until the required offering and inventory checks pass.
                </p>
              </div>
              <p>
                {businessProfiles.length} {businessProfiles.length === 1 ? 'profile' : 'profiles'}
              </p>
            </div>
            <div className="seven-directory-grid">
              {businessProfiles.map((profile) => (
                <BusinessDirectoryCard key={profile.id} profile={profile} />
              ))}
            </div>
          </section>
        )}

        <section
          className="public-container seven-directory-content"
          aria-labelledby="seven-directory-listings-title"
        >
          <div className="seven-directory-section-heading">
            <div>
              <p className="public-eyebrow">Source-backed leads</p>
              <h2 id="seven-directory-listings-title">
                {kind === 'ALL'
                  ? 'Stays, dining and experiences'
                  : directoryKindLabels[kind as DirectoryKind]}
              </h2>
            </div>
            <p>
              {listings.length} directory {listings.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>

          {listings.length ? (
            <div className="seven-directory-grid">
              {listings.map((listing) => (
                <DirectoryListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <div className="seven-directory-no-results">
              <h3>No matching source-backed entries</h3>
              <p>
                Try a different name, city or state. State hotel links remain available below in
                Stays. Approved business profiles appear in their own section when available.
              </p>
              <button
                type="button"
                className="seven-directory-tab"
                onClick={() => {
                  setSearch('');
                  setStateFilter('');
                  selectKind('STAY');
                }}
              >
                Browse stays
              </button>
            </div>
          )}
        </section>

        {(kind === 'STAY' || kind === 'ALL') && (
          <section
            className="public-container seven-state-directory"
            aria-labelledby="seven-state-directory-title"
          >
            <div className="seven-directory-section-heading">
              <div>
                <p className="public-eyebrow">Alphabetical state index</p>
                <h2 id="seven-state-directory-title">Hotels across all 36 states and the FCT</h2>
                <p className="seven-directory-intro">
                  Open a state’s hotel directory to browse the source provider’s available names and
                  photos. These external results are not copied into 7even’s bookable inventory.
                </p>
              </div>
              <span className="seven-state-directory-count">
                {nigeriaStateDirectories.length} locations
              </span>
            </div>
            <div className="seven-state-directory-grid">
              {displayedStates
                .filter((state) => !stateFilter || state.stateName === stateFilter)
                .filter((state) => {
                  const query = search.trim().toLocaleLowerCase('en-NG');
                  return (
                    !query ||
                    [state.stateName, state.capital, state.region]
                      .join(' ')
                      .toLocaleLowerCase('en-NG')
                      .includes(query)
                  );
                })
                .map((state) => (
                  <article className="seven-state-directory-card" key={state.stateName}>
                    <div>
                      <p className="seven-state-directory-region">{state.region}</p>
                      <h3>{state.stateName}</h3>
                      <p>Capital: {state.capital}</p>
                    </div>
                    <a href={state.hotelDirectoryUrl} target="_blank" rel="noreferrer noopener">
                      Browse hotels <span aria-hidden="true">↗</span>
                    </a>
                  </article>
                ))}
            </div>
            <p className="seven-directory-source-note">
              State links point to Hotels.ng. Directory totals and listings can change; verify all
              property information with the operator. A source directory appearance does not imply
              that a hotel is onboarded or bookable on 7even.
            </p>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

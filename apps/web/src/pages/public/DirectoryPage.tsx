import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  type DirectoryFilter,
  type DirectoryKind,
  type DirectoryListing,
  directoryKindLabels,
  listingsForKind,
  type NigeriaStateDirectory,
  nigeriaStateDirectories,
} from '../../lib/nigeriaDirectory.ts';
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
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(
    /\/+$/,
    '',
  );
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    | string
    | undefined;
  const [directoryData, setDirectoryData] = useState<DirectoryApiResponse | null>(null);
  const [directoryError, setDirectoryError] = useState(false);
  const [retryCounter, setRetryCounter] = useState(0);
  const reloadDirectory = () => setRetryCounter((value) => value + 1);

  useEffect(() => {
    if (!supabaseUrl || !supabasePublishableKey) {
      setDirectoryError(true);
      setDirectoryData(null);
      return;
    }
    const controller = new AbortController();
    setDirectoryError(false);
    const headers = {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
    };
    const stateParams = new URLSearchParams({
      select: 'stateName,capital,region,hotelDirectoryUrl',
      order: 'stateName.asc',
    });
    const listingParams = new URLSearchParams({
      select:
        'id,kind,name,state,city,area,address,description,imageUrl,imageSourceUrl,sourceName,sourceUrl,status,bookable',
      order: 'state.asc,city.asc,name.asc',
      limit: '100',
    });
    if (kind !== 'ALL') listingParams.set('kind', `eq.${kind}`);

    async function loadDirectory() {
      try {
        const [statesResponse, listingsResponse] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/seven_state_directories?${stateParams.toString()}`, {
            headers,
            signal: controller.signal,
            cache: retryCounter > 0 ? 'reload' : 'default',
          }),
          fetch(`${supabaseUrl}/rest/v1/seven_discovery_directory?${listingParams.toString()}`, {
            headers,
            signal: controller.signal,
            cache: retryCounter > 0 ? 'reload' : 'default',
          }),
        ]);
        if (!statesResponse.ok || !listingsResponse.ok) {
          throw new Error(
            'Directory read failed with HTTP ' +
              statesResponse.status +
              '/' +
              listingsResponse.status,
          );
        }
        const states = (await statesResponse.json()) as NigeriaStateDirectory[];
        const rows = (await listingsResponse.json()) as Array<
          Omit<DirectoryListing, 'imageSourceName'>
        >;
        // Preserve curated source metadata (published rate references, official links,
        // contact details and image attribution) when a matching live row exists.
        // Database values remain authoritative for fields they actually provide.
        const staticListingsById = new Map(
          listingsForKind('ALL').map((listing) => [listing.id, listing]),
        );
        const listings: DirectoryListing[] = rows.map((listing) => {
          const id = String(listing.id);
          const curated = staticListingsById.get(id);
          let derivedImageSourceName = 'Source website';
          try {
            derivedImageSourceName = new URL(listing.imageSourceUrl).hostname;
          } catch {
            // Use curated attribution below when the live source URL is absent or malformed.
          }
          return {
            ...(curated ?? {}),
            ...listing,
            id,
            imageSourceName: curated?.imageSourceName ?? derivedImageSourceName,
            // Directory API records are discovery leads, never proof of partner verification.
            status: 'DIRECTORY_ONLY',
            bookable: false,
          } as DirectoryListing;
        });
        setDirectoryData({ states, listings, total: listings.length, page: 1, pageSize: 100 });
        setDirectoryError(false);
      } catch {
        if (controller.signal.aborted) return;
        setDirectoryData(null);
        setDirectoryError(true);
      }
    }
    void loadDirectory();
    return () => controller.abort();
  }, [kind, retryCounter]);
  const displayedStates = directoryData?.states?.length
    ? directoryData.states
    : nigeriaStateDirectories;

  const listings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-NG');
    const sourceListings = directoryData
      ? [
          ...directoryData.listings,
          ...listingsForKind(kind).filter(
            (staticListing) =>
              !directoryData.listings.some((liveListing) => liveListing.id === staticListing.id),
          ),
        ]
      : listingsForKind(kind);
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

  function selectKind(nextKind: DirectoryFilter) {
    setSearchParams(nextKind === 'ALL' ? {} : { kind: nextKind });
    setStateFilter('');
  }

  const groupDescription: Record<DirectoryFilter, string> = {
    ALL: 'A sourced guide to stays, dining and experiences. Directory cards link out to their source; they are not verified 7even listings.',
    STAY: 'Browse hotel leads and every Nigerian state/FCT through an external hotel directory. Partner verification and fresh availability are still required before 7even can accept a booking.',
    DINING:
      'Discover restaurants with source links, location details and photos. Table availability has not been verified by 7even.',
    EXPERIENCE:
      'Explore cultural, nature and leisure destinations referenced by Nigerian tourism sources. Confirm access and current operating conditions before travelling.',
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
                className={
                  kind === tab.value ? 'seven-directory-tab active' : 'seven-directory-tab'
                }
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
                placeholder="Try Lagos, Calabar, Obudu…"
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
                The preview catalogue is temporarily disconnected. Showing the curated source
                directory instead; these entries are not verified or bookable on 7even.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void reloadDirectory()}
              >
                Retry live catalogue
              </button>
            </div>
          )}
        </section>

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
              <h3>No matching directory entries</h3>
              <p>
                Try a different name, city or state. State hotel links remain available below in
                Stays.
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

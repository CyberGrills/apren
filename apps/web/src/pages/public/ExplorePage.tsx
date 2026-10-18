import type { Offering, Sector } from '@7even/contracts';
import { useMemo, useState } from 'react';
import { arrivalDiscoveryLeads } from '../../lib/arrivalLeads.ts';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, OfferingCard } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [arrivalOrigin, setArrivalOrigin] = useState('Akwa Ibom Airport');
  const [arrivalNeed, setArrivalNeed] = useState('stay');
  const [arrivalBudget, setArrivalBudget] = useState('');
  const [arrivalQuery, setArrivalQuery] = useState('');
  const [showArrivalLeads, setShowArrivalLeads] = useState(false);
  const visibleArrivalLeads = useMemo(() => {
    const term = arrivalQuery.trim().toLocaleLowerCase();
    return arrivalDiscoveryLeads.filter((lead) => !term || `${lead.name} ${lead.address}`.toLocaleLowerCase().includes(term));
  }, [arrivalQuery]);
  const requestedKind = params.get('kind');
  const kind =
    requestedKind && ['STAY', 'DINING', 'EXPERIENCE'].includes(requestedKind)
      ? (requestedKind as Sector)
      : null;
  const page = Math.min(10000, Math.max(1, Math.trunc(Number(params.get('page')) || 1)));
  const pageSize = 12;
  const query = new URLSearchParams(params);
  query.set('pageSize', String(pageSize));
  query.set('page', String(page));
  if (!kind) query.delete('kind');
  const { data, loading, error, reload } = useApi<Offering[]>(`/offerings?${query}`);
  function filter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    if (kind && ['STAY', 'DINING', 'EXPERIENCE'].includes(kind)) next.set('kind', kind);
    for (const key of ['city', 'startDate', 'endDate']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    setParams(next);
  }
  function changeKind(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set('kind', value);
    else next.delete('kind');
    next.delete('page');
    setParams(next);
  }
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="public-container explore-page">
        <div className="explore-heading">
          <span className="public-eyebrow">Find your next plan</span>
          <h1>
            {kind === 'STAY'
              ? 'Stay a little while.'
              : kind === 'DINING'
                ? 'There’s a table for that.'
                : kind === 'EXPERIENCE'
                  ? 'Make a day of it.'
                  : 'Somewhere good to go.'}
          </h1>
          <p>Rooms, dining and experiences from businesses on 7even.</p>
        </div>
        <section className="arrival-discovery" aria-labelledby="arrival-discovery-title">
          <div className="arrival-discovery-copy">
            <span className="public-eyebrow">Just arrived?</span>
            <h2 id="arrival-discovery-title">Find your footing in Uyo.</h2>
            <p>Start from the airport or tell us where you are. We separate current 7even bookable offers from public directory leads that still need verification.</p>
          </div>
          <form className="arrival-discovery-form" onSubmit={(event) => { event.preventDefault(); setShowArrivalLeads(true); }}>
            <div>
              <label htmlFor="arrival-origin">Arriving from</label>
              <select id="arrival-origin" value={arrivalOrigin} onChange={(event) => setArrivalOrigin(event.target.value)}>
                <option>Akwa Ibom Airport</option>
                <option>AKTC / Itam</option>
                <option>ABC Transport / Uyo</option>
                <option>Already in Uyo</option>
              </select>
            </div>
            <div>
              <label htmlFor="arrival-need">What do you need?</label>
              <select id="arrival-need" value={arrivalNeed} onChange={(event) => setArrivalNeed(event.target.value)}>
                <option value="stay">A place to stay</option>
                <option value="food">Food and dining</option>
                <option value="transport">Getting around</option>
              </select>
            </div>
            <div>
              <label htmlFor="arrival-budget">Budget preference (₦, optional)</label>
              <input id="arrival-budget" inputMode="numeric" pattern="[0-9,]*" value={arrivalBudget} onChange={(event) => setArrivalBudget(event.target.value)} placeholder="e.g. 50000" maxLength={14} />
            </div>
            <div>
              <label htmlFor="arrival-search">Area or hotel name</label>
              <input id="arrival-search" value={arrivalQuery} onChange={(event) => setArrivalQuery(event.target.value)} placeholder="Search Uyo directory leads" maxLength={120} />
            </div>
            <button type="submit" className="btn btn-primary"><Search size={17} aria-hidden="true" /> Explore arrival options</button>
          </form>
          <p className="arrival-discovery-note">Arrival point: <strong>{arrivalOrigin}</strong>. {arrivalBudget.trim() ? 'Your budget is saved as a preference; directory leads have no verified prices, so it cannot be used to rank or filter them.' : 'No route distance or arrival time is claimed until a verified routing source is configured.'}</p>
          {showArrivalLeads && arrivalNeed === 'stay' && (
            <div className="arrival-lead-results">
              <div className="arrival-lead-heading">
                <div><span className="public-eyebrow">Discovery only</span><h3>{visibleArrivalLeads.length} public directory {visibleArrivalLeads.length === 1 ? 'lead' : 'leads'}</h3></div>
                <span className="arrival-unverified-label">Unverified · not bookable</span>
              </div>
              <p className="arrival-lead-warning">These listings are research leads, not verified partners or available rooms. Confirm the property, direct contact, current prices and inventory before travelling or paying.</p>
              {visibleArrivalLeads.length > 0 ? (
                <div className="arrival-lead-grid">
                  {visibleArrivalLeads.map((lead) => (
                    <article className="arrival-lead-card" key={lead.name}>
                      <h4>{lead.name}</h4>
                      <p>{lead.address}</p>
                      {lead.phone && <p><span>Publicly listed phone (unverified):</span> {lead.phone}</p>}
                      <a href={lead.sourceUrl} target="_blank" rel="noreferrer">View original directory <span aria-hidden="true">↗</span></a>
                    </article>
                  ))}
                </div>
              ) : <p>No directory leads match that search. Try a different hotel name or area.</p>}
            </div>
          )}
          {showArrivalLeads && arrivalNeed !== 'stay' && (
            <p className="arrival-lead-warning">This first arrival-discovery import covers accommodation leads only. No transport or dining service is implied by this directory data.</p>
          )}
        </section>
        <fieldset className="explore-categories">
          <legend className="sr-only">Browse categories</legend>
          {[
            ['', 'Everything'],
            ['STAY', 'Stays'],
            ['DINING', 'Dining'],
            ['EXPERIENCE', 'Experiences'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={(kind ?? '') === value ? 'active' : ''}
              aria-pressed={(kind ?? '') === value}
              onClick={() => changeKind(value ?? '')}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <form className="explore-filters" key={params.toString()} onSubmit={filter}>
          <div className="explore-filter-heading">
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>Make it yours</span>
          </div>
          <div>
            <label htmlFor="explore-city">City</label>
            <input
              id="explore-city"
              name="city"
              defaultValue={params.get('city') ?? ''}
              placeholder="Any city in Nigeria"
              maxLength={160}
            />
          </div>
          <div>
            <label htmlFor="explore-start">{kind === 'STAY' ? 'Check-in' : 'Date'}</label>
            <input
              id="explore-start"
              name="startDate"
              type="date"
              min={localDateNow()}
              defaultValue={params.get('startDate') ?? ''}
            />
          </div>
          {(!kind || kind === 'STAY') && (
            <div>
              <label htmlFor="explore-end">Check-out</label>
              <input
                id="explore-end"
                name="endDate"
                type="date"
                min={params.get('startDate') || localDateNow()}
                defaultValue={params.get('endDate') ?? ''}
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary">
            <Search size={17} aria-hidden="true" /> Find places
          </button>
        </form>
        <div className="explore-results-heading">
          <p aria-live="polite">
            {loading
              ? 'Finding places…'
              : data
                ? `${data.length} ${data.length === 1 ? 'place' : 'places'} to consider`
                : 'Places on 7even'}
          </p>
          <span>Full prices shown before you reserve.</span>
        </div>
        {loading && <Loading />}
        {error && <ErrorNotice message={error} retry={reload} />}
        {data && data.length > 0 && (
          <section className="explore-results" aria-labelledby="explore-results-title">
            <h2 className="sr-only" id="explore-results-title">
              Places matching your search
            </h2>
            <div className="explore-grid">
              {data.map((offering) => (
                <OfferingCard offering={offering} key={offering.id} />
              ))}
            </div>
          </section>
        )}
        {data && (page > 1 || data.length >= pageSize) && (
          <nav className="explore-pagination" aria-label="Results pages">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('page', String(page - 1));
                setParams(next);
              }}
            >
              Previous places
            </button>
            <p>Page {page}</p>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={data.length < pageSize || page >= 10000}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('page', String(page + 1));
                setParams(next);
              }}
            >
              More places
            </button>
          </nav>
        )}
        {data?.length === 0 && (
          <EmptyState
            title="No places match this search yet."
            description="Try another city or date, or browse everything currently available."
            action={
              <button type="button" className="btn btn-secondary" onClick={() => setParams({})}>
                See all places
              </button>
            }
          />
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

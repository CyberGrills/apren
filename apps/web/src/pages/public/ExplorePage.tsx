import type { Offering, Sector } from '@7even/contracts';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, OfferingCard } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
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
    for (const key of ['city', 'startDate', 'endDate', 'rooms']) {
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
            <>
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
              {kind === 'STAY' && (
                <div>
                  <label htmlFor="explore-rooms">Rooms</label>
                  <input
                    id="explore-rooms"
                    name="rooms"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    required
                    defaultValue={params.get('rooms') ?? '1'}
                  />
                </div>
              )}
            </>
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
          <span>{kind === 'STAY' ? 'Live room availability checked on each search; final quote confirms price and capacity.' : 'Full prices shown before you reserve.'}</span>
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

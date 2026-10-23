import type { Offering, Sector } from '@7even/contracts';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StateCityFields } from '../../components/LocationFields.tsx';
import {
  EmptyState,
  ErrorNotice,
  Loading,
  OfferingCard,
  useFeedback,
} from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { stayDatesError } from '../../lib/datePicker.ts';
import { sourcedDirectoryListings } from '../../lib/nigeriaDirectory.ts';
import { DirectoryListingCard } from './DirectoryListingCard.tsx';
import { localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const { showError } = useFeedback();
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
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
    const dateError =
      !kind || kind === 'STAY'
        ? stayDatesError(String(form.get('startDate') ?? ''), String(form.get('endDate') ?? ''))
        : null;
    if (dateError) {
      showError(dateError);
      return;
    }
    const next = new URLSearchParams();
    if (kind && ['STAY', 'DINING', 'EXPERIENCE'].includes(kind)) next.set('kind', kind);
    for (const key of ['state', 'city', 'startDate', 'endDate', 'rooms']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    for (const key of ['amenities', 'maxBaseTotalMinor']) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    setParams(next);
  }
  async function searchWithAssistant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (aiLoading || aiMessage.trim().length < 2) return;
    setAiLoading(true);
    try {
      const result = await api<{
        intent: {
          city: string | null;
          checkInDate: string | null;
          checkOutDate: string | null;
          rooms: number;
          amenities: string[];
          maxBudgetNaira: string | null;
          clarification: string | null;
        };
        searchParams: Record<string, string>;
      }>('/ai/interpret-search', {
        method: 'POST',
        body: { message: aiMessage.trim() },
      });
      if (result.intent.clarification) {
        showError(result.intent.clarification);
        return;
      }
      setParams(new URLSearchParams({ ...result.searchParams, page: '1' }));
    } catch (cause) {
      showError(
        cause instanceof Error ? cause.message : 'AI search is unavailable. Use the filters below.',
      );
    } finally {
      setAiLoading(false);
    }
  }
  const directorySearch = [params.get('city'), params.get('q'), params.get('search')]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim()
    .toLocaleLowerCase('en-NG');
  const directoryMatches =
    !loading && (!data || data.length === 0) && directorySearch.length >= 2
      ? sourcedDirectoryListings.filter((listing) => {
          if (listing.kind !== 'STAY') return false;
          const state = params.get('state')?.toLocaleLowerCase('en-NG');
          if (state && !listing.state.toLocaleLowerCase('en-NG').includes(state)) return false;
          const haystack = [
            listing.name,
            listing.state,
            listing.city,
            listing.area,
            listing.address,
            listing.description,
          ].join(' ').toLocaleLowerCase('en-NG');
          return directorySearch.split(/\\s+/).every((term) => haystack.includes(term));
        })
      : [];
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
        {(!kind || kind === 'STAY') && (
          <form className="explore-ai-search" onSubmit={searchWithAssistant} aria-busy={aiLoading}>
            <div className="explore-ai-field">
              <label htmlFor="explore-ai-query">
                <Search size={17} aria-hidden="true" />
                Describe your stay
              </label>
              <input
                className="field-input"
                id="explore-ai-query"
                name="aiQuery"
                aria-describedby="explore-ai-note"
                value={aiMessage}
                onChange={(event) => setAiMessage(event.target.value)}
                placeholder="e.g. Two nights in Lagos, a pool, and under ₦80,000"
                maxLength={2000}
                minLength={2}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={aiLoading || aiMessage.trim().length < 2}
            >
              {aiLoading ? 'Understanding your request…' : 'Search with AI'}
            </button>
            <p className="explore-ai-note" id="explore-ai-note">
              Your request goes to OpenAI to turn it into search filters. Prices and availability
              come from 7even.
            </p>
          </form>
        )}
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
          <StateCityFields
            prefix="explore"
            initialState={params.get('state')}
            initialCity={params.get('city') ?? ''}
          />
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
          <span>
            {kind === 'STAY'
              ? 'Live room availability checked on each search; final quote confirms price and capacity.'
              : 'Full prices shown before you reserve.'}
          </span>
        </div>
        {loading && <Loading />}
        {error && <ErrorNotice message={error} retry={reload} />}
        {directoryMatches.length > 0 && (
          <section className="seven-directory-search-results" aria-labelledby="directory-search-results-title">
            <div className="seven-directory-search-heading">
              <div>
                <span className="public-eyebrow">Wider 7even discovery</span>
                <h2 id="directory-search-results-title">We found this place in our directory.</h2>
                <p>It is not live bookable inventory yet. Open the source listing or contact the property while 7even verifies partner access and current room availability.</p>
              </div>
              <span className="seven-directory-result-count">{directoryMatches.length} {directoryMatches.length === 1 ? 'match' : 'matches'}</span>
            </div>
            <div className="seven-directory-grid">
              {directoryMatches.map((listing) => (
                <DirectoryListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        )}
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
        {data && data.length > 0 && (page > 1 || data.length >= pageSize) && (
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
        {data?.length === 0 && directoryMatches.length === 0 && (
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

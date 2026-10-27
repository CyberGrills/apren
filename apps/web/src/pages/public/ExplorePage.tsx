import type { Offering } from '@7even/contracts';
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
import { localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const { showError } = useFeedback();
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const page = Math.min(10000, Math.max(1, Math.trunc(Number(params.get('page')) || 1)));
  const pageSize = 12;
  const query = new URLSearchParams(params);
  query.set('pageSize', String(pageSize));
  query.set('page', String(page));
  query.set('kind', 'STAY');
  const { data, loading, error, reload } = useApi<Offering[]>(`/offerings?${query}`);
  function filter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dateError = stayDatesError(
      String(form.get('startDate') ?? ''),
      String(form.get('endDate') ?? ''),
    );
    if (dateError) {
      showError(dateError);
      return;
    }
    const next = new URLSearchParams();
    next.set('kind', 'STAY');
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
      const nextParams = new URLSearchParams(result.searchParams);
      nextParams.set('kind', 'STAY');
      nextParams.set('page', '1');
      setParams(nextParams);
    } catch (cause) {
      showError(
        cause instanceof Error ? cause.message : 'AI search is unavailable. Use the filters below.',
      );
    } finally {
      setAiLoading(false);
    }
  }
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="public-container explore-page">
        <div className="explore-heading">
          <span className="public-eyebrow">Find your next plan</span>
          <h1>Find your next stay.</h1>
          <p>Discover hotels and apartments across Nigeria with availability checked by 7even.</p>
        </div>
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
            <label htmlFor="explore-start">Check-in</label>
            <input
              id="explore-start"
              name="startDate"
              type="date"
              min={localDateNow()}
              defaultValue={params.get('startDate') ?? ''}
            />
          </div>
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
            Live room availability is checked on each search; the final quote confirms price and capacity.
          </span>
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
        {data?.length === 0 && (
          <EmptyState
            title="No places match this search yet."
            description="Try another city or date. Only verified 7even stays appear as bookable results."
            action={
              <button type="button" className="btn btn-secondary" onClick={() => setParams({ kind: 'STAY' })}>
                See all stays
              </button>
            }
          />
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

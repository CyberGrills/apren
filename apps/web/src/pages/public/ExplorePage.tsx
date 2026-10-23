import type { Offering } from '@7even/contracts';
import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorNotice, Loading, OfferingCard } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { localDateNow, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [aiMessage, setAiMessage] = useState(() => params.get('q') ?? '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const page = Math.min(10000, Math.max(1, Math.trunc(Number(params.get('page')) || 1)));
  const pageSize = 12;
  const query = new URLSearchParams(params);
  query.set('kind', 'STAY');
  query.delete('q');
  query.delete('tripPurpose');
  query.delete('maxBudgetNaira');
  query.set('pageSize', String(pageSize));
  query.set('page', String(page));
  const { data, loading, error, reload } = useApi<Offering[]>(`/offerings?${query}`);
  function filter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    next.set('kind', 'STAY');
    for (const key of ['city', 'startDate', 'endDate', 'rooms']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    setParams(next);
  }
  async function searchWithAssistant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (aiLoading || aiMessage.trim().length < 2) return;
    setAiLoading(true);
    setAiError(null);
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
        setAiError(result.intent.clarification);
        return;
      }
      setParams(new URLSearchParams({ ...result.searchParams, page: '1' }));
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : 'AI search is unavailable. Use the standard filters below.');
    } finally {
      setAiLoading(false);
    }
  }
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="public-container explore-page">
        <div className="explore-heading">
          <span className="public-eyebrow">Nigeria-first hotel discovery</span>
          <h1>Find your kind of stay.</h1>
          <p>Search hotel stays by destination, dates, budget and the kind of trip you have in mind.</p>
        </div>
        <form className="explore-filters explore-ai-search" onSubmit={searchWithAssistant}>
          <div className="explore-filter-heading">
            <Search size={17} aria-hidden="true" />
            <label htmlFor="explore-ai-query">Describe your stay</label>
          </div>
          <div>
            <input
              id="explore-ai-query"
              name="aiQuery"
              value={aiMessage}
              onChange={(event) => setAiMessage(event.target.value)}
              placeholder="e.g. Two nights in Lagos, a pool, and under ₦80,000"
              maxLength={2000}
              minLength={2}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={aiLoading || aiMessage.trim().length < 2}>
            {aiLoading ? 'Understanding your request…' : 'Search with AI'}
          </button>
          {aiError && <p className="explore-ai-error" role="status">{aiError}</p>}
          <p className="explore-ai-note">AI translates your request into search filters. Hotel availability, prices and booking confirmations come from 7even’s booking system.</p>
        </form>

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
            <label htmlFor="explore-start">Check-in</label>
            <input
              id="explore-start"
              name="startDate"
              type="date"
              min={localDateNow()}
              defaultValue={params.get('startDate') ?? ''}
            />
          </div>
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
            </>
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
          <span>Live room availability is checked on each search; the final quote confirms price and capacity.</span>
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
            title="No bookable hotel stays match this search yet."
            description="Try another Nigerian city or date. Only properties with bookable inventory can appear here."
            action={
              <button type="button" className="btn btn-secondary" onClick={() => { setAiMessage(''); setParams({ kind: 'STAY' }); }}>
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

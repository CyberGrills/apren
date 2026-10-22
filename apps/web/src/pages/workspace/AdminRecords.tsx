import type { AdminRecordsPage, Business, Reservation } from '@7even/contracts';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { EmptyState, ErrorNotice, Loading, Money, StatusBadge } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { dateLabel } from './shared.tsx';

type Collection = 'businesses' | 'payments' | 'reservations' | 'audit';

export function AdminRecords<T>({
  collection,
  endpoint,
  searchLabel,
  placeholder,
  statuses = [],
  children,
}: {
  collection: Collection;
  endpoint?: string;
  searchLabel: string;
  placeholder: string;
  statuses?: readonly string[];
  children: (items: T[]) => ReactNode;
}) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search) query.set('q', search);
  if (status) query.set('status', status);
  const { data, loading, error, reload } = useApi<AdminRecordsPage<T>>(
    `${endpoint ?? `/admin/records/${collection}`}?${query}`,
  );
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <section className="admin-records" aria-label={`${collection} records`}>
      <search aria-label={`Search ${collection}`}>
        <form
          className="toolbar admin-records-search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <input
            type="search"
            aria-label={searchLabel}
            placeholder={placeholder}
            maxLength={160}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {statuses.length > 0 && (
            <select
              aria-label={`${collection} status`}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item.toLowerCase().replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn btn-secondary">
            <Search size={16} aria-hidden="true" />
            Search
          </button>
          {(search || status || draft) && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setDraft('');
                setSearch('');
                setStatus('');
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={`Refresh ${collection}`}
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </form>
      </search>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {data && (
        <>
          <p className="small-copy admin-records-count" role="status">
            {data.total.toLocaleString('en-NG')} matching {data.total === 1 ? 'record' : 'records'}.
            Search includes the full history.
          </p>
          {data.items.length > 0 ? (
            children(data.items)
          ) : (
            <EmptyState
              title="No matching records."
              description={
                page > 1
                  ? 'Return to an earlier page or change your search.'
                  : 'Try another search or status.'
              }
            />
          )}
          <nav className="pagination admin-records-pagination" aria-label={`${collection} pages`}>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setPage((current) => current - 1)}
              disabled={loading || page <= 1}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Previous
            </button>
            <span className="small-copy">
              Page {data.page} of {totalPages.toLocaleString('en-NG')}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || page >= totalPages || page >= 10000}
            >
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

export function AdminReservationsTable({
  reservations,
  businesses,
}: {
  reservations: Reservation[];
  businesses: Business[];
}) {
  const names = new Map(businesses.map((business) => [business.id, business.businessName]));
  return (
    <section
      className="table-wrap"
      aria-label="All reservations. Scroll horizontally to see payment and totals."
      data-scrolls
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the reservation table.
      tabIndex={0}
    >
      <p className="table-scroll-cue">Scroll table for payment and totals →</p>
      <table>
        <thead>
          <tr>
            <th>Guest / reference</th>
            <th>Business / plan</th>
            <th>Service date</th>
            <th>Reservation</th>
            <th>Payment</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>
                <strong>{reservation.customerName}</strong>
                <small>{reservation.reference}</small>
              </td>
              <td>
                <strong>{names.get(reservation.businessId) ?? reservation.businessId}</strong>
                <small>{reservation.title}</small>
                <small>
                  {reservation.quantity}{' '}
                  {reservation.kind === 'STAY'
                    ? 'room(s)'
                    : reservation.kind === 'DINING'
                      ? 'guest(s)'
                      : 'seat(s)'}
                </small>
              </td>
              <td>
                {dateLabel(reservation.startDate)}
                {reservation.endDate && <small>to {dateLabel(reservation.endDate)}</small>}
              </td>
              <td>
                <StatusBadge status={reservation.status} />
              </td>
              <td>
                <StatusBadge status={reservation.paymentStatus} />
                <small>{reservation.settlementStatus.toLowerCase()}</small>
              </td>
              <td>
                <Money minor={reservation.price.totalMinor} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

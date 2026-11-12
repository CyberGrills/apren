import { useMemo, useState } from 'react';
import { Check, RefreshCw, Search, X } from 'lucide-react';
import { useFeedback } from '../../components/Feedback.tsx';
import { ErrorNotice, Loading, PageHeader } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { businessMediaApi, businessMediaRoutes, type BusinessMediaReviewItem } from '../../lib/businessMediaApi.ts';

type ReviewItem = BusinessMediaReviewItem;
interface ReviewResponse { items: ReviewItem[]; }

export function AdminBusinessMedia() {
  const { data, loading, error, reload } = useApi<ReviewResponse>(businessMediaRoutes.adminList);
  const [reasons, setReasons] = useState<Record<string,string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'REPLACEMENTS'>('ALL');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const { showSuccess } = useFeedback();
  const items = data?.items ?? [];
  const replacements = items.filter((item) => item.replacedMediaId).length;
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesSearch = [item.businessName, item.originalFilename, item.caption].join(' ').toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (filter === 'ALL' || Boolean(item.replacedMediaId));
  }), [items, search, filter]);

  async function decide(item: ReviewItem, decision: 'APPROVED' | 'REJECTED') {
    const reason = reasons[item.mediaId]?.trim() ?? '';
    if (decision === 'REJECTED' && !reason) {
      setActionError('Add a clear reason before rejecting a photo.');
      return;
    }
    setBusy(item.mediaId);
    setActionError('');
    try {
      await businessMediaApi.review(item.mediaId, decision, decision === 'REJECTED' ? reason : undefined);
      showSuccess(decision === 'APPROVED' ? 'Photo approved and published.' : 'Photo rejected.');
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The review decision could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  return <section className="admin-business-media">
    <PageHeader eyebrow="Platform management · Listing quality" title="Business photo review" description="Review original business-submitted images before they appear on public listings." actions={<button type="button" className="btn btn-secondary" onClick={reload}><RefreshCw size={15}/> Refresh queue</button>} />
    {error && <ErrorNotice message={error} retry={reload}/>}
    {actionError && <ErrorNotice message={actionError}/>}
    {loading && <Loading/>}
    {!loading && !error && <>
      <div className="admin-media-summary" aria-label="Photo review summary">
        <div><strong>{items.length}</strong><span>Awaiting review</span></div>
        <div><strong>{replacements}</strong><span>Replacement photos</span></div>
      </div>
      <div className="admin-media-toolbar">
        <label className="admin-media-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search photo submissions</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business, filename or caption"/></label>
        <div className="admin-media-filters" role="group" aria-label="Filter photo submissions">
          <button type="button" className={filter === 'ALL' ? 'active' : ''} aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>All photos <span>{items.length}</span></button>
          <button type="button" className={filter === 'REPLACEMENTS' ? 'active' : ''} aria-pressed={filter === 'REPLACEMENTS'} onClick={() => setFilter('REPLACEMENTS')}>Replacements <span>{replacements}</span></button>
        </div>
      </div>
    </> }
    {!loading && !error && (filteredItems.length ? <div className="admin-media-grid">{filteredItems.map(item => <article className="admin-media-card" key={item.mediaId}>
      {item.imageUrl ? <img src={item.imageUrl} alt={item.altText}/> : <div className="admin-media-placeholder">Private preview unavailable</div>}
      <div className="admin-media-copy">
        <p className="eyebrow">{item.businessName}</p>
        <h2>{item.originalFilename}</h2>
        <p>{item.caption || 'No caption supplied'}</p>
        <p className="small-copy">Alt text: {item.altText}</p>
        <p className="admin-media-file-meta">{item.mimeType} · {(item.byteSize / 1024 / 1024).toFixed(1)} MB · Submitted {new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</p>
        {item.replacedMediaId && <p className="tag">Replacement image · existing photo remains live until approval</p>}
        <label>Reason for rejection
          <textarea value={reasons[item.mediaId] ?? ''} maxLength={500} rows={2} onChange={event => setReasons(current => ({...current,[item.mediaId]:event.target.value}))} placeholder="Explain what needs to change"/>
        </label>
        <div className="admin-media-actions">
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => void decide(item,'APPROVED')}><Check size={15}/> Approve</button>
          <button type="button" className="btn btn-secondary" disabled={!!busy || !(reasons[item.mediaId] ?? '').trim()} onClick={() => void decide(item,'REJECTED')}><X size={15}/> Reject</button>
        </div>
      </div>
    </article>)}</div> : <div className="workspace-empty"><h3>{items.length ? 'No matching submissions.' : 'The review queue is clear.'}</h3><p>{items.length ? 'Try another search or filter.' : 'New business photos will appear here after upload completion.'}</p></div>)}
  </section>;
}

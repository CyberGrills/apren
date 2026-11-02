import { useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { useFeedback } from '../../components/Feedback.tsx';
import { ErrorNotice, Loading, PageHeader } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';

interface ReviewItem {
  mediaId: string;
  businessId: string;
  businessName: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  caption: string;
  altText: string;
  createdAt: string;
  replacedMediaId: string | null;
  imageUrl: string | null;
}
interface ReviewResponse { items: ReviewItem[]; }

export function AdminBusinessMedia() {
  const { data, loading, error, reload } = useApi<ReviewResponse>('/admin/business-media');
  const [reasons, setReasons] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const { showSuccess } = useFeedback();

  async function decide(item: ReviewItem, decision: 'APPROVED' | 'REJECTED') {
    const reason = reasons[item.mediaId]?.trim() ?? '';
    if (decision === 'REJECTED' && !reason) {
      setActionError('Add a clear reason before rejecting a photo.');
      return;
    }
    setBusy(item.mediaId);
    setActionError('');
    try {
      await api('/admin/business-media/' + item.mediaId + '/review', {
        method: 'PATCH',
        body: { decision, ...(decision === 'REJECTED' ? { reason } : {}) },
      });
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
    {!loading && (data?.items.length ? <div className="admin-media-grid">{data.items.map(item => <article className="admin-media-card" key={item.mediaId}>
      {item.imageUrl ? <img src={item.imageUrl} alt={item.altText}/> : <div className="admin-media-placeholder">Private preview unavailable</div>}
      <div className="admin-media-copy">
        <p className="eyebrow">{item.businessName}</p>
        <h2>{item.originalFilename}</h2>
        <p>{item.caption || 'No caption supplied'}</p>
        <p className="small-copy">Alt text: {item.altText}</p>
        {item.replacedMediaId && <p className="tag">Replacement image · existing photo remains live until approval</p>}
        <label>Reason for rejection
          <textarea value={reasons[item.mediaId] ?? ''} maxLength={500} rows={2} onChange={event => setReasons(current => ({...current,[item.mediaId]:event.target.value}))} placeholder="Explain what needs to change"/>
        </label>
        <div className="admin-media-actions">
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => void decide(item,'APPROVED')}><Check size={15}/> Approve</button>
          <button type="button" className="btn btn-secondary" disabled={!!busy || !(reasons[item.mediaId] ?? '').trim()} onClick={() => void decide(item,'REJECTED')}><X size={15}/> Reject</button>
        </div>
      </div>
    </article>)}</div> : <div className="workspace-empty"><h3>The review queue is clear.</h3><p>New business photos will appear here after upload completion.</p></div>)}
  </section>;
}

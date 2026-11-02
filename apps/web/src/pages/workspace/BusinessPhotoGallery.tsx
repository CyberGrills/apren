import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, RefreshCw, Star, Trash2, Upload } from 'lucide-react';
import { useFeedback } from '../../components/Feedback.tsx';
import { ErrorNotice, Loading } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';

type MediaStatus = 'PENDING_UPLOAD' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'REMOVED';
interface BusinessMedia {
  mediaId: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  caption: string;
  altText: string;
  status: MediaStatus;
  rejectionReason: string | null;
  sortOrder: number;
  isCover: boolean;
  imageUrl: string | null;
  createdAt: string;
}
interface MediaResponse { items: BusinessMedia[]; }
interface UploadIntent {
  mediaId: string;
  uploadUrl: string;
  token: string;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}
interface QueuedPhoto { id: string; file: File; preview: string; caption: string; altText: string; progress: number; replacesMediaId?: string; }
const accepted = 'image/jpeg,image/png,image/webp,image/avif';
const maxBytes = 10 * 1024 * 1024;

function statusLabel(status: MediaStatus) {
  return ({
    PENDING_UPLOAD: 'Upload pending',
    PENDING_REVIEW: 'Awaiting review',
    APPROVED: 'Approved',
    REJECTED: 'Changes required',
    REMOVED: 'Removed',
  })[status];
}
function uploadBinary(intent: UploadIntent, file: File, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const signedTarget = new URL(intent.uploadUrl);
    signedTarget.searchParams.set('token', intent.token);
    request.open('PUT', signedTarget.toString());
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error('Network error while uploading this photo.'));
    request.onabort = () => reject(new Error('Photo upload was cancelled.'));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error('Secure storage rejected this upload. Please retry.'));
    };
    request.send(file);
  });
}

export function BusinessPhotoGallery() {
  const { data, loading, error, reload } = useApi<MediaResponse>('/business/media');
  const [queued, setQueued] = useState<QueuedPhoto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const { showSuccess } = useFeedback();
  const items = data?.items ?? [];
  const approved = useMemo(() => items.filter((item) => item.status === 'APPROVED'), [items]);
  const pending = items.filter((item) => item.status === 'PENDING_REVIEW');
  const rejected = items.filter((item) => item.status === 'REJECTED');

  function chooseFiles(files: FileList | null, replacesMediaId?: string) {
    if (!files) return;
    const next: QueuedPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > maxBytes) {
        setActionError(file.name + ' is not a supported image or exceeds 10 MB.');
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), caption: '', altText: '', progress: 0, replacesMediaId });
    }
    setQueued((current) => [...current, ...next]);
  }
  function updateQueued(id: string, patch: Partial<QueuedPhoto>) {
    setQueued((current) => current.map((photo) => photo.id === id ? { ...photo, ...patch } : photo));
  }
  function removeQueued(id: string) {
    setQueued((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return current.filter((item) => item.id !== id);
    });
  }
  async function uploadAll() {
    setActionError('');
    for (const photo of queued) {
      if (photo.altText.trim().length < 3) {
        setActionError('Add meaningful alt text to every selected photo before uploading.');
        return;
      }
    }
    for (const photo of queued) {
      setBusy(photo.id);
      try {
        const intent = await api<UploadIntent>('/business/media/upload-intents', {
          method: 'POST',
          body: { filename: photo.file.name, mimeType: photo.file.type, byteSize: photo.file.size, caption: photo.caption, altText: photo.altText, ...(photo.replacesMediaId ? { replacesMediaId: photo.replacesMediaId } : {}) },
        });
        await uploadBinary(intent, photo.file, (progress) => updateQueued(photo.id, { progress }));
        await api<{ mediaId: string; status: MediaStatus }>('/business/media/' + intent.mediaId + '/complete', { method: 'POST', body: {} });
        removeQueued(photo.id);
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : 'Could not upload this photo.');
        break;
      } finally {
        setBusy(null);
      }
    }
    reload();
    if (allUploaded) showSuccess('Your photos have been submitted for review.');
  }
  async function mutate(path: string, method: 'PATCH' | 'DELETE', body?: unknown) {
    setBusy(path);
    setActionError('');
    try {
      await api(path, { method, body });
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'That gallery change could not be saved.');
    } finally {
      setBusy(null);
    }
  }
  async function updateDetails(item: BusinessMedia, form: HTMLFormElement) {
    const values = new FormData(form);
    await mutate('/business/media/' + item.mediaId, 'PATCH', {
      caption: String(values.get('caption') ?? ''),
      altText: String(values.get('altText') ?? ''),
    });
  }
  async function reorder(item: BusinessMedia, direction: -1 | 1) {
    const ordered = [...approved].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((photo) => photo.mediaId === item.mediaId);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await mutate('/business/media/order', 'PATCH', { mediaIds: ordered.map((photo) => photo.mediaId) });
  }

  return (
    <section className="business-photo-gallery">
      {error && <ErrorNotice message={error} retry={reload} />}
      {actionError && <ErrorNotice message={actionError} retry={() => setActionError('')} />}
      <div className="business-photo-guidance">
        <div><strong>Accepted formats</strong><span>JPEG, PNG, WebP or AVIF · up to 10 MB each</span></div>
        <div><strong>Review process</strong><span>Only approved photos appear on your public listing.</span></div>
      </div>
      <section className="business-photo-upload panel" aria-labelledby="photo-upload-heading">
        <div className="business-photo-upload-heading"><div><p className="eyebrow">Add to your listing</p><h2 id="photo-upload-heading">Upload property photos</h2><p className="small-copy">Choose several images from your phone or computer. Add a short caption and useful alt text for each one.</p></div><ImagePlus size={30} aria-hidden="true" /></div>
        <label className="business-photo-drop">
          <Upload size={23} aria-hidden="true" />
          <strong>Choose photos</strong>
          <span>Browse files on this device</span>
          <input type="file" accept={accepted} multiple onChange={(event) => { chooseFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
        </label>
        {queued.length > 0 && <div className="business-photo-queue">
          {queued.map((photo) => <article className="business-photo-queue-item" key={photo.id}>
            <img src={photo.preview} alt="" />
            <div className="business-photo-queue-fields">
              <strong>{photo.file.name}</strong><span>{(photo.file.size / 1024 / 1024).toFixed(1)} MB</span>
              <label>Caption <input value={photo.caption} maxLength={300} onChange={(event) => updateQueued(photo.id, { caption: event.target.value })} placeholder="A bright, comfortable guest room" /></label>
              <label>Alt text <input value={photo.altText} maxLength={300} onChange={(event) => updateQueued(photo.id, { altText: event.target.value })} placeholder="Describe what is visible in this photo" required /></label>
              {busy === photo.id && <div className="business-photo-progress" role="status"><span style={{ width: photo.progress + '%' }} /> <small>{photo.progress}%</small></div>}
            </div>
            <button type="button" className="icon-button" aria-label={'Remove ' + photo.file.name} onClick={() => removeQueued(photo.id)} disabled={busy === photo.id}><Trash2 size={17} /></button>
          </article>)}
          <div className="business-photo-queue-actions"><span>{queued.length} photo{queued.length === 1 ? '' : 's'} ready</span><button type="button" className="btn btn-primary" onClick={() => void uploadAll()} disabled={!!busy || queued.some((photo) => photo.altText.trim().length < 3)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />} Submit for review</button></div>
        </div>}
      </section>
      {loading && <Loading />}
      {!loading && <section className="business-photo-section" aria-labelledby="approved-heading">
        <div className="section-heading"><div><p className="eyebrow">Guest-facing gallery</p><h2 id="approved-heading">Approved photos <span>{approved.length}</span></h2></div><button type="button" className="text-button" onClick={reload}><RefreshCw size={14} /> Refresh</button></div>
        {approved.length === 0 ? <p className="small-copy">No approved photos yet. Submit your first images for review.</p> : <div className="business-photo-grid">
          {[...approved].sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder).map((item, index) => <article className="business-photo-card" key={item.mediaId}>
            {item.imageUrl ? <img src={item.imageUrl} alt={item.altText} /> : <div className="business-photo-placeholder">Photo preview unavailable</div>}
            <div className="business-photo-card-body"><div className="business-photo-card-title"><span>{item.isCover ? 'Cover photo' : 'Gallery photo'}</span>{item.isCover && <Star size={14} fill="currentColor" />}</div>
              <form onSubmit={(event) => { event.preventDefault(); void updateDetails(item, event.currentTarget); }}>
                <label>Caption <input name="caption" defaultValue={item.caption} maxLength={300} /></label>
                <label>Alt text <input name="altText" defaultValue={item.altText} minLength={3} maxLength={300} required /></label>
                <button type="submit" className="text-button" disabled={!!busy}>Save details</button>
              </form>
              <div className="business-photo-card-actions">
                {!item.isCover && <button type="button" className="text-button" onClick={() => void mutate('/business/media/' + item.mediaId + '/cover', 'PATCH', {})} disabled={!!busy}><Star size={14} /> Set cover</button>}
                <label className="text-button business-photo-replace">Replace<input type="file" accept={accepted} onChange={(event) => { chooseFiles(event.currentTarget.files, item.mediaId); event.currentTarget.value = ''; }} /></label>
                <button type="button" className="icon-button" aria-label="Move photo earlier" disabled={!!busy || index === 0} onClick={() => void reorder(item, -1)}><ArrowUp size={16} /></button>
                <button type="button" className="icon-button" aria-label="Move photo later" disabled={!!busy || index === approved.length - 1} onClick={() => void reorder(item, 1)}><ArrowDown size={16} /></button>
                <button type="button" className="text-button" onClick={() => { if (window.confirm('Remove this photo from your listing?')) void mutate('/business/media/' + item.mediaId, 'DELETE'); }} disabled={!!busy}><Trash2 size={14} /> Remove</button>
              </div>
            </div>
          </article>)}
        </div>}
      </section>}
      <section className="business-photo-section" aria-labelledby="review-heading">
        <div className="section-heading"><div><p className="eyebrow">Moderation status</p><h2 id="review-heading">Under review <span>{pending.length}</span></h2></div></div>
        {pending.length === 0 ? <p className="small-copy">No photos are waiting for review.</p> : <ul className="business-photo-status-list">{pending.map((item) => <li key={item.mediaId}><div><strong>{item.originalFilename}</strong><span>{item.caption || 'No caption'} · {statusLabel(item.status)}</span></div><span className="tag">Pending review</span></li>)}</ul>}
        {rejected.length > 0 && <><h3>Needs attention</h3><ul className="business-photo-status-list">{rejected.map((item) => <li key={item.mediaId}><div><strong>{item.originalFilename}</strong><span>{item.rejectionReason || 'Please review and replace this photo.'}</span></div><span className="tag">Rejected</span></li>)}</ul></>}
      </section>
    </section>
  );
}

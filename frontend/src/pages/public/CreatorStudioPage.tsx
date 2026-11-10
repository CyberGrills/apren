import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, LoaderCircle, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorNotice, Loading, PageHeader, StatusBadge, useFeedback } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { creatorApi, type CreatorArtwork, type CreatorArtworkSummary, type CreatorMedia, type CreatorProfile, type CreatorUploadIntent } from '../../lib/creatorApi.ts';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

const disciplines = [
  ['DIGITAL_ART', 'Digital art'], ['PHOTOGRAPHY', 'Photography'], ['FASHION_DESIGN', 'Fashion & design'],
  ['ILLUSTRATION', 'Illustration'], ['SCULPTURE', 'Sculpture'], ['PAINTING', 'Painting'],
  ['TEXTILE_ART', 'Textile art'], ['CRAFT', 'Craft'], ['HERITAGE_STORY', 'Heritage & stories'], ['OTHER', 'Other'],
] as const;
const accepted = 'image/jpeg,image/png,image/webp,image/avif';
const maxBytes = 10 * 1024 * 1024;
type QueuedImage = { id: string; file: File; preview: string; caption: string; altText: string; progress: number; isCover: boolean };
const freshConfirmations = () => ({ confirmRightsAndPermissions: false, confirmAccurateAttribution: false, confirmCulturalCare: false, confirmPublicVisibility: false });
type RightsEvidence = { evidence_id: string; evidence_type: string; issuer_name: string; evidence_reference: string; description: string; status: string; review_reason?: string | null };
type RightsResponse = { evidence?: RightsEvidence[]; communityPermissions?: Array<{ permission_id: string; community_name: string; authority_name: string; permission_scope: string; evidence_reference: string; cultural_context: string; status: string; review_reason?: string | null }>; attributionReviews?: Array<{ attribution_review_id: string; attribution_text: string; source_description: string; status: string; review_reason?: string | null }> };

function uploadBinary(intent: CreatorUploadIntent, file: File, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const target = new URL(intent.uploadUrl);
    target.searchParams.set('token', intent.token);
    request.open('PUT', target.toString());
    for (const [name, value] of Object.entries({ 'Content-Type': file.type, 'x-upsert': 'false', ...intent.requiredHeaders })) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error('Network error while uploading this image.'));
    request.onabort = () => reject(new Error('Image upload was cancelled.'));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Secure storage rejected this image. Please retry.'));
    request.send(file);
  });
}

export function CreatorStudioPage() {
  const { data: profileData, loading: profileLoading, error: profileError, reload: reloadProfile } = useApi<{ creator: CreatorProfile | null }>('/creator/profile');
  const { data: artworkData, loading: artworkLoading, error: artworkError, reload: reloadArtworks } = useApi<{ items: CreatorArtworkSummary[]; nextCursor: string | null }>('/creator/artworks?limit=50');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newArtwork, setNewArtwork] = useState(false);
  const { data: detailData, loading: detailLoading, error: detailError, reload: reloadDetail } = useApi<{ artwork: CreatorArtwork }>(activeId ? `/creator/artworks/${encodeURIComponent(activeId)}` : null);
  const { data: rightsData, loading: rightsLoading, reload: reloadRights } = useApi<RightsResponse>(activeId ? `/creator/artworks/${encodeURIComponent(activeId)}/rights` : null);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [queued, setQueued] = useState<QueuedImage[]>([]);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [submitConfirmations, setSubmitConfirmations] = useState(freshConfirmations);
  const creator = profileData?.creator ?? null;
  const artwork = detailData?.artwork ?? null;
  const artworks = artworkData?.items ?? [];
  const canEditProfile = !creator || ['DRAFT', 'CHANGES_REQUESTED'].includes(creator.profileStatus);
  const canEditArtwork = !artwork || ['DRAFT', 'CHANGES_REQUESTED'].includes(artwork.status ?? 'DRAFT');
  const rights = useMemo(() => rightsData ?? {}, [rightsData]);
  const requiresCulturalReview = Boolean(artwork?.contentNotice?.containsSensitiveCulturalMaterial) || (Array.isArray(artwork?.contentNotice?.publicDisplayRestrictions) && artwork.contentNotice.publicDisplayRestrictions.length > 0);
  const rightsEvidenceReady = Boolean(artwork && (artwork.rights.basis === 'ORIGINAL' || rights.evidence?.some((item) => item.status === 'VERIFIED' && item.evidence_type === (artwork.rights.basis === 'LICENSED' ? 'LICENSE' : 'AUTHORIZED_REPRESENTATIVE'))) && (artwork.rights.communityPermission === 'NOT_REQUIRED' || (artwork.rights.communityPermission === 'OBTAINED' && rights.communityPermissions?.some((item) => item.status === 'APPROVED'))) && !['PENDING', 'NOT_SURE'].includes(artwork.rights.communityPermission) && rights.attributionReviews?.some((item) => item.status === 'VERIFIED' && item.attribution_text === artwork.rights.attributionText));
  const allSubmissionConfirmations = Object.values(submitConfirmations).every(Boolean);
  const { showSuccess } = useFeedback();

  const queuedRef = useRef<QueuedImage[]>([]);
  useEffect(() => { queuedRef.current = queued; }, [queued]);
  useEffect(() => () => { for (const image of queuedRef.current) URL.revokeObjectURL(image.preview); }, []);
  function refreshAll() { reloadProfile(); reloadArtworks(); reloadDetail(); reloadRights(); }
  function updateQueued(id: string, patch: Partial<QueuedImage>) { setQueued((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function removeQueued(id: string) { setQueued((items) => { const image = items.find((item) => item.id === id); if (image) URL.revokeObjectURL(image.preview); return items.filter((item) => item.id !== id); }); }
  function chooseImages(files: FileList | null) {
    if (!files) return;
    const next: QueuedImage[] = [];
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > maxBytes) {
        setActionError(`${file.name} is not a supported image or exceeds 10 MB.`); continue;
      }
      next.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), caption: '', altText: '', progress: 0, isCover: !artwork?.media?.some((media) => media.isCover) && next.length === 0 });
    }
    setQueued((items) => [...items, ...next].slice(0, Math.max(0, 10 - (artwork?.media?.filter((item) => item.status !== 'REMOVED').length ?? 0))));
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    setBusy('profile'); setActionError('');
    try {
      const portfolioUrls = String(values.get('portfolioUrls') ?? '').split('\n').map((value) => value.trim()).filter(Boolean);
      await creatorApi.saveProfile({
        displayName: String(values.get('displayName') ?? ''),
        location: { city: String(values.get('city') ?? ''), region: String(values.get('region') ?? ''), countryCode: String(values.get('countryCode') ?? 'NG').toUpperCase() },
        disciplines: values.getAll('disciplines').map(String), biography: String(values.get('biography') ?? ''), portfolioUrls,
      });
      showSuccess('Creator profile saved.'); refreshAll();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Creator profile could not be saved.'); }
    finally { setBusy(''); }
  }
  async function submitProfile() {
    setBusy('profile-submit'); setActionError('');
    try { await creatorApi.submitProfile(); showSuccess('Creator profile submitted for review.'); refreshAll(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Creator profile could not be submitted.'); }
    finally { setBusy(''); }
  }
  async function saveArtwork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const payload = {
      title: String(values.get('title') ?? ''), discipline: String(values.get('discipline') ?? 'DIGITAL_ART') as CreatorArtwork['discipline'],
      description: String(values.get('description') ?? ''), creationYear: String(values.get('creationYear') ?? '').trim() ? Number(values.get('creationYear')) : null,
      origin: { place: String(values.get('origin') ?? '') }, culturalContext: String(values.get('culturalContext') ?? ''),
      tags: String(values.get('tags') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
      accessibilityText: String(values.get('accessibilityText') ?? ''),
      rights: { basis: String(values.get('basis') ?? 'ORIGINAL') as CreatorArtwork['rights']['basis'], rightsConfirmed: true as const,
        attributionText: String(values.get('attributionText') ?? ''), thirdPartyPermissions: String(values.get('thirdPartyPermissions') ?? ''),
        communityPermission: String(values.get('communityPermission') ?? 'NOT_REQUIRED') as CreatorArtwork['rights']['communityPermission'],
        communityPermissionDetails: String(values.get('communityPermissionDetails') ?? ''),
        displayLicense: String(values.get('displayLicense') ?? 'ALL_RIGHTS_RESERVED') as CreatorArtwork['rights']['displayLicense'] },
      contentNotice: { containsSensitiveCulturalMaterial: values.get('sensitiveCulturalMaterial') === 'on', publicDisplayRestrictions: [] },
    };
    setBusy('artwork-save'); setActionError('');
    try {
      if (activeId) await creatorApi.updateArtwork(activeId, payload);
      else { const result = await creatorApi.createArtwork(payload); setSubmitConfirmations(freshConfirmations()); setActiveId(result.artwork.artworkId); setNewArtwork(false); }
      showSuccess('Artwork draft saved.'); reloadArtworks(); reloadDetail();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Artwork draft could not be saved.'); }
    finally { setBusy(''); }
  }
  async function uploadImages() {
    if (!activeId) { setActionError('Save the artwork draft before adding images.'); return; }
    if (queued.some((image) => image.altText.trim().length < 3)) { setActionError('Add meaningful alt text to every selected image before uploading.'); return; }
    setActionError(''); let complete = true;
    for (const image of queued) {
      setBusy(image.id);
      try {
        const intent = await creatorApi.createUploadIntent(activeId, { filename: image.file.name, mimeType: image.file.type, byteSize: image.file.size, caption: image.caption, accessibilityText: image.altText, isCover: image.isCover });
        await uploadBinary(intent, image.file, (progress) => updateQueued(image.id, { progress }));
        await creatorApi.completeUpload(activeId, intent.mediaId);
        removeQueued(image.id);
      } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not upload this image.'); complete = false; break; }
      finally { setBusy(''); }
    }
    if (complete) showSuccess('Artwork images uploaded and queued for review.'); refreshAll();
  }
  async function submitArtwork() {
    if (!activeId) return;
    setBusy('artwork-submit'); setActionError('');
    if (!allSubmissionConfirmations) { setActionError('Confirm each submission statement before sending this artwork for review.'); setBusy(''); return; }
    if (!rightsEvidenceReady || requiresCulturalReview) { setActionError('Resolve the outstanding rights, attribution or cultural review requirements before submission.'); setBusy(''); return; }
    try { await creatorApi.submitArtwork(activeId, { confirmRightsAndPermissions: true, confirmAccurateAttribution: true, confirmCulturalCare: true, confirmPublicVisibility: true }); showSuccess('Artwork submitted for review.'); refreshAll(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Artwork could not be submitted.'); }
    finally { setBusy(''); }
  }
  async function addRightsEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeId) return; const values = new FormData(event.currentTarget);
    setBusy('rights'); setActionError('');
    try {
      await creatorApi.addRightsEvidence(activeId, { evidenceType: String(values.get('evidenceType') ?? 'OWNERSHIP') as 'LICENSE' | 'OWNERSHIP' | 'AUTHORIZED_REPRESENTATIVE' | 'SOURCE_PERMISSION' | 'OTHER', issuerName: String(values.get('issuerName') ?? ''), evidenceReference: String(values.get('evidenceReference') ?? ''), description: String(values.get('description') ?? '') });
      event.currentTarget.reset(); showSuccess('Rights evidence reference submitted for moderator review.'); reloadRights();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Rights evidence could not be submitted.'); }
    finally { setBusy(''); }
  }
  async function addAttribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeId) return; const values = new FormData(event.currentTarget);
    setBusy('rights'); setActionError('');
    try { await creatorApi.submitAttribution(activeId, { attributionText: String(values.get('attributionText') ?? ''), sourceDescription: String(values.get('sourceDescription') ?? '') }); showSuccess('Attribution submitted for moderator verification.'); reloadRights(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Attribution could not be submitted.'); }
    finally { setBusy(''); }
  }
  async function addCommunityPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeId) return; const values = new FormData(event.currentTarget);
    setBusy('rights'); setActionError('');
    try {
      await creatorApi.addCommunityPermission(activeId, { communityName: String(values.get('communityName') ?? ''), authorityName: String(values.get('authorityName') ?? ''), permissionScope: String(values.get('permissionScope') ?? ''), evidenceReference: String(values.get('communityEvidenceReference') ?? ''), culturalContext: String(values.get('permissionCulturalContext') ?? '') });
      event.currentTarget.reset(); showSuccess('Community permission record submitted for moderator review.'); reloadRights();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Community permission record could not be submitted.'); }
    finally { setBusy(''); }
  }
  async function moveMedia(mediaId: string, direction: -1 | 1) {
    if (!activeId || !artwork) return;
    const ordered = artwork.media.filter((item) => item.status === 'READY_FOR_REVIEW').sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((item) => item.mediaId === mediaId); const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const moving = ordered[index]; const displaced = ordered[target];
    if (!moving || !displaced) return;
    ordered[index] = displaced; ordered[target] = moving;
    setBusy('media-order'); setActionError('');
    try { await creatorApi.reorderMedia(activeId, ordered.map((item) => item.mediaId)); refreshAll(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Image order could not be saved.'); }
    finally { setBusy(''); }
  }

  return (
    <div className="public-page creator-studio-page">
      <PublicHeader />
      <main id="main-content" className="public-container creator-studio-main">
        <PageHeader eyebrow="7EVEN CAMPUS CONNECT · CREATOR STUDIO" title="Your work. Your story. Your rights." description="Create a verified creator profile, prepare artwork drafts and submit work for careful review. Only verified creators and approved artworks can appear publicly." actions={<Link className="btn btn-secondary" to="/campus-connect/art-culture">Explore Art & Culture <ArrowRight size={16} /></Link>} />
        {(profileError || artworkError || detailError) && <ErrorNotice message={profileError ?? artworkError ?? detailError ?? 'Could not load creator information.'} retry={refreshAll} />}
        {actionError && <ErrorNotice message={actionError} />}
        {(profileLoading || artworkLoading) && <Loading />}
        {creator && <div className="creator-status-strip"><div><span className="eyebrow">PROFILE REVIEW STATUS</span><StatusBadge status={creator.profileStatus} /><p>{creator.profileStatus === 'VERIFIED' ? 'Your public creator profile is verified.' : creator.profileStatus === 'PENDING_REVIEW' ? 'Your profile is with the review team. Editing is locked while it is under review.' : creator.profileStatus === 'CHANGES_REQUESTED' ? 'Review feedback is available. Update your profile and submit it again.' : 'Complete your profile and submit it when it is ready.'}</p></div><div className="creator-profile-link">{creator.profileStatus === 'VERIFIED' && <Link to={`/creators/${encodeURIComponent(creator.slug)}`}>View public creator page <ArrowRight size={15} /></Link>}</div></div>}

        <section className="creator-studio-section" aria-labelledby="creator-profile-heading">
          <div className="creator-section-heading"><div><p className="eyebrow">01 · CREATOR IDENTITY</p><h2 id="creator-profile-heading">Creator profile</h2><p>Use the name and location you want audiences to see. Add a short biography and links to your existing portfolio.</p></div></div>
          <form className="creator-form panel" onSubmit={(event) => void saveProfile(event)}>
            <div className="creator-form-grid">
              <label>Display name<input name="displayName" required minLength={2} maxLength={80} defaultValue={creator?.displayName ?? ''} disabled={!canEditProfile || !!busy} /></label>
              <label>City<input name="city" required maxLength={100} defaultValue={creator?.location.city ?? ''} disabled={!canEditProfile || !!busy} /></label>
              <label>State / region<input name="region" maxLength={100} defaultValue={creator?.location.region ?? ''} disabled={!canEditProfile || !!busy} /></label>
              <label>Country code<input name="countryCode" required pattern="[A-Za-z]{2}" maxLength={2} defaultValue={creator?.location.countryCode ?? 'NG'} disabled={!canEditProfile || !!busy} /></label>
            </div>
            <fieldset disabled={!canEditProfile || !!busy}><legend>Creative disciplines</legend><div className="creator-checkbox-grid">{disciplines.map(([value, label]) => <label key={value}><input type="checkbox" name="disciplines" value={label} defaultChecked={creator?.disciplines.includes(label) ?? false} />{label}</label>)}</div></fieldset>
            <label>Biography<textarea name="biography" required minLength={30} maxLength={1500} rows={5} defaultValue={creator?.biography ?? ''} disabled={!canEditProfile || !!busy} placeholder="Tell audiences about your practice, influences and the stories behind your work." /></label>
            <label>Portfolio links <span className="creator-help">One HTTPS link per line · up to five</span><textarea name="portfolioUrls" rows={3} defaultValue={creator?.portfolioUrls.join('\n') ?? ''} disabled={!canEditProfile || !!busy} placeholder="https://your-portfolio.example" /></label>
            {canEditProfile && <div className="creator-form-actions"><button className="btn btn-primary" type="submit" disabled={!!busy}>{busy === 'profile' ? <LoaderCircle className="spin" size={16} /> : null}Save profile</button>{creator && <button className="btn btn-secondary" type="button" onClick={() => void submitProfile()} disabled={!!busy || creator.profileStatus === 'PENDING_REVIEW'}>Submit for verification</button>}</div>}
          </form>
        </section>

        <section className="creator-studio-section" aria-labelledby="creator-artworks-heading">
          <div className="creator-section-heading creator-section-heading-row"><div><p className="eyebrow">02 · ARTWORK WORKSPACE</p><h2 id="creator-artworks-heading">Your artwork drafts</h2><p>Prepare one artwork at a time. Add images, complete rights declarations and submit for review when ready.</p></div><button className="btn btn-primary" type="button" disabled={!creator || creator.profileStatus === 'PENDING_REVIEW' || ['REJECTED', 'SUSPENDED'].includes(creator.profileStatus) || !!busy} onClick={() => { setSubmitConfirmations(freshConfirmations()); setActiveId(null); setNewArtwork(true); }}> <ImagePlus size={16} /> New artwork</button></div>
          {!creator && !profileLoading && <p className="creator-inline-note">Save your creator profile before creating artwork drafts.</p>}
          {artworks.length > 0 && <div className="creator-artwork-list">{artworks.map((item) => <button type="button" key={item.artworkId} className={activeId === item.artworkId ? 'creator-artwork-list-item is-active' : 'creator-artwork-list-item'} onClick={() => { setSubmitConfirmations(freshConfirmations()); setActiveId(item.artworkId); setNewArtwork(false); setQueued([]); }}><span><strong>{item.title}</strong><small>{disciplines.find(([value]) => value === item.discipline)?.[1] ?? item.discipline}</small></span><StatusBadge status={item.status} /></button>)}</div>}
          {artworkLoading && <Loading />}
          {newArtwork && <form key="new-artwork" className="creator-form panel" onSubmit={(event) => void saveArtwork(event)}>
            <div className="creator-form-heading"><h3>Create artwork draft</h3><button type="button" className="text-button" onClick={() => setNewArtwork(false)}>Cancel</button></div>
            <ArtworkFields artwork={null} disabled={!!busy} />
            <div className="creator-form-actions"><button type="submit" className="btn btn-primary" disabled={!!busy}>Save draft and continue</button></div>
          </form>}
          {activeId && detailLoading && <Loading />}
          {activeId && artwork && <div className="creator-artwork-editor">
            <form key={artwork.artworkId} className="creator-form panel" onSubmit={(event) => void saveArtwork(event)}>
              <div className="creator-form-heading"><div><h3>{artwork.title}</h3><StatusBadge status={artwork.status ?? 'DRAFT'} /></div><button type="button" className="text-button" onClick={() => { setSubmitConfirmations(freshConfirmations()); setActiveId(null); setNewArtwork(false); }}>Close draft <ArrowLeft size={14} /></button></div>
              <ArtworkFields artwork={artwork} disabled={!canEditArtwork || !!busy} />
              {canEditArtwork && <div className="creator-form-actions"><button type="submit" className="btn btn-primary" disabled={!!busy}>Save changes</button></div>}
              {artwork.reviewFeedback && artwork.reviewFeedback.length > 0 && <section className="creator-feedback" aria-labelledby="creator-feedback-heading"><h4 id="creator-feedback-heading">Review feedback</h4>{artwork.reviewFeedback.map((item) => <p key={`${item.category}-${item.message}`}><strong>{item.category.replaceAll('_', ' ')}:</strong> {item.message}</p>)}</section>}
            </form>
            <section className="creator-form panel" aria-labelledby="creator-media-heading"><div className="creator-form-heading"><div><h3 id="creator-media-heading">Artwork images</h3><p>JPEG, PNG, WebP or AVIF · 10 MB max each · up to 10 images</p></div><ImagePlus size={24} /></div>
              {canEditArtwork && <label className="creator-upload-drop"><Upload size={22} /><strong>Select artwork images</strong><span>Choose multiple images from your phone or computer</span><input type="file" accept={accepted} multiple onChange={(event) => { chooseImages(event.currentTarget.files); event.currentTarget.value = ''; }} /></label>}
              {queued.length > 0 && <div className="creator-upload-queue">{queued.map((image) => <article className="creator-upload-item" key={image.id}><img src={image.preview} alt="Preview of selected artwork" /><div><strong>{image.file.name}</strong><label>Caption<input value={image.caption} maxLength={300} onChange={(event) => updateQueued(image.id, { caption: event.target.value })} /></label><label>Alt text<input value={image.altText} maxLength={500} minLength={3} required onChange={(event) => updateQueued(image.id, { altText: event.target.value })} placeholder="Describe the image for someone who cannot see it" /></label><label className="creator-cover-choice"><input type="checkbox" checked={image.isCover} onChange={(event) => setQueued((items) => items.map((item) => ({ ...item, isCover: item.id === image.id ? event.target.checked : event.target.checked ? false : item.isCover })))} />Use as cover image</label>{busy === image.id && <div className="creator-progress" role="progressbar" aria-label={`Uploading ${image.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={image.progress}><span style={{ width: `${image.progress}%` }} />{image.progress}%</div>}</div><button type="button" className="icon-button" aria-label={`Remove ${image.file.name}`} onClick={() => removeQueued(image.id)} disabled={busy === image.id}><Trash2 size={16} /></button></article>)}<div className="creator-form-actions"><span>{queued.length} selected image{queued.length === 1 ? '' : 's'}</span><button type="button" className="btn btn-primary" onClick={() => void uploadImages()} disabled={!!busy || queued.some((item) => item.altText.trim().length < 3)}>Upload images</button></div></div>}
              {artwork.media.filter((item) => item.status !== 'REMOVED').length > 0 ? <div className="creator-saved-media">{artwork.media.filter((item) => item.status !== 'REMOVED').map((media, index, all) => <SavedMedia key={media.mediaId} media={media} editable={canEditArtwork} busy={!!busy} onMoveUp={() => void moveMedia(media.mediaId, -1)} onMoveDown={() => void moveMedia(media.mediaId, 1)} canMoveUp={media.status === 'READY_FOR_REVIEW' && all.slice(0, index).some((item) => item.status === 'READY_FOR_REVIEW')} canMoveDown={media.status === 'READY_FOR_REVIEW' && all.slice(index + 1).some((item) => item.status === 'READY_FOR_REVIEW')} onCover={() => void creatorApi.setCover(artwork.artworkId, media.mediaId).then(refreshAll).catch((cause) => setActionError(cause instanceof Error ? cause.message : 'Could not set cover image.'))} onRemove={() => { if (window.confirm('Remove this image from the artwork draft?')) void creatorApi.removeMedia(artwork.artworkId, media.mediaId).then(refreshAll).catch((cause) => setActionError(cause instanceof Error ? cause.message : 'Could not remove image.')); }} />)}</div> : <p className="creator-inline-note">No images uploaded yet. At least one completed image is required before submission.</p>}
            </section>
            {canEditArtwork && <section className="creator-form panel" aria-labelledby="creator-rights-heading"><div className="creator-form-heading"><div><h3 id="creator-rights-heading">Rights and attribution evidence</h3><p>References and declarations are recorded for moderator review. File attachments are not enabled in this release.</p></div><ShieldCheck size={24} /></div>
              <form onSubmit={(event) => void addAttribution(event)} className="creator-rights-form"><label>Attribution text<input name="attributionText" required minLength={2} maxLength={300} defaultValue={artwork.rights.attributionText} /></label><label>Source description<input name="sourceDescription" required minLength={5} maxLength={1000} placeholder="Explain how the source and creator attribution were established" /></label><button className="btn btn-secondary" type="submit" disabled={!!busy}>Submit attribution for verification</button></form>
              <button type="button" className="text-button" onClick={() => setRightsOpen((value) => !value)}>{rightsOpen ? 'Hide rights evidence form' : 'Add rights evidence reference'}</button>
              {rightsOpen && <form className="creator-rights-form" onSubmit={(event) => void addRightsEvidence(event)}><label>Evidence type<select name="evidenceType"><option value="OWNERSHIP">Ownership</option><option value="LICENSE">License</option><option value="AUTHORIZED_REPRESENTATIVE">Authorized representative</option><option value="SOURCE_PERMISSION">Source permission</option><option value="OTHER">Other</option></select></label><label>Issuer / rights holder<input name="issuerName" required minLength={2} maxLength={160} /></label><label>Evidence reference<input name="evidenceReference" required minLength={3} maxLength={500} placeholder="Reference number or secure external record URL" /></label><label>Description<textarea name="description" required minLength={10} maxLength={1500} rows={3} /></label><button className="btn btn-secondary" type="submit" disabled={!!busy}>Submit evidence reference</button></form>}
              <form className="creator-rights-form" onSubmit={(event) => void addCommunityPermission(event)}><h4>Community-held material permissions</h4><label>Community<input name="communityName" required minLength={2} maxLength={160} /></label><label>Recognized authority<input name="authorityName" required minLength={2} maxLength={160} /></label><label>Permission scope<textarea name="permissionScope" required minLength={10} maxLength={1000} rows={2} placeholder="What use, audience and display permission was granted?" /></label><label>Evidence reference<input name="communityEvidenceReference" required minLength={3} maxLength={500} /></label><label>Cultural context<textarea name="permissionCulturalContext" required minLength={10} maxLength={1500} rows={2} /></label><button className="btn btn-secondary" type="submit" disabled={!!busy}>Submit community permission record</button></form>
              <RightsReviewSummary rights={rights} />
            </section>}
            {canEditArtwork && <div className="creator-submit-panel"><div><strong>Ready for review?</strong><p>Publication requires verified rights evidence, moderator-verified attribution, resolved community permissions, a verified creator profile and moderator approval.</p><div className="creator-submit-confirmations"><label><input type="checkbox" checked={submitConfirmations.confirmRightsAndPermissions} onChange={(event) => setSubmitConfirmations((value) => ({ ...value, confirmRightsAndPermissions: event.target.checked }))} />I have the rights and permissions needed for this work.</label><label><input type="checkbox" checked={submitConfirmations.confirmAccurateAttribution} onChange={(event) => setSubmitConfirmations((value) => ({ ...value, confirmAccurateAttribution: event.target.checked }))} />The creator and source attribution is accurate.</label><label><input type="checkbox" checked={submitConfirmations.confirmCulturalCare} onChange={(event) => setSubmitConfirmations((value) => ({ ...value, confirmCulturalCare: event.target.checked }))} />I have considered cultural context and display restrictions.</label><label><input type="checkbox" checked={submitConfirmations.confirmPublicVisibility} onChange={(event) => setSubmitConfirmations((value) => ({ ...value, confirmPublicVisibility: event.target.checked }))} />I understand that approval makes this artwork publicly visible.</label></div>{requiresCulturalReview && <p role="alert">This work is marked as sensitive or restricted. The current review contract does not support its separate cultural authorization process, so keep it as a draft.</p>}{!rightsLoading && !rightsEvidenceReady && <p role="status">Rights and attribution checks are not complete yet. Submit the required evidence and wait for moderator verification before submitting the artwork.</p>}</div><button className="btn btn-primary" type="button" onClick={() => void submitArtwork()} disabled={!!busy || rightsLoading || !rightsEvidenceReady || requiresCulturalReview || !allSubmissionConfirmations || !artwork.media.some((item) => item.status === 'READY_FOR_REVIEW')}>Submit artwork for review <ArrowRight size={16} /></button></div>}
          </div>}
        </section>
        <p className="creator-studio-footnote">Creator profile and artwork submissions are private until verified and approved. 7EVEN does not mint NFTs or transfer ownership in this release.</p>
      </main>
      <PublicFooter />
    </div>
  );
}

function ArtworkFields({ artwork, disabled }: { artwork: CreatorArtwork | null; disabled: boolean }) {
  const rights = artwork?.rights;
  return <>
    <div className="creator-form-grid"><label>Artwork title<input name="title" required minLength={3} maxLength={160} defaultValue={artwork?.title ?? ''} disabled={disabled} /></label><label>Creative discipline<select name="discipline" defaultValue={artwork?.discipline ?? 'DIGITAL_ART'} disabled={disabled}>{disciplines.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Creation year<input name="creationYear" type="number" min={1000} max={2100} defaultValue={artwork?.creationYear ?? ''} disabled={disabled} /></label><label>Origin / place<input name="origin" maxLength={200} defaultValue={String(artwork?.origin?.place ?? '')} disabled={disabled} /></label></div>
    <label>Description<textarea name="description" required minLength={20} maxLength={5000} rows={4} defaultValue={artwork?.description ?? ''} disabled={disabled} /></label><label>Cultural context<textarea name="culturalContext" maxLength={3000} rows={3} defaultValue={artwork?.culturalContext ?? ''} disabled={disabled} placeholder="Share context that helps audiences understand the work respectfully." /></label><label>Tags <span className="creator-help">Separate with commas · up to 20</span><input name="tags" defaultValue={artwork?.tags.join(', ') ?? ''} disabled={disabled} /></label><label>Image alt text<input name="accessibilityText" required minLength={3} maxLength={500} defaultValue={artwork?.accessibilityText ?? ''} disabled={disabled} placeholder="Describe the artwork for visitors using assistive technology" /></label>
    <fieldset disabled={disabled}><legend>Rights declaration</legend><div className="creator-form-grid"><label>Rights basis<select name="basis" defaultValue={rights?.basis ?? 'ORIGINAL'}><option value="ORIGINAL">My original work</option><option value="LICENSED">Licensed work</option><option value="AUTHORIZED_REPRESENTATIVE">Authorized representative</option></select></label><label>Display license<select name="displayLicense" defaultValue={rights?.displayLicense ?? 'ALL_RIGHTS_RESERVED'}><option value="ALL_RIGHTS_RESERVED">All rights reserved</option><option value="CC_BY_4_0">Creative Commons BY 4.0</option><option value="CC_BY_NC_4_0">Creative Commons BY-NC 4.0</option><option value="OTHER_DOCUMENTED_LICENSE">Other documented license</option></select></label><label>Community permission<select name="communityPermission" defaultValue={rights?.communityPermission ?? 'NOT_REQUIRED'}><option value="NOT_REQUIRED">Not required</option><option value="OBTAINED">Obtained (evidence required)</option><option value="PENDING">Pending</option><option value="NOT_SURE">Not sure</option></select></label></div><label>Attribution text<input name="attributionText" required minLength={2} maxLength={300} defaultValue={rights?.attributionText ?? ''} /></label><label>Third-party permissions<textarea name="thirdPartyPermissions" maxLength={1000} rows={2} defaultValue={rights?.thirdPartyPermissions ?? ''} /></label><label>Community permission details<textarea name="communityPermissionDetails" maxLength={1000} rows={2} defaultValue={rights?.communityPermissionDetails ?? ''} /></label><label className="creator-consent"><input type="checkbox" name="rightsConfirmed" defaultChecked disabled={disabled} required />I confirm I have the rights and permissions needed to submit this work.</label></fieldset>
    <label className="creator-consent"><input type="checkbox" name="sensitiveCulturalMaterial" defaultChecked={Boolean(artwork?.contentNotice?.containsSensitiveCulturalMaterial)} disabled={disabled} />This work contains sensitive or restricted cultural material that needs special review.</label>
  </>;
}

function SavedMedia({ media, editable, busy, onCover, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: { media: CreatorMedia; editable: boolean; busy: boolean; onCover: () => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean }) {
  return <article className="creator-saved-media-item"><div className="creator-media-placeholder"><ImagePlus size={22} /><span>Image stored securely</span></div><div><strong>{media.filename}</strong><small>{(media.byteSize / 1024 / 1024).toFixed(1)} MB · {media.status.replaceAll('_', ' ').toLowerCase()}</small><small>{media.isCover ? 'Cover image' : 'Gallery image'}</small></div>{editable && <div className="creator-media-actions">{media.status === 'READY_FOR_REVIEW' && !media.isCover && <button type="button" className="text-button" onClick={onCover} disabled={busy}>Set cover</button>}{media.status === 'READY_FOR_REVIEW' && <><button type="button" className="icon-button" aria-label={`Move ${media.filename} earlier`} onClick={onMoveUp} disabled={busy || !canMoveUp}><ArrowUp size={15} /></button><button type="button" className="icon-button" aria-label={`Move ${media.filename} later`} onClick={onMoveDown} disabled={busy || !canMoveDown}><ArrowDown size={15} /></button></>}<button type="button" className="icon-button" aria-label={`Remove ${media.filename}`} onClick={onRemove} disabled={busy}><Trash2 size={16} /></button></div>}</article>;
}
function RightsReviewSummary({ rights }: { rights: RightsResponse }) {
  const records = [...(rights.evidence ?? []).map((item) => ({ id: item.evidence_id, title: `${item.evidence_type.replaceAll('_', ' ')} · ${item.issuer_name}`, status: item.status, reason: item.review_reason })), ...(rights.communityPermissions ?? []).map((item) => ({ id: item.permission_id, title: `Community permission · ${item.community_name}`, status: item.status, reason: item.review_reason })), ...(rights.attributionReviews ?? []).map((item) => ({ id: item.attribution_review_id, title: `Attribution · ${item.attribution_text}`, status: item.status, reason: item.review_reason }))];
  if (!records.length) return <p className="creator-inline-note">No separate rights evidence records have been submitted.</p>;
  return <div className="creator-rights-records"><h4>Evidence review status</h4>{records.map((record) => <div key={record.id}><span>{record.title}</span><StatusBadge status={record.status} />{record.reason && <small>{record.reason}</small>}</div>)}</div>;
}

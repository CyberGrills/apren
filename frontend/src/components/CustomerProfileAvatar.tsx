import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';

interface UploadIntent {
  mediaId: string;
  uploadUrl: string;
  token: string;
  requiredHeaders: Record<string, string>;
}
interface AvatarResult { imageUrl: string | null }

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function CustomerProfileAvatar({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '7';

  useEffect(() => {
    let active = true;
    void api<AvatarResult>('/me/avatar').then(result => {
      if (active) setImageUrl(result.imageUrl);
    }).catch(() => {
      // The profile remains usable with initials when photo storage is unavailable.
    });
    return () => { active = false; };
  }, []);

  async function upload(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Choose a JPEG, PNG, WebP or AVIF image.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }
    setBusy(true);
    try {
      const intent = await api<UploadIntent>('/me/avatar/upload-intents', {
        method: 'POST',
        body: { filename: file.name, mimeType: file.type, byteSize: file.size },
        idempotencyKey: crypto.randomUUID(),
      });
      const headers = new Headers(intent.requiredHeaders);
      headers.set('Authorization', 'Bearer ' + intent.token);
      headers.set('x-upsert', 'false');
      const uploaded = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers,
        body: file,
        redirect: 'error',
      });
      if (!uploaded.ok) throw new Error('The photo could not be uploaded. Please try again.');
      const completed = await api<{ mediaId: string; imageUrl: string }>(
        '/me/avatar/' + encodeURIComponent(intent.mediaId) + '/complete',
        { method: 'POST', body: {}, idempotencyKey: crypto.randomUUID() },
      );
      setImageUrl(completed.imageUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not update your profile photo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="customer-profile-avatar-wrap">
      <div className="customer-profile-avatar" aria-label={imageUrl ? 'Your profile photo' : 'Profile initials'}>
        {imageUrl
          ? <img src={imageUrl} alt="" className="customer-profile-avatar-image" />
          : initials}
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        aria-label="Choose profile picture"
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (file) void upload(file);
        }}
        disabled={busy}
      />
      <button
        className="text-button customer-profile-avatar-action"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? 'Uploading photo…' : imageUrl ? 'Change photo' : 'Upload photo'}
      </button>
      {error && <p className="customer-profile-avatar-error" role="alert">{error}</p>}
    </div>
  );
}

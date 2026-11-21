import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from '@7even/contracts';
import { fail, one, transaction } from './db.ts';
import { businessMediaStorageFetch } from './businessMedia.ts';

const BUCKET = 'customer-profile-photos';
const MAX_BYTES = 5 * 1024 * 1024;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
type Context = { pool: Pool; actor: (res: Response) => SessionUser };

function customer(actor: SessionUser): string {
  if (actor.role !== 'CUSTOMER') return fail(403, 'CUSTOMER_REQUIRED', 'Customer account access is required.');
  return actor.id;
}
const encodedPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
async function storageRequest(path: string, method: string, body?: unknown) {
  const response = await businessMediaStorageFetch(
    process.env.SUPABASE_URL!.replace(/\/$/, '') + '/storage/v1' + path,
    {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) {
    console.error('Customer profile storage request failed', { status: response.status });
    return fail(502, 'STORAGE_REQUEST_FAILED', 'Profile photo storage could not complete the request.');
  }
  return response.status === 204 ? {} : response.json() as Promise<Record<string, unknown>>;
}
function validImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'image/avif') return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && /avif|avis/.test(String.fromCharCode(...bytes.slice(8, 16)));
  return false;
}
async function signedAvatar(storagePath: string): Promise<string> {
  const signed = await storageRequest('/object/sign/' + BUCKET + '/' + encodedPath(storagePath), 'POST', { expiresIn: 3600 });
  if (typeof signed.signedURL !== 'string') return fail(502, 'SIGNED_URL_FAILED', 'Profile photo could not be displayed.');
  const base = process.env.SUPABASE_URL!.replace(/\/$/, '');
  return signed.signedURL.startsWith('http') ? signed.signedURL : base + '/storage/v1' + signed.signedURL;
}

export function mountCustomerProfileMedia(app: Express, { pool, actor }: Context): void {
  app.get('/api/me/avatar', async (_req, res) => {
    const userId = customer(actor(res));
    const current = await one(pool,
      "SELECT storage_path FROM seven.customer_profile_media WHERE user_id=$1 AND status='CURRENT'",
      [userId],
    );
    res.json({ data: { imageUrl: current ? await signedAvatar(String(current.storage_path)) : null } });
  });

  app.post('/api/me/avatar/upload-intents', async (req, res) => {
    const userId = customer(actor(res));
    const input = z.strictObject({
      filename: z.string().trim().min(1).max(255),
      mimeType: z.enum(imageTypes),
      byteSize: z.number().int().positive().max(MAX_BYTES),
    }).parse(req.body);
    const pending = await one(pool,
      "SELECT count(*)::int AS total FROM seven.customer_profile_media WHERE user_id=$1 AND status='PENDING_UPLOAD' AND upload_expires_at>now()",
      [userId],
    );
    if (Number(pending?.total ?? 0) >= 3) return fail(429, 'UPLOAD_LIMIT_REACHED', 'Finish or restart a pending photo upload before trying again.');

    const mediaId = randomUUID();
    const extension = input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType.slice(6);
    const path = userId + '/' + mediaId + '.' + extension;
    await pool.query(
      "INSERT INTO seven.customer_profile_media(media_id,user_id,storage_bucket,storage_path,mime_type,byte_size,status,upload_expires_at) VALUES($1,$2,$3,$4,$5,$6,'PENDING_UPLOAD',now()+interval '15 minutes')",
      [mediaId,userId,BUCKET,path,input.mimeType,input.byteSize],
    );
    const signed = await storageRequest('/object/upload/sign/' + BUCKET + '/' + encodedPath(path), 'POST', { upsert: false });
    const signedURL = typeof signed.signedURL === 'string' ? signed.signedURL : typeof signed.url === 'string' ? signed.url : null;
    const token = typeof signed.token === 'string' ? signed.token : null;
    if (!signedURL || !token) return fail(502, 'UPLOAD_URL_FAILED', 'Secure profile photo upload could not be initialized.');
    const base = process.env.SUPABASE_URL!.replace(/\/$/, '');
    const uploadUrl = signedURL.startsWith('http') ? signedURL : base + '/storage/v1' + signedURL;
    res.status(201).json({ data: { mediaId, uploadUrl, token, expiresIn: 900, requiredHeaders: { 'Content-Type': input.mimeType } } });
  });

  app.post('/api/me/avatar/:id/complete', async (req, res) => {
    const userId = customer(actor(res));
    const mediaId = z.uuid().parse(req.params.id);
    const media = await one(pool,
      "SELECT media_id,storage_path,mime_type,byte_size,status,upload_expires_at FROM seven.customer_profile_media WHERE media_id=$1 AND user_id=$2",
      [mediaId,userId],
    );
    if (!media) return fail(404, 'AVATAR_UPLOAD_NOT_FOUND', 'Profile photo upload was not found.');
    if (media.status === 'CURRENT') {
      return res.json({ data: { mediaId, imageUrl: await signedAvatar(String(media.storage_path)) } });
    }
    if (media.status !== 'PENDING_UPLOAD' || !media.upload_expires_at || new Date(media.upload_expires_at).getTime() < Date.now())
      return fail(409, 'UPLOAD_EXPIRED', 'This photo upload has expired. Start again.');

    const base = process.env.SUPABASE_URL!.replace(/\/$/, '');
    const path = encodedPath(String(media.storage_path));
    const objectUrl = base + '/storage/v1/object/' + BUCKET + '/' + path;
    const head = await businessMediaStorageFetch(objectUrl, { method: 'HEAD' });
    if (!head.ok) return fail(409, 'UPLOAD_NOT_FOUND', 'The image has not finished uploading.');
    const actualSize = Number(head.headers.get('content-length'));
    const actualType = (head.headers.get('content-type') || '').split(';')[0] ?? '';
    if (!Number.isSafeInteger(actualSize) || actualSize !== Number(media.byte_size) || actualSize > MAX_BYTES || actualType !== media.mime_type) {
      await storageRequest('/object/' + BUCKET + '/' + path, 'DELETE');
      return fail(422, 'IMAGE_METADATA_MISMATCH', 'Uploaded image details did not match the selected file.');
    }
    const sample = await businessMediaStorageFetch(objectUrl, { headers: { Range: 'bytes=0-31' } });
    if (!sample.ok) return fail(422, 'INVALID_IMAGE_CONTENT', 'The uploaded image could not be inspected.');
    if (!validImageSignature(actualType, new Uint8Array(await sample.arrayBuffer()))) {
      await storageRequest('/object/' + BUCKET + '/' + path, 'DELETE');
      return fail(422, 'INVALID_IMAGE_CONTENT', 'The uploaded file is not a supported image.');
    }

    let replacedPath: string | null = null;
    await transaction(pool, async db => {
      await db.query('SELECT user_id FROM seven.users WHERE user_id=$1 FOR UPDATE', [userId]);
      const locked = await one(db,
        "SELECT media_id FROM seven.customer_profile_media WHERE media_id=$1 AND user_id=$2 AND status='PENDING_UPLOAD' AND upload_expires_at>now() FOR UPDATE",
        [mediaId,userId],
      );
      if (!locked) return fail(409, 'UPLOAD_ALREADY_COMPLETED', 'This photo upload has already been completed or expired.');
      const previous = await one(db,
        "UPDATE seven.customer_profile_media SET status='REPLACED',updated_at=now() WHERE user_id=$1 AND status='CURRENT' RETURNING storage_path",
        [userId],
      );
      replacedPath = previous ? String(previous.storage_path) : null;
      await db.query(
        "UPDATE seven.customer_profile_media SET status='CURRENT',upload_expires_at=NULL,updated_at=now() WHERE media_id=$1 AND user_id=$2",
        [mediaId,userId],
      );
      await db.query(
        "INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,NULL,'customer.avatar_updated',$3,$4)",
        [randomUUID(),userId,mediaId,{ mimeType: actualType, byteSize: actualSize }],
      );
    });
    if (replacedPath) {
      try { await storageRequest('/object/' + BUCKET + '/' + encodedPath(replacedPath), 'DELETE'); }
      catch { /* The previous object can be cleaned up by storage retention without breaking the new avatar. */ }
    }
    res.json({ data: { mediaId, imageUrl: await signedAvatar(String(media.storage_path)) } });
  });
}

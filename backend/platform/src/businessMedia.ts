import type { Express, Response as ExpressResponse } from 'express';
import type { Pool, PoolClient } from 'pg';
import type { SessionUser } from '@7even/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail, one, rows } from './db.ts';

const BUCKET = 'business-property-photos';
const MAX_BYTES = 10 * 1024 * 1024;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
interface Context { pool: Pool; actor: (res: ExpressResponse) => SessionUser; }

function businessIdFor(actor: SessionUser): string {
  if (actor.role !== 'BUSINESS_OWNER' || !actor.businessId)
    return fail(403, 'BUSINESS_OWNER_REQUIRED', 'Business owner access is required.');
  return actor.businessId;
}
function storageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!baseUrl || !secret) return fail(503, 'STORAGE_NOT_CONFIGURED', 'Secure photo storage is not configured.');
  return { baseUrl, secret };
}

/** Authenticated private-storage requests must never forward service credentials across redirects. */
export async function businessMediaStorageFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const config = storageConfig();
  const headers = new Headers(init.headers);
  headers.set('apikey', config.secret);
  headers.set('Authorization', 'Bearer ' + config.secret);
  return fetch(url, { ...init, headers, redirect: 'error' });
}
async function storageRequest(path: string, method: string, body?: unknown) {
  const config = storageConfig();
  const response = await businessMediaStorageFetch(config.baseUrl + '/storage/v1' + path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    console.error('Business media storage request failed', { status: response.status });
    return fail(502, 'STORAGE_REQUEST_FAILED', 'Photo storage could not complete the request.');
  }
  return response.status === 204 ? {} : response.json() as Promise<Record<string, unknown>>;
}
function encodedPath(path: string) { return path.split('/').map(encodeURIComponent).join('/'); }

export interface BusinessMediaPreview {
  imageUrl: string;
  altText: string;
  caption: string;
  isCover: boolean;
}

export async function businessMediaGallery(pool: Pool, businessId: string): Promise<BusinessMediaPreview[]> {
  try {
    const media = await rows(pool,
      "SELECT storage_path,alt_text,caption,is_cover FROM seven.business_media WHERE business_id=$1 AND status='APPROVED' ORDER BY is_cover DESC,sort_order,created_at LIMIT 12",
      [businessId]);
    return await Promise.all(media.map(async item => {
      const signed = await storageRequest('/object/sign/' + BUCKET + '/' + encodedPath(String(item.storage_path)), 'POST', { expiresIn: 3600 });
      const base = storageConfig().baseUrl;
      const imageUrl = typeof signed.signedURL === 'string'
        ? (signed.signedURL.startsWith('http') ? signed.signedURL : base + '/storage/v1' + signed.signedURL)
        : null;
      return imageUrl ? {
        imageUrl,
        altText: String(item.alt_text),
        caption: String(item.caption),
        isCover: Boolean(item.is_cover),
      } : null;
    })).then(items => items.filter((item): item is BusinessMediaPreview => item !== null));
  } catch {
    // A storage outage or an unapplied media migration must not break the public directory.
    return [];
  }
}
async function audit(client: PoolClient, actor: SessionUser, businessId: string, action: string, mediaId: string, details: Record<string, unknown> = {}) {
  await client.query(
    'INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), actor.id, businessId, action, mediaId, details],
  );
}
async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
function validImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'image/avif') return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && /avif|avis/.test(String.fromCharCode(...bytes.slice(8, 16)));
  return false;
}
function objectPath(businessId: string, mediaId: string, filename: string) {
  const ext = filename.toLowerCase().split('.').pop() || 'img';
  return businessId + '/' + mediaId + '.' + (/^[a-z0-9]{2,5}$/.test(ext) ? ext : 'img');
}

export function mountBusinessMedia(app: Express, { pool, actor }: Context): void {
  app.get('/api/business/media', async (_req, res) => {
    const owner = actor(res); const businessId = businessIdFor(owner);
    const media = await rows(pool,
      "SELECT media_id,original_filename,mime_type,byte_size,caption,alt_text,status,rejection_reason,sort_order,is_cover,replaced_media_id,reviewed_at,created_at,updated_at,storage_path FROM seven.business_media WHERE business_id=$1 AND status <> 'REMOVED' ORDER BY is_cover DESC,sort_order,created_at",
      [businessId]);
    const items = await Promise.all(media.map(async item => {
      let imageUrl: string | null = null;
      if (item.status === 'APPROVED' || item.status === 'PENDING_REVIEW' || item.status === 'REJECTED') {
        const signed = await storageRequest('/object/sign/' + BUCKET + '/' + encodedPath(String(item.storage_path)), 'POST', { expiresIn: 900 });
        if (typeof signed.signedURL === 'string') {
          const base = storageConfig().baseUrl;
          imageUrl = signed.signedURL.startsWith('http') ? signed.signedURL : base + '/storage/v1' + signed.signedURL;
        }
      }
      return {
        mediaId: item.media_id,
        originalFilename: item.original_filename,
        mimeType: item.mime_type,
        byteSize: Number(item.byte_size),
        caption: item.caption,
        altText: item.alt_text,
        status: item.status,
        rejectionReason: item.rejection_reason,
        sortOrder: item.sort_order,
        isCover: item.is_cover,
        replacedMediaId: item.replaced_media_id,
        reviewedAt: item.reviewed_at,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        imageUrl,
      };
    }));
    res.json({ data: { items } });
  });

  app.post('/api/business/media/upload-intents', async (req, res) => {
    const owner = actor(res); const businessId = businessIdFor(owner);
    const input = z.strictObject({
      filename: z.string().trim().min(1).max(255),
      mimeType: z.enum(imageTypes),
      byteSize: z.number().int().positive().max(MAX_BYTES),
      caption: z.string().trim().max(300).default(''),
      altText: z.string().trim().min(3).max(300),
      replacesMediaId: z.uuid().optional(),
    }).parse(req.body);
    const active = await one(pool, "SELECT count(*)::int AS total FROM seven.business_media WHERE business_id=$1 AND status IN ('PENDING_UPLOAD','PENDING_REVIEW')", [businessId]);
    if (Number(active?.total ?? 0) >= 20) return fail(429, 'UPLOAD_LIMIT_REACHED', 'Finish or remove pending photo uploads before adding more.');
    const mediaId = randomUUID(); const path = objectPath(businessId, mediaId, input.filename);
    if (input.replacesMediaId) {
      const old = await one(pool, "SELECT media_id FROM seven.business_media WHERE media_id=$1 AND business_id=$2 AND status='APPROVED'", [input.replacesMediaId,businessId]);
      if (!old) return fail(404, 'MEDIA_NOT_FOUND', 'The approved photo being replaced was not found.');
    }
    await pool.query(
      "INSERT INTO seven.business_media(media_id,business_id,uploaded_by,storage_bucket,storage_path,original_filename,mime_type,byte_size,caption,alt_text,status,upload_expires_at,replaced_media_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_UPLOAD',now()+interval '15 minutes',$11)",
      [mediaId,businessId,owner.id,BUCKET,path,input.filename,input.mimeType,input.byteSize,input.caption,input.altText,input.replacesMediaId ?? null]);
    const signed = await storageRequest('/object/upload/sign/' + BUCKET + '/' + encodedPath(path), 'POST', { upsert: false });
    const signedURL = typeof signed.signedURL === 'string' ? signed.signedURL : typeof signed.url === 'string' ? signed.url : null;
    const token = typeof signed.token === 'string' ? signed.token : null;
    if (!signedURL || !token) return fail(502, 'UPLOAD_URL_FAILED', 'Secure upload could not be initialized.');
    const base = storageConfig().baseUrl;
    const uploadUrl = signedURL.startsWith('http') ? signedURL : base + '/storage/v1' + signedURL;
    res.status(201).json({ data: { mediaId, uploadUrl, token, expiresIn: 900, requiredHeaders: { 'Content-Type': input.mimeType } } });
  });

  app.post('/api/business/media/:id/complete', async (req, res) => {
    const owner = actor(res); const businessId = businessIdFor(owner);
    const media = await one(pool, 'SELECT media_id,storage_path,mime_type,byte_size,status,upload_expires_at FROM seven.business_media WHERE media_id=$1 AND business_id=$2', [req.params.id,businessId]);
    if (!media) return fail(404, 'MEDIA_NOT_FOUND', 'Photo upload was not found.');
    if (media.status !== 'PENDING_UPLOAD' || !media.upload_expires_at || new Date(media.upload_expires_at).getTime() < Date.now())
      return fail(409, 'UPLOAD_EXPIRED', 'This upload has expired. Start a new upload.');
    const config = storageConfig(); const path = encodedPath(String(media.storage_path));
    const head = await businessMediaStorageFetch(config.baseUrl + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'HEAD' });
    if (!head.ok) return fail(409, 'UPLOAD_NOT_FOUND', 'The image has not finished uploading.');
    const sizeHeader = head.headers.get('content-length');
    const actualSize = sizeHeader === null ? NaN : Number(sizeHeader);
    const actualType = (head.headers.get('content-type') || '').split(';')[0] ?? '';
    if (!Number.isSafeInteger(actualSize) || actualSize !== Number(media.byte_size) || actualSize > MAX_BYTES || actualType !== media.mime_type) {
      await storageRequest('/object/' + BUCKET + '/' + path, 'DELETE');
      return fail(422, 'IMAGE_METADATA_MISMATCH', 'Uploaded image metadata did not match the declared file.');
    }
    const sample = await businessMediaStorageFetch(config.baseUrl + '/storage/v1/object/' + BUCKET + '/' + path, {
      headers: { Range: 'bytes=0-31' },
    });
    if (!sample.ok) return fail(422, 'INVALID_IMAGE_CONTENT', 'The uploaded file could not be inspected.');
    const signature = new Uint8Array(await sample.arrayBuffer());
    if (!validImageSignature(actualType, signature)) {
      await storageRequest('/object/' + BUCKET + '/' + path, 'DELETE');
      return fail(422, 'INVALID_IMAGE_CONTENT', 'The uploaded file content does not match an accepted image format.');
    }
    await transaction(pool, async client => {
      const updated = await client.query(
        "UPDATE seven.business_media SET status='PENDING_REVIEW',updated_at=now() WHERE media_id=$1 AND business_id=$2 AND status='PENDING_UPLOAD' RETURNING media_id",
        [req.params.id,businessId],
      );
      if (!updated.rowCount) return fail(409, 'UPLOAD_ALREADY_COMPLETED', 'This photo upload has already been completed.');
      await audit(client,owner,businessId,'business_media.submitted',req.params.id,{ mimeType: actualType, byteSize: actualSize });
    });
    res.json({ data: { mediaId: req.params.id, status: 'PENDING_REVIEW' } });
  });

  app.patch('/api/business/media/order', async (req, res) => {
    const owner = actor(res); const businessId = businessIdFor(owner);
    const input = z.strictObject({ mediaIds: z.array(z.uuid()).min(1).max(30) }).parse(req.body);
    if (new Set(input.mediaIds).size !== input.mediaIds.length) return fail(422, 'DUPLICATE_MEDIA', 'A photo can appear only once in the gallery order.');
    await transaction(pool, async client => {
      const found = await client.query("SELECT media_id FROM seven.business_media WHERE business_id=$1 AND status='APPROVED' AND media_id=ANY($2::uuid[]) FOR UPDATE", [businessId,input.mediaIds]);
      if (found.rowCount !== input.mediaIds.length) return fail(422, 'INVALID_GALLERY_ORDER', 'Only approved photos from this business can be reordered.');
      for (let i=0;i<input.mediaIds.length;i++) await client.query('UPDATE seven.business_media SET sort_order=$3,updated_at=now() WHERE business_id=$1 AND media_id=$2', [businessId,input.mediaIds[i],i]);
      await audit(client,owner,businessId,'business_media.reordered',input.mediaIds[0] ?? fail(422, 'INVALID_GALLERY_ORDER', 'At least one approved photo is required.'),{ count: input.mediaIds.length });
    });
    res.json({ data: { success: true } });
  });

  app.patch('/api/business/media/:id/cover', async (req, res) => {
    const owner = actor(res); const businessId = businessIdFor(owner);
    await transaction(pool, async client => {
      await client.query('SELECT business_id FROM seven.businesses WHERE business_id=$1 FOR UPDATE', [businessId]);
      const selected = await client.query("SELECT media_id FROM seven.business_media WHERE media_id=$1 AND business_id=$2 AND status='APPROVED' FOR UPDATE", [req.params.id,businessId]);
      if (!selected.rowCount) return fail(404, 'APPROVED_MEDIA_NOT_FOUND', 'Only approved photos can be selected as the cover.');
      await client.query('UPDATE seven.business_media SET is_cover=false,updated_at=now() WHERE business_id=$1 AND is_cover', [businessId]);
      await client.query('UPDATE seven.business_media SET is_cover=true,sort_order=0,updated_at=now() WHERE media_id=$1', [req.params.id]);
      await audit(client,owner,businessId,'business_media.cover_selected',req.params.id);
    });
    res.json({ data: { success: true } });
  });

  app.patch('/api/business/media/:id', async (req, res) => {
    const owner = actor(res); const businessId = businessIdFor(owner);
    const input = z.strictObject({ caption: z.string().trim().max(300), altText: z.string().trim().min(3).max(300) }).parse(req.body);
    const result = await pool.query("UPDATE seven.business_media SET caption=$3,alt_text=$4,updated_at=now() WHERE media_id=$1 AND business_id=$2 AND status IN ('PENDING_REVIEW','APPROVED','REJECTED') RETURNING media_id", [req.params.id,businessId,input.caption,input.altText]);
    if (!result.rowCount) return fail(404, 'MEDIA_NOT_FOUND', 'Photo was not found.');
    await pool.query('INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(),owner.id,businessId,'business_media.metadata_updated',req.params.id,{ fields: ['caption','altText'] }]);
    res.json({ data: { success: true } });
  });

  app.delete('/api/business/media/:id', async (req, res) => {
    const owner = actor(res); const businessId = businessIdFor(owner);
    const media = await one(pool, "SELECT media_id,storage_path,status FROM seven.business_media WHERE media_id=$1 AND business_id=$2 AND status <> 'REMOVED'", [req.params.id,businessId]);
    if (!media) return fail(404, 'MEDIA_NOT_FOUND', 'Photo was not found.');
    await transaction(pool, async client => {
      await client.query("UPDATE seven.business_media SET status='REMOVED',is_cover=false,updated_at=now() WHERE media_id=$1 AND business_id=$2", [req.params.id,businessId]);
      await audit(client,owner,businessId,'business_media.removed',req.params.id);
    });
    await storageRequest('/object/' + BUCKET + '/' + encodedPath(String(media.storage_path)), 'DELETE');
    res.json({ data: { success: true } });
  });

  app.get('/api/admin/business-media', async (_req, res) => {
    const admin = actor(res);
    if (admin.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'Platform administration access is required.');
    const items = await rows(pool, "SELECT m.media_id,m.business_id,b.business_name,m.original_filename,m.mime_type,m.byte_size,m.caption,m.alt_text,m.created_at,m.replaced_media_id,m.storage_path FROM seven.business_media m JOIN seven.businesses b USING(business_id) WHERE m.status='PENDING_REVIEW' ORDER BY m.created_at LIMIT 100");
    const withPreviews = await Promise.all(items.map(async item => {
      const signed = await storageRequest('/object/sign/' + BUCKET + '/' + encodedPath(String(item.storage_path)), 'POST', { expiresIn: 900 });
      const base = storageConfig().baseUrl;
      const imageUrl = typeof signed.signedURL === 'string' ? (signed.signedURL.startsWith('http') ? signed.signedURL : base + '/storage/v1' + signed.signedURL) : null;
      const { storage_path: _path, ...metadata } = item;
      return { mediaId: metadata.media_id, businessId: metadata.business_id, businessName: metadata.business_name, originalFilename: metadata.original_filename, mimeType: metadata.mime_type, byteSize: Number(metadata.byte_size), caption: metadata.caption, altText: metadata.alt_text, createdAt: metadata.created_at, replacedMediaId: metadata.replaced_media_id, imageUrl };
    }));
    res.json({ data: { items: withPreviews } });
  });

  app.patch('/api/admin/business-media/:id/review', async (req, res) => {
    const admin = actor(res);
    if (admin.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'Platform administration access is required.');
    const input = z.strictObject({ decision: z.enum(['APPROVED','REJECTED']), reason: z.string().trim().max(500).optional() }).superRefine((value, ctx) => {
      if (value.decision === 'REJECTED' && !value.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A rejection reason is required.' });
    }).parse(req.body);
    await transaction(pool, async client => {
      const selected = await client.query('SELECT media_id,business_id,status,replaced_media_id FROM seven.business_media WHERE media_id=$1 FOR UPDATE', [req.params.id]);
      const media = selected.rows[0];
      if (!media || media.status !== 'PENDING_REVIEW') return fail(409, 'MEDIA_NOT_PENDING', 'This photo is no longer awaiting review.');
      await client.query('UPDATE seven.business_media SET status=$2,rejection_reason=$3,reviewed_by=$4,reviewed_at=now(),is_cover=false,updated_at=now() WHERE media_id=$1', [req.params.id,input.decision,input.decision === 'REJECTED' ? input.reason : null,admin.id]);
      await audit(client,admin,media.business_id,'business_media.' + input.decision.toLowerCase(),req.params.id,input.decision === 'REJECTED' ? { reason: input.reason } : {});
      if (input.decision === 'APPROVED' && media.replaced_media_id) {
        await client.query("UPDATE seven.business_media SET status='REMOVED',is_cover=false,updated_at=now() WHERE media_id=$1 AND business_id=$2 AND status='APPROVED'", [media.replaced_media_id,media.business_id]);
        await audit(client,admin,media.business_id,'business_media.replacement_completed',media.replaced_media_id,{ replacementMediaId: req.params.id });
      }
    });
    res.json({ data: { success: true, status: input.decision } });
  });
}

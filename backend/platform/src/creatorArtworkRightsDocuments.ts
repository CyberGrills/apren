import type { Express, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from '@7even/contracts';
import { fail, one, rows, transaction, string } from './db.ts';
import { digestToken } from './auth.ts';

const BUCKET = 'creator-artwork-rights-documents';
const MAX_BYTES = 15 * 1024 * 1024;
const mimeTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
type Context = { pool: Pool; actor: (res: Response) => SessionUser };
type Work<T> = (db: PoolClient, actor: SessionUser) => Promise<T>;

function storageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!baseUrl || !secret) return fail(503, 'STORAGE_NOT_CONFIGURED', 'Private rights-document storage is not configured.');
  return { baseUrl, secret };
}
async function storageRequest(path: string, method: string, body?: unknown) {
  const config = storageConfig();
  const response = await fetch(config.baseUrl + '/storage/v1' + path, {
    method,
    headers: {
      apikey: config.secret,
      Authorization: 'Bearer ' + config.secret,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    console.error('Creator rights document storage request failed', { status: response.status });
    return fail(502, 'STORAGE_REQUEST_FAILED', 'Private document storage could not complete the request.');
  }
  return response.status === 204 ? {} : response.json() as Promise<Record<string, unknown>>;
}
const encodedPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
function validSignature(type: string, bytes: Uint8Array) {
  if (type === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  return false;
}
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    : item);
async function mutate<T>(pool: Pool, req: Request, actor: SessionUser, work: Work<T>): Promise<T> {
  const key = string(req.get('Idempotency-Key'), 'Idempotency key', 8, 200);
  const operation = req.method + ':' + (req.route?.path ?? req.path);
  const hash = digestToken(canonical(req.body ?? {}));
  return transaction(pool, async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [actor.id + ':' + key]);
    const previous = await one(db, 'SELECT operation_name,payload_hash,response_body FROM seven.idempotencies WHERE user_id=$1 AND operation_key=$2', [actor.id, key]);
    if (previous) {
      if (previous.operation_name !== operation || previous.payload_hash !== hash)
        return fail(409, 'IDEMPOTENCY_CONFLICT', 'This request key was used for a different action.');
      return previous.response_body as T;
    }
    const result = await work(db, actor);
    await db.query('INSERT INTO seven.idempotencies(idempotency_id,user_id,operation_key,operation_name,payload_hash,response_body) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), actor.id, key, operation, hash, result]);
    return result;
  });
}
async function audit(db: PoolClient, actor: SessionUser, artworkId: string, action: string, documentId: string, details: Record<string, unknown> = {}) {
  await db.query(
    'INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,NULL,$3,$4,$5)',
    [randomUUID(), actor.id, action, documentId, { artworkId, ...details }],
  );
}
function requireAdmin(actor: SessionUser) {
  if (actor.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'Platform moderation access is required.');
}
async function creatorArtwork(db: PoolClient, actor: SessionUser, artworkId: string) {
  const art = await one(db,
    "SELECT a.artwork_id,a.creator_id,a.status FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1 AND c.user_id=$2 FOR UPDATE",
    [artworkId, actor.id]);
  if (!art) return fail(404, 'ARTWORK_NOT_FOUND', 'Artwork was not found.');
  if (!['DRAFT', 'CHANGES_REQUESTED'].includes(String(art.status)))
    return fail(409, 'ARTWORK_LOCKED', 'Rights documents can only be added before artwork submission.');
  return art;
}
function filenameOnly(value: string) {
  const name = value.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name || name === '.' || name === '..') return fail(422, 'INVALID_FILENAME', 'Document filename is invalid.');
  return name.slice(0, 255);
}
function extension(type: string) {
  return type === 'application/pdf' ? 'pdf' : type === 'image/jpeg' ? 'jpg' : 'png';
}
const intentInput = z.strictObject({
  evidenceId: z.uuid().optional(),
  permissionId: z.uuid().optional(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(mimeTypes),
  byteSize: z.number().int().positive().max(MAX_BYTES),
}).superRefine((value, ctx) => {
  if (Boolean(value.evidenceId) === Boolean(value.permissionId))
    ctx.addIssue({ code: 'custom', path: ['evidenceId'], message: 'Attach a document to exactly one rights evidence or community permission record.' });
});

export function mountCreatorArtworkRightsDocuments(app: Express, { pool, actor }: Context): void {
  app.post('/api/creator/artworks/:artworkId/rights/documents/upload-intents', async (req, res) => {
    const user = actor(res); const artworkId = z.uuid().parse(req.params.artworkId);
    const input = intentInput.parse(req.body);
    const result = await mutate(pool, req, user, async (db, current) => {
      await creatorArtwork(db, current, artworkId);
      let parent: Record<string, unknown> | undefined;
      if (input.evidenceId) {
        parent = await one(db, "SELECT evidence_id,artwork_id,status FROM seven.creator_artwork_rights_evidence WHERE evidence_id=$1 AND artwork_id=$2 AND submitted_by=$3 FOR UPDATE", [input.evidenceId, artworkId, current.id]);
      } else if (input.permissionId) {
        parent = await one(db, "SELECT permission_id,artwork_id,status FROM seven.creator_artwork_community_permissions WHERE permission_id=$1 AND artwork_id=$2 AND submitted_by=$3 FOR UPDATE", [input.permissionId, artworkId, current.id]);
      }
      if (!parent) return fail(404, 'RIGHTS_RECORD_NOT_FOUND', 'The rights record was not found for this artwork.');
      if (parent.status !== 'PENDING_REVIEW') return fail(409, 'RIGHTS_RECORD_LOCKED', 'Documents can only be attached while the rights record is pending review.');
      const parentColumn = input.evidenceId ? 'evidence_id' : 'permission_id';
      const parentId = input.evidenceId ?? input.permissionId!;
      const count = await one(db, "SELECT count(*)::int AS total FROM seven.creator_artwork_rights_documents WHERE " + parentColumn + "=$1 AND status <> 'REMOVED' AND (status <> 'PENDING_UPLOAD' OR upload_expires_at IS NULL OR upload_expires_at > now())", [parentId]);
      if (Number(count?.total ?? 0) >= 5) return fail(429, 'DOCUMENT_LIMIT_REACHED', 'A rights record can have up to five supporting documents.');
      const documentId = randomUUID();
      const path = String(parent.artwork_id) + '/' + documentId + '.' + extension(input.mimeType);
      await db.query(
        "INSERT INTO seven.creator_artwork_rights_documents(document_id,artwork_id,evidence_id,permission_id,uploaded_by,storage_path,original_filename,mime_type,byte_size,upload_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '15 minutes')",
        [documentId, artworkId, input.evidenceId ?? null, input.permissionId ?? null, current.id, path, filenameOnly(input.filename), input.mimeType, input.byteSize]);
      const signed = await storageRequest('/object/upload/sign/' + BUCKET + '/' + encodedPath(path), 'POST', { upsert: false });
      const signedURL = typeof signed.signedURL === 'string' ? signed.signedURL : typeof signed.url === 'string' ? signed.url : null;
      const token = typeof signed.token === 'string' ? signed.token : null;
      if (!signedURL || !token) return fail(502, 'UPLOAD_URL_FAILED', 'Private document upload could not be initialized.');
      const config = storageConfig();
      const uploadUrl = signedURL.startsWith('http') ? signedURL : config.baseUrl + '/storage/v1' + signedURL;
      await audit(db, current, artworkId, 'creator_artwork_rights_document.upload_intent', documentId, { mimeType: input.mimeType, byteSize: input.byteSize });
      return { documentId, uploadUrl, token, expiresIn: 900, requiredHeaders: { 'Content-Type': input.mimeType } };
    });
    res.status(201).json({ data: result });
  });

  app.post('/api/creator/artworks/:artworkId/rights/documents/:documentId/complete', async (req, res) => {
    const user = actor(res); const artworkId = z.uuid().parse(req.params.artworkId); const documentId = z.uuid().parse(req.params.documentId);
    const result = await mutate(pool, req, user, async (db, current) => {
      await creatorArtwork(db, current, artworkId);
      const document = await one(db, "SELECT * FROM seven.creator_artwork_rights_documents WHERE document_id=$1 AND artwork_id=$2 AND uploaded_by=$3 AND status='PENDING_UPLOAD' FOR UPDATE", [documentId, artworkId, current.id]);
      if (!document || !document.upload_expires_at || new Date(document.upload_expires_at).getTime() < Date.now())
        return fail(409, 'UPLOAD_EXPIRED', 'This document upload has expired. Start a new upload.');
      const config = storageConfig(); const path = encodedPath(String(document.storage_path));
      const head = await fetch(config.baseUrl + '/storage/v1/object/' + BUCKET + '/' + path, {
        method: 'HEAD', headers: { apikey: config.secret, Authorization: 'Bearer ' + config.secret },
      });
      const actualSize = Number(head.headers.get('content-length'));
      const actualType = (head.headers.get('content-type') || '').split(';')[0] ?? '';
      if (!head.ok || !Number.isSafeInteger(actualSize) || actualSize !== Number(document.byte_size) || actualSize > MAX_BYTES || actualType !== document.mime_type) {
        await storageRequest('/object/' + BUCKET + '/' + path, 'DELETE');
        return fail(422, 'DOCUMENT_METADATA_MISMATCH', 'Uploaded document metadata did not match the declared file.');
      }
      const object = await fetch(config.baseUrl + '/storage/v1/object/' + BUCKET + '/' + path, {
        headers: { apikey: config.secret, Authorization: 'Bearer ' + config.secret },
        signal: AbortSignal.timeout(20_000),
      });
      if (!object.ok) return fail(502, 'DOCUMENT_READ_FAILED', 'The uploaded document could not be verified.');
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (bytes.byteLength !== actualSize || !validSignature(actualType, bytes)) {
        await storageRequest('/object/' + BUCKET + '/' + path, 'DELETE');
        return fail(422, 'INVALID_DOCUMENT_CONTENT', 'The file content does not match an accepted PDF, JPEG or PNG document.');
      }
      const checksum = createHash('sha256').update(bytes).digest('hex');
      const updated = await db.query("UPDATE seven.creator_artwork_rights_documents SET status='PENDING_SCAN',scan_sha256=$2,updated_at=now() WHERE document_id=$1 AND status='PENDING_UPLOAD' RETURNING document_id", [documentId, checksum]);
      if (!updated.rowCount) return fail(409, 'UPLOAD_ALREADY_COMPLETED', 'This document upload has already been completed.');
      await db.query(
        "INSERT INTO seven.creator_artwork_rights_document_scan_jobs(scan_job_id,document_id,object_sha256) VALUES($1,$2,$3) ON CONFLICT(document_id,object_sha256) DO NOTHING",
        [randomUUID(), documentId, checksum],
      );
      await audit(db, current, artworkId, 'creator_artwork_rights_document.upload_completed', documentId, { mimeType: actualType, byteSize: actualSize, scanStatus: 'PENDING_SCAN', sha256: checksum });
      return { documentId, status: 'PENDING_SCAN' };
    });
    res.status(202).json({ data: result });
  });

  app.get('/api/creator/artworks/:artworkId/rights/documents', async (req, res) => {
    const user = actor(res); const artworkId = z.uuid().parse(req.params.artworkId);
    const art = await one(pool, "SELECT a.artwork_id FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1 AND c.user_id=$2", [artworkId, user.id]);
    if (!art) return fail(404, 'ARTWORK_NOT_FOUND', 'Artwork was not found.');
    const documents = await rows(pool, "SELECT document_id,evidence_id,permission_id,original_filename,mime_type,byte_size,status,created_at FROM seven.creator_artwork_rights_documents WHERE artwork_id=$1 AND status <> 'REMOVED' ORDER BY created_at", [artworkId]);
    res.json({ data: { items: documents.map(d => ({ documentId: d.document_id, evidenceId: d.evidence_id, permissionId: d.permission_id, filename: d.original_filename, mimeType: d.mime_type, byteSize: Number(d.byte_size), status: d.status, createdAt: d.created_at })) } });
  });

  app.get('/api/admin/creator-submissions/:submissionId/rights/documents', async (req, res) => {
    const user = actor(res); requireAdmin(user); const artworkId = z.uuid().parse(req.params.submissionId);
    const exists = await one(pool, 'SELECT artwork_id FROM seven.creator_artworks WHERE artwork_id=$1', [artworkId]);
    if (!exists) return fail(404, 'ARTWORK_NOT_FOUND', 'Artwork was not found.');
    const documents = await rows(pool, "SELECT document_id,evidence_id,permission_id,original_filename,mime_type,byte_size,status,created_at FROM seven.creator_artwork_rights_documents WHERE artwork_id=$1 AND status <> 'REMOVED' ORDER BY created_at", [artworkId]);
    res.json({ data: { items: documents.map(d => ({ documentId: d.document_id, evidenceId: d.evidence_id, permissionId: d.permission_id, filename: d.original_filename, mimeType: d.mime_type, byteSize: Number(d.byte_size), status: d.status, createdAt: d.created_at })) } });
  });

  async function signedDownload(artworkId: string, documentId: string, requester: SessionUser) {
    const document = await one(pool, "SELECT document_id,storage_path,mime_type,original_filename,status FROM seven.creator_artwork_rights_documents WHERE document_id=$1 AND artwork_id=$2", [documentId, artworkId]);
    if (!document || document.status !== 'AVAILABLE') return fail(404, 'DOCUMENT_NOT_FOUND', 'Available rights document was not found.');
    const signed = await storageRequest('/object/sign/' + BUCKET + '/' + encodedPath(String(document.storage_path)), 'POST', { expiresIn: 300, download: String(document.original_filename) });
    const signedURL = typeof signed.signedURL === 'string' ? signed.signedURL : null;
    if (!signedURL) return fail(502, 'DOWNLOAD_URL_FAILED', 'A private document link could not be created.');
    const config = storageConfig();
    await pool.query('INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,NULL,$3,$4,$5)',
      [randomUUID(), requester.id, 'creator_artwork_rights_document.download_link_issued', documentId, { artworkId }]);
    return { documentId, filename: document.original_filename, mimeType: document.mime_type, downloadUrl: signedURL.startsWith('http') ? signedURL : config.baseUrl + '/storage/v1' + signedURL, expiresIn: 300 };
  }
  app.get('/api/creator/artworks/:artworkId/rights/documents/:documentId/download', async (req, res) => {
    const user = actor(res); const artworkId = z.uuid().parse(req.params.artworkId); const documentId = z.uuid().parse(req.params.documentId);
    const owner = await one(pool, "SELECT a.artwork_id FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1 AND c.user_id=$2", [artworkId, user.id]);
    if (!owner) return fail(404, 'DOCUMENT_NOT_FOUND', 'Available rights document was not found.');
    res.json({ data: await signedDownload(artworkId, documentId, user) });
  });
  app.get('/api/admin/creator-submissions/:submissionId/rights/documents/:documentId/download', async (req, res) => {
    const user = actor(res); requireAdmin(user); const artworkId = z.uuid().parse(req.params.submissionId); const documentId = z.uuid().parse(req.params.documentId);
    res.json({ data: await signedDownload(artworkId, documentId, user) });
  });
}

import type { Express, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from '@7even/contracts';
import { fail, one, rows, string, transaction } from './db.ts';
import { digestToken } from './auth.ts';

const BUCKET = 'creator-artwork-media';
const MAX_BYTES = 10 * 1024 * 1024;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
type Context = { pool: Pool; actor: (res: Response) => SessionUser };
type Work<T> = (db: PoolClient, actor: SessionUser) => Promise<T>;
const profileInput = z.strictObject({
  displayName: z.string().trim().min(2).max(80),
  location: z.strictObject({
    city: z.string().trim().min(1).max(100),
    region: z.string().trim().max(100).optional(),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
  }),
  disciplines: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  biography: z.string().trim().min(30).max(1500),
  portfolioUrls: z.array(z.url().refine(v => v.startsWith('https://'))).max(5).default([]),
});
const artworkInput = z.strictObject({
  title: z.string().trim().min(3).max(160),
  discipline: z.enum(['DIGITAL_ART','PHOTOGRAPHY','FASHION_DESIGN','ILLUSTRATION','SCULPTURE','PAINTING','TEXTILE_ART','CRAFT','HERITAGE_STORY','OTHER']),
  description: z.string().trim().min(20).max(5000),
  creationYear: z.number().int().min(1000).max(2100).nullable().optional(),
  origin: z.record(z.string(), z.unknown()).default({}),
  culturalContext: z.string().trim().max(3000).default(''),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  accessibilityText: z.string().trim().min(3).max(500),
  rights: z.strictObject({
    basis: z.enum(['ORIGINAL','LICENSED','AUTHORIZED_REPRESENTATIVE']),
    rightsConfirmed: z.literal(true),
    attributionText: z.string().trim().min(2).max(300),
    thirdPartyPermissions: z.string().trim().max(1000).default(''),
    communityPermission: z.enum(['NOT_REQUIRED','OBTAINED','PENDING','NOT_SURE']),
    communityPermissionDetails: z.string().trim().max(1000).nullable().optional(),
    displayLicense: z.enum(['ALL_RIGHTS_RESERVED','CC_BY_4_0','CC_BY_NC_4_0','OTHER_DOCUMENTED_LICENSE']),
  }),
  contentNotice: z.record(z.string(), z.unknown()).default({}),
});
const reviewInput = z.strictObject({
  type: z.enum(['ARTWORK','CREATOR_PROFILE']),
  decision: z.enum(['APPROVED','VERIFIED','CHANGES_REQUESTED','REJECTED']),
  reason: z.string().trim().min(8).max(1000),
  feedback: z.array(z.strictObject({
    category: z.enum(['IDENTITY','ATTRIBUTION','RIGHTS_AND_PERMISSION','CULTURAL_CONTEXT','IMAGE_QUALITY','ACCESSIBILITY','CONTENT_POLICY','OTHER']),
    message: z.string().trim().min(3).max(1000),
  })).max(20).default([]),
});
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    : item,
);
type PageCursor = { timestamp: string; id: string };
function decodePageCursor(value: unknown): PageCursor | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 512)
    return fail(422, 'INVALID_CURSOR', 'Pagination cursor is invalid.');
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const parsed = z.strictObject({ timestamp: z.string().datetime(), id: z.uuid() }).parse(decoded);
    return parsed;
  } catch {
    return fail(422, 'INVALID_CURSOR', 'Pagination cursor is invalid or expired.');
  }
}
function encodePageCursor(row: { cursor_timestamp: Date | string; cursor_id: string }): string {
  const timestamp = row.cursor_timestamp instanceof Date
    ? row.cursor_timestamp.toISOString()
    : new Date(row.cursor_timestamp).toISOString();
  return Buffer.from(JSON.stringify({ timestamp, id: row.cursor_id }), 'utf8').toString('base64url');
}
function pageResult<T extends { cursor_timestamp: Date | string; cursor_id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const page = items.slice(0, limit);
  return {
    items: page,
    nextCursor: hasMore && page.length ? encodePageCursor(page[page.length - 1]!) : null,
  };
}
const makeSlug = (value: string, id: string) =>
  value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) + '-' + id.slice(0, 8);
function admin(actor: SessionUser) {
  if (actor.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Platform administration access is required.');
}
async function audit(db: PoolClient, actor: SessionUser, action: string, resourceId: string, details: Record<string, unknown> = {}) {
  await db.query(
    'INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,NULL,$3,$4,$5)',
    [randomUUID(), actor.id, action, resourceId, details],
  );
}
async function mutate<T>(pool: Pool, req: Request, actor: SessionUser, work: Work<T>): Promise<T> {
  const key = string(req.get('Idempotency-Key'), 'Idempotency key', 8, 200);
  const operation = req.method + ':' + req.path;
  const hash = digestToken(canonical(req.body ?? {}));
  return transaction(pool, async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [actor.id + ':' + key]);
    const previous = await one(db,
      'SELECT operation_name,payload_hash,response_body FROM seven.idempotencies WHERE user_id=$1 AND operation_key=$2',
      [actor.id, key],
    );
    if (previous) {
      if (previous.operation_name !== operation || previous.payload_hash !== hash)
        return fail(409, 'IDEMPOTENCY_CONFLICT', 'This request key was used for a different action.');
      return previous.response_body as T;
    }
    const result = await work(db, actor);
    await db.query(
      'INSERT INTO seven.idempotencies(idempotency_id,user_id,operation_key,operation_name,payload_hash,response_body) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), actor.id, key, operation, hash, result],
    );
    return result;
  });
}
async function creatorFor(db: PoolClient, actor: SessionUser, editable = false) {
  const creator = await one(db, 'SELECT * FROM seven.creator_profiles WHERE user_id=$1', [actor.id]);
  if (!creator) return fail(404, 'CREATOR_PROFILE_NOT_FOUND', 'Create your creator profile first.');
  if (editable && !['DRAFT', 'CHANGES_REQUESTED'].includes(String(creator.profile_status)))
    return fail(409, 'CREATOR_PROFILE_LOCKED', 'This creator profile is under review or verified.');
  return creator;
}
async function ownedArtwork(db: PoolClient, actor: SessionUser, artworkId: string, editable = false) {
  const artwork = await one(db,
    'SELECT a.* FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1 AND c.user_id=$2',
    [artworkId, actor.id],
  );
  if (!artwork) return fail(404, 'ARTWORK_NOT_FOUND', 'Artwork was not found.');
  if (editable && !['DRAFT', 'CHANGES_REQUESTED'].includes(String(artwork.status)))
    return fail(409, 'ARTWORK_LOCKED', 'This artwork cannot be edited in its current state.');
  return artwork;
}
function storageConfig() {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!baseUrl || !secret) return fail(503, 'STORAGE_NOT_CONFIGURED', 'Secure artwork storage is not configured.');
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
    console.error('Creator artwork storage request failed', { status: response.status });
    return fail(502, 'STORAGE_REQUEST_FAILED', 'Artwork storage could not complete the request.');
  }
  return response.status === 204 ? {} : response.json() as Promise<Record<string, unknown>>;
}
const encodedPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
function validSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'image/avif') return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && /avif|avis/.test(String.fromCharCode(...bytes.slice(8, 16)));
  return false;
}
async function detail(db: PoolClient, artworkId: string, privateView = true) {
  const art = await one(db,
    'SELECT a.*,c.display_name AS creator_name,c.slug AS creator_slug,c.city,c.region,c.country_code FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1',
    [artworkId],
  );
  if (!art) return null;
  const media = await rows(db,
    "SELECT media_id,original_filename,mime_type,byte_size,caption,accessibility_text,is_cover,status,sort_order,storage_path FROM seven.creator_artwork_media WHERE artwork_id=$1 AND status <> 'REMOVED' ORDER BY sort_order,created_at",
    [artworkId],
  );
  const rights = art.rights as Record<string, unknown>;
  const notice = art.content_notice as Record<string, unknown>;
  const projectedMedia = await Promise.all(media.map(async m => {
    let url: string | undefined;
    if (!privateView && m.status === 'READY_FOR_REVIEW') {
      const signed = await storageRequest('/object/sign/' + BUCKET + '/' + encodedPath(String(m.storage_path)), 'POST', { expiresIn: 3600 });
      const config = storageConfig();
      const signedUrl = typeof signed.signedURL === 'string' ? signed.signedURL : undefined;
      if (signedUrl) url = signedUrl.startsWith('http') ? signedUrl : config.baseUrl + '/storage/v1' + signedUrl;
    }
    return {
      mediaId: m.media_id, filename: m.original_filename, mimeType: m.mime_type,
      byteSize: Number(m.byte_size), caption: m.caption, accessibilityText: m.accessibility_text,
      isCover: m.is_cover, status: m.status, sortOrder: m.sort_order,
      ...(privateView ? { storagePath: m.storage_path } : { url }),
    };
  }));
  return {
    artworkId: art.artwork_id, creatorId: privateView ? art.creator_id : undefined, title: art.title, slug: art.slug,
    discipline: art.discipline, description: art.description, creationYear: art.creation_year,
    origin: art.origin, culturalContext: art.cultural_context, tags: art.tags,
    accessibilityText: art.accessibility_text,
    rights: privateView ? art.rights : { attributionText: rights.attributionText, displayLicense: rights.displayLicense },
    contentNotice: privateView ? art.content_notice : { containsSensitiveCulturalMaterial: Boolean(notice.containsSensitiveCulturalMaterial) },
    media: projectedMedia,
    status: privateView ? art.status : undefined, ...(privateView ? { reviewFeedback: art.review_feedback } : {}),
    submittedAt: privateView ? art.submitted_at : undefined, reviewedAt: privateView ? art.reviewed_at : undefined, publishedAt: art.published_at,
    creator: { slug: art.creator_slug, displayName: art.creator_name,
      location: { city: art.city, region: art.region, countryCode: art.country_code } },
  };
}
export function mountCreatorArtworks(app: Express, { pool, actor }: Context): void {
  app.get('/api/creator/profile', async (_req, res) => {
    const user = actor(res);
    const p = await one(pool,
      'SELECT creator_id,slug,display_name,city,region,country_code,disciplines,biography,portfolio_urls,profile_status,submitted_at,created_at,updated_at FROM seven.creator_profiles WHERE user_id=$1',
      [user.id],
    );
    res.json({ data: { creator: p ? {
      creatorId: p.creator_id, slug: p.slug, displayName: p.display_name,
      location: { city: p.city, region: p.region, countryCode: p.country_code },
      disciplines: p.disciplines, biography: p.biography, portfolioUrls: p.portfolio_urls,
      profileStatus: p.profile_status, submittedAt: p.submitted_at, createdAt: p.created_at, updatedAt: p.updated_at,
    } : null } });
  });
  app.put('/api/creator/profile', async (req, res) => {
    const user = actor(res); const input = profileInput.parse(req.body);
    const result = await mutate(pool, req, user, async (db, a) => {
      const old = await one(db, 'SELECT creator_id,profile_status,slug FROM seven.creator_profiles WHERE user_id=$1', [a.id]);
      if (old && !['DRAFT','CHANGES_REQUESTED','VERIFIED'].includes(String(old.profile_status)))
        return fail(409, 'PROFILE_LOCKED', 'This profile is currently under review.');
      const creatorId = old?.creator_id ?? randomUUID();
      const profileSlug = old?.slug ?? makeSlug(input.displayName, creatorId);
      const status = old?.profile_status === 'VERIFIED' ? 'PENDING_REVIEW' : old?.profile_status ?? 'DRAFT';
      const p = await one(db,
        "INSERT INTO seven.creator_profiles(creator_id,user_id,slug,display_name,city,region,country_code,disciplines,biography,portfolio_urls,profile_status,submitted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $11='PENDING_REVIEW' THEN now() ELSE NULL END) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,city=EXCLUDED.city,region=EXCLUDED.region,country_code=EXCLUDED.country_code,disciplines=EXCLUDED.disciplines,biography=EXCLUDED.biography,portfolio_urls=EXCLUDED.portfolio_urls,profile_status=EXCLUDED.profile_status,submitted_at=EXCLUDED.submitted_at,updated_at=now() RETURNING creator_id,slug,display_name,city,region,country_code,disciplines,biography,portfolio_urls,profile_status,updated_at",
        [creatorId,a.id,profileSlug,input.displayName,input.location.city,input.location.region ?? null,input.location.countryCode,input.disciplines,input.biography,input.portfolioUrls,status],
      );
      await audit(db,a,'creator_profile.saved',creatorId,{status});
      return { creatorId:p!.creator_id, slug:p!.slug, displayName:p!.display_name,
        location:{city:p!.city,region:p!.region,countryCode:p!.country_code},
        disciplines:p!.disciplines,biography:p!.biography,portfolioUrls:p!.portfolio_urls,
        profileStatus:p!.profile_status,updatedAt:p!.updated_at };
    });
    res.json({ data: { creator: result } });
  });
  app.post('/api/creator/profile/submit', async (req, res) => {
    const user = actor(res);
    const result = await mutate(pool,req,user,async(db,a)=>{
      const p=await creatorFor(db,a,true);
      const saved=await one(db,"UPDATE seven.creator_profiles SET profile_status='PENDING_REVIEW',submitted_at=now(),updated_at=now() WHERE creator_id=$1 RETURNING creator_id,profile_status,submitted_at",[p.creator_id]);
      await audit(db,a,'creator_profile.submitted',p.creator_id);
      return {creatorId:saved!.creator_id,profileStatus:saved!.profile_status,submittedAt:saved!.submitted_at};
    });
    res.status(202).json({data:result});
  });
  app.get('/api/creator/artworks', async (req,res) => {
    const user=actor(res); const p=await one(pool,'SELECT creator_id FROM seven.creator_profiles WHERE user_id=$1',[user.id]);
    if(!p) return res.json({data:{items:[],nextCursor:null}});
    const status=typeof req.query.status==='string'?req.query.status:null;
    const cursor=decodePageCursor(req.query.cursor);
    const limit=Math.min(Math.max(Number(req.query.limit)||20,1),50);
    const items=await rows(pool,"SELECT artwork_id,title,discipline,status,updated_at,updated_at AS cursor_timestamp,artwork_id AS cursor_id FROM seven.creator_artworks WHERE creator_id=$1 AND ($2::text IS NULL OR status=$2) AND ($3::timestamptz IS NULL OR (updated_at,artwork_id)<($3::timestamptz,$4::uuid)) ORDER BY updated_at DESC,artwork_id DESC LIMIT $5",[p.creator_id,status,cursor?.timestamp??null,cursor?.id??null,limit+1]);
    const page=pageResult(items,limit);
    res.json({data:{items:page.items.map(x=>({artworkId:x.artwork_id,title:x.title,discipline:x.discipline,status:x.status,updatedAt:x.updated_at})),nextCursor:page.nextCursor}});
  });
  app.post('/api/creator/artworks', async (req,res) => {
    const user=actor(res); const input=artworkInput.parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      const p=await creatorFor(db,a); const artworkId=randomUUID();
      const art=await one(db,"INSERT INTO seven.creator_artworks(artwork_id,creator_id,slug,title,discipline,description,creation_year,origin,cultural_context,tags,accessibility_text,rights,content_notice) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING artwork_id,title,discipline,status,updated_at",
        [artworkId,p.creator_id,makeSlug(input.title,artworkId),input.title,input.discipline,input.description,input.creationYear ?? null,input.origin,input.culturalContext,input.tags,input.accessibilityText,input.rights,input.contentNotice]);
      await audit(db,a,'creator_artwork.created',artworkId);
      return {artworkId:art!.artwork_id,title:art!.title,discipline:art!.discipline,status:art!.status,updatedAt:art!.updated_at};
    });
    res.status(201).json({data:{artwork:result}});
  });
  app.get('/api/creator/artworks/:artworkId', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const db=await pool.connect();
    try { await ownedArtwork(db,user,id); res.json({data:{artwork:await detail(db,id)}}); } finally { db.release(); }
  });
  app.patch('/api/creator/artworks/:artworkId', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const input=artworkInput.partial().parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      const old=await ownedArtwork(db,a,id,true);
      const v={title:input.title??old.title,discipline:input.discipline??old.discipline,description:input.description??old.description,creationYear:input.creationYear??old.creation_year,origin:input.origin??old.origin,culturalContext:input.culturalContext??old.cultural_context,tags:input.tags??old.tags,accessibilityText:input.accessibilityText??old.accessibility_text,rights:input.rights??old.rights,contentNotice:input.contentNotice??old.content_notice};
      await db.query('UPDATE seven.creator_artworks SET title=$2,discipline=$3,description=$4,creation_year=$5,origin=$6,cultural_context=$7,tags=$8,accessibility_text=$9,rights=$10,content_notice=$11,updated_at=now() WHERE artwork_id=$1',[id,v.title,v.discipline,v.description,v.creationYear,v.origin,v.culturalContext,v.tags,v.accessibilityText,v.rights,v.contentNotice]);
      await audit(db,a,'creator_artwork.updated',id); return {artworkId:id,status:'DRAFT'};
    });
    res.json({data:{artwork:result}});
  });
  app.post('/api/creator/artworks/:artworkId/media/upload-intents', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId);
    const input=z.strictObject({filename:z.string().trim().min(1).max(255),mimeType:z.enum(imageTypes),byteSize:z.number().int().positive().max(MAX_BYTES),caption:z.string().trim().max(300).default(''),accessibilityText:z.string().trim().min(3).max(500),isCover:z.boolean().default(false)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      const art=await ownedArtwork(db,a,id,true); const count=await one(db,"SELECT count(*)::int AS total FROM seven.creator_artwork_media WHERE artwork_id=$1 AND status <> 'REMOVED'",[id]);
      if(Number(count?.total??0)>=10) return fail(429,'MEDIA_LIMIT_REACHED','An artwork can contain up to 10 images.');
      const mediaId=randomUUID(); const ext=input.filename.toLowerCase().split('.').pop()||'img';
      if(input.isCover) await db.query('UPDATE seven.creator_artwork_media SET is_cover=false WHERE artwork_id=$1',[id]);
      const path=String(art.creator_id)+'/'+id+'/'+mediaId+'.'+(/^[a-z0-9]{2,5}$/.test(ext)?ext:'img');
      await db.query("INSERT INTO seven.creator_artwork_media(media_id,artwork_id,uploaded_by,storage_path,original_filename,mime_type,byte_size,caption,accessibility_text,upload_expires_at,is_cover) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '15 minutes',$10)",[mediaId,id,a.id,path,input.filename,input.mimeType,input.byteSize,input.caption,input.accessibilityText,input.isCover]);
      const signed=await storageRequest('/object/upload/sign/'+BUCKET+'/'+encodedPath(path),'POST',{upsert:false});
      const signedURL=typeof signed.signedURL==='string'?signed.signedURL:typeof signed.url==='string'?signed.url:null;
      const token=typeof signed.token==='string'?signed.token:null;
      if(!signedURL||!token) return fail(502,'UPLOAD_URL_FAILED','Secure artwork upload could not be initialized.');
      const cfg=storageConfig(); const uploadUrl=signedURL.startsWith('http')?signedURL:cfg.baseUrl+'/storage/v1'+signedURL;
      await audit(db,a,'creator_artwork_media.upload_intent',mediaId,{artworkId:id});
      return {mediaId,uploadUrl,token,expiresIn:900,requiredHeaders:{'Content-Type':input.mimeType}};
    });
    res.status(201).json({data:result});
  });
  app.post('/api/creator/artworks/:artworkId/media/:mediaId/complete', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const mediaId=z.uuid().parse(req.params.mediaId);
    const result=await mutate(pool,req,user,async(db,a)=>{
      await ownedArtwork(db,a,id,true);
      const media=await one(db,"SELECT * FROM seven.creator_artwork_media WHERE media_id=$1 AND artwork_id=$2 AND uploaded_by=$3 AND status='PENDING_UPLOAD'",[mediaId,id,a.id]);
      if(!media||!media.upload_expires_at||new Date(media.upload_expires_at).getTime()<Date.now()) return fail(409,'UPLOAD_EXPIRED','This upload has expired. Start a new upload.');
      const cfg=storageConfig(); const path=encodedPath(String(media.storage_path));
      const head=await fetch(cfg.baseUrl+'/storage/v1/object/'+BUCKET+'/'+path,{method:'HEAD',headers:{apikey:cfg.secret,Authorization:'Bearer '+cfg.secret}});
      const size=Number(head.headers.get('content-length')); const type=(head.headers.get('content-type')||'').split(';')[0] ?? '';
      if(!head.ok||!Number.isSafeInteger(size)||size!==Number(media.byte_size)||type!==media.mime_type) return fail(422,'IMAGE_METADATA_MISMATCH','Uploaded image metadata did not match the declared file.');
      const sample=await fetch(cfg.baseUrl+'/storage/v1/object/'+BUCKET+'/'+path,{headers:{apikey:cfg.secret,Authorization:'Bearer '+cfg.secret,Range:'bytes=0-31'}});
      if(!sample.ok||!validSignature(type,new Uint8Array(await sample.arrayBuffer()))) return fail(422,'INVALID_IMAGE_CONTENT','Uploaded file content is not a valid accepted image.');
      await db.query("UPDATE seven.creator_artwork_media SET status='READY_FOR_REVIEW',updated_at=now() WHERE media_id=$1",[mediaId]);
      await audit(db,a,'creator_artwork_media.upload_completed',mediaId,{artworkId:id});
      return {mediaId,status:'READY_FOR_REVIEW'};
    });
    res.json({data:result});
  });
  app.patch('/api/creator/artworks/:artworkId/media/:mediaId', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const mediaId=z.uuid().parse(req.params.mediaId);
    const input=z.strictObject({caption:z.string().trim().max(300).optional(),accessibilityText:z.string().trim().min(3).max(500).optional()}).refine(v=>Object.keys(v).length>0).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{await ownedArtwork(db,a,id,true); const q=await db.query("UPDATE seven.creator_artwork_media SET caption=COALESCE($3,caption),accessibility_text=COALESCE($4,accessibility_text),updated_at=now() WHERE media_id=$1 AND artwork_id=$2 AND status='READY_FOR_REVIEW'",[mediaId,id,input.caption??null,input.accessibilityText??null]); if(!q.rowCount) return fail(404,'MEDIA_NOT_FOUND','Editable artwork media was not found.'); await audit(db,a,'creator_artwork_media.updated',mediaId); return {mediaId,updated:true};});
    res.json({data:result});
  });
  app.post('/api/creator/artworks/:artworkId/media/reorder', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const input=z.strictObject({mediaIds:z.array(z.uuid()).min(1).max(10)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{await ownedArtwork(db,a,id,true); if(new Set(input.mediaIds).size!==input.mediaIds.length) return fail(422,'INVALID_MEDIA_ORDER','Media order contains duplicate IDs.'); const found=await rows(db,"SELECT media_id FROM seven.creator_artwork_media WHERE artwork_id=$1 AND status='READY_FOR_REVIEW' AND media_id=ANY($2::uuid[])",[id,input.mediaIds]); if(found.length!==input.mediaIds.length) return fail(422,'INVALID_MEDIA_ORDER','Every media ID must belong to this artwork and be complete.'); for(let i=0;i<input.mediaIds.length;i++) await db.query('UPDATE seven.creator_artwork_media SET sort_order=$2,updated_at=now() WHERE media_id=$1',[input.mediaIds[i],i]); await audit(db,a,'creator_artwork_media.reordered',id); return {artworkId:id,mediaIds:input.mediaIds};});
    res.json({data:result});
  });
  app.put('/api/creator/artworks/:artworkId/media/:mediaId/cover', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const mediaId=z.uuid().parse(req.params.mediaId);
    const result=await mutate(pool,req,user,async(db,a)=>{await ownedArtwork(db,a,id,true); const found=await one(db,"SELECT media_id FROM seven.creator_artwork_media WHERE media_id=$1 AND artwork_id=$2 AND status='READY_FOR_REVIEW'",[mediaId,id]); if(!found) return fail(404,'MEDIA_NOT_FOUND','Completed artwork media was not found.'); await db.query('UPDATE seven.creator_artwork_media SET is_cover=false WHERE artwork_id=$1',[id]); await db.query('UPDATE seven.creator_artwork_media SET is_cover=true WHERE media_id=$1',[mediaId]); await audit(db,a,'creator_artwork_media.cover_selected',mediaId); return {artworkId:id,coverMediaId:mediaId};});
    res.json({data:result});
  });
  app.delete('/api/creator/artworks/:artworkId/media/:mediaId', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const mediaId=z.uuid().parse(req.params.mediaId);
    const result=await mutate(pool,req,user,async(db,a)=>{await ownedArtwork(db,a,id,true); const media=await one(db,"UPDATE seven.creator_artwork_media SET status='REMOVED',is_cover=false,updated_at=now() WHERE media_id=$1 AND artwork_id=$2 AND status <> 'REMOVED' RETURNING media_id",[mediaId,id]); if(!media) return fail(404,'MEDIA_NOT_FOUND','Artwork media was not found.'); await audit(db,a,'creator_artwork_media.removed',mediaId); return {mediaId,removed:true};});
    res.json({data:result});
  });
  app.post('/api/creator/artworks/:artworkId/submit', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId);
    const input=z.strictObject({confirmRightsAndPermissions:z.literal(true),confirmAccurateAttribution:z.literal(true),confirmCulturalCare:z.literal(true),confirmPublicVisibility:z.literal(true)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{const art=await ownedArtwork(db,a,id,true); const media=await one(db,"SELECT count(*)::int AS total FROM seven.creator_artwork_media WHERE artwork_id=$1 AND status='READY_FOR_REVIEW'",[id]); if(!Number(media?.total)) return fail(422,'ARTWORK_MEDIA_REQUIRED','Add at least one completed image before submitting.'); const rights=art.rights as Record<string,unknown>; if(rights.communityPermission==='PENDING'||rights.communityPermission==='NOT_SURE') return fail(422,'PERMISSION_REVIEW_REQUIRED','Community permission must be resolved before submission.'); const saved=await one(db,"UPDATE seven.creator_artworks SET status='PENDING_REVIEW',confirm_public_visibility=$2,submitted_at=now(),updated_at=now() WHERE artwork_id=$1 RETURNING artwork_id,status,submitted_at",[id,input.confirmPublicVisibility]); await audit(db,a,'creator_artwork.submitted',id,{confirmPublicVisibility:true}); return {artworkId:saved!.artwork_id,status:saved!.status,submittedAt:saved!.submitted_at};});
    res.status(202).json({data:result});
  });
  app.get('/api/admin/creator-submissions', async (req,res) => {
    const user=actor(res); admin(user); const type=typeof req.query.type==='string'?req.query.type:'ARTWORK'; const status=typeof req.query.status==='string'?req.query.status:'PENDING_REVIEW'; const cursor=decodePageCursor(req.query.cursor); const limit=Math.min(Math.max(Number(req.query.limit)||20,1),50);
    if(type==='CREATOR_PROFILE'){
      const items=await rows(pool,'SELECT creator_id AS submission_id,display_name,profile_status AS status,submitted_at,submitted_at AS cursor_timestamp,creator_id AS cursor_id FROM seven.creator_profiles WHERE profile_status=$1 AND submitted_at IS NOT NULL AND ($2::timestamptz IS NULL OR (submitted_at,creator_id)<($2::timestamptz,$3::uuid)) ORDER BY submitted_at DESC,creator_id DESC LIMIT $4',[status,cursor?.timestamp??null,cursor?.id??null,limit+1]);
      const page=pageResult(items,limit);
      return res.json({data:{items:page.items.map(x=>({submissionType:'CREATOR_PROFILE',submissionId:x.submission_id,displayName:x.display_name,status:x.status,submittedAt:x.submitted_at})),nextCursor:page.nextCursor}});
    }
    const items=await rows(pool,'SELECT a.artwork_id AS submission_id,a.creator_id,c.display_name,a.title,a.discipline,a.status,a.submitted_at,a.submitted_at AS cursor_timestamp,a.artwork_id AS cursor_id FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.status=$1 AND a.submitted_at IS NOT NULL AND ($2::timestamptz IS NULL OR (a.submitted_at,a.artwork_id)<($2::timestamptz,$3::uuid)) ORDER BY a.submitted_at DESC,a.artwork_id DESC LIMIT $4',[status,cursor?.timestamp??null,cursor?.id??null,limit+1]);
    const page=pageResult(items,limit);
    res.json({data:{items:page.items.map(x=>({submissionType:'ARTWORK',submissionId:x.submission_id,creatorId:x.creator_id,creatorDisplayName:x.display_name,title:x.title,discipline:x.discipline,status:x.status,submittedAt:x.submitted_at})),nextCursor:page.nextCursor}});
  });
  app.get('/api/admin/creator-submissions/:submissionId', async (req,res) => {
    const user=actor(res); admin(user); const id=z.uuid().parse(req.params.submissionId); const type=req.query.type==='CREATOR_PROFILE'?'CREATOR_PROFILE':'ARTWORK';
    if(type==='CREATOR_PROFILE'){const p=await one(pool,'SELECT creator_id,user_id,slug,display_name,city,region,country_code,disciplines,biography,portfolio_urls,profile_status,submitted_at FROM seven.creator_profiles WHERE creator_id=$1',[id]); if(!p) return fail(404,'SUBMISSION_NOT_FOUND','Creator submission was not found.'); return res.json({data:{submissionType:type,creator:p}});}
    const db=await pool.connect(); try{const art=await detail(db,id,true); if(!art) return fail(404,'SUBMISSION_NOT_FOUND','Artwork submission was not found.'); res.json({data:{submissionType:type,artwork:art}});}finally{db.release();}
  });
  app.post('/api/admin/creator-submissions/:submissionId/review', async (req,res) => {
    const user=actor(res); admin(user); const id=z.uuid().parse(req.params.submissionId); const input=reviewInput.parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      if(input.type==='CREATOR_PROFILE'){
        const p=await one(db,'SELECT * FROM seven.creator_profiles WHERE creator_id=$1 FOR UPDATE',[id]); if(!p||p.profile_status!=='PENDING_REVIEW') return fail(409,'SUBMISSION_NOT_PENDING','Creator profile is no longer awaiting review.');
        if(!['VERIFIED','CHANGES_REQUESTED','REJECTED'].includes(input.decision)) return fail(422,'INVALID_REVIEW_DECISION','Use VERIFIED, CHANGES_REQUESTED or REJECTED for creator profiles.');
        await db.query('UPDATE seven.creator_profiles SET profile_status=$2,reviewed_at=now(),updated_at=now() WHERE creator_id=$1',[id,input.decision]); await audit(db,a,'creator_profile.reviewed',id,{decision:input.decision,reason:input.reason,feedback:input.feedback}); return {submissionId:id,status:input.decision,reviewedAt:new Date().toISOString(),reviewVersion:1};
      }
      const art=await one(db,'SELECT a.*,c.profile_status,c.user_id AS creator_user_id FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1 FOR UPDATE',[id]); if(!art||art.status!=='PENDING_REVIEW') return fail(409,'SUBMISSION_NOT_PENDING','Artwork is no longer awaiting review.');
      if(art.creator_user_id===a.id) return fail(403,'SELF_APPROVAL_FORBIDDEN','Creators cannot approve their own submissions.');
      if(!['APPROVED','CHANGES_REQUESTED','REJECTED'].includes(input.decision)) return fail(422,'INVALID_REVIEW_DECISION','Use APPROVED, CHANGES_REQUESTED or REJECTED for artwork.');
      if(input.decision==='APPROVED'){
        if(art.profile_status!=='VERIFIED') return fail(409,'CREATOR_NOT_VERIFIED','Creator profile must be verified before publication.');
        const rights=art.rights as Record<string,unknown>; if(rights.basis!=='ORIGINAL') return fail(409,'RIGHTS_EVIDENCE_REQUIRED','Licensed or representative works cannot be published until secure rights evidence review is implemented.'); if(rights.communityPermission!=='NOT_REQUIRED') return fail(409,'PERMISSION_EVIDENCE_REQUIRED','Community-owned or community-permission works require a documented evidence review before publication.'); const notice=art.content_notice as Record<string,unknown>; if(notice.containsSensitiveCulturalMaterial===true||(Array.isArray(notice.publicDisplayRestrictions)&&notice.publicDisplayRestrictions.length>0)) return fail(409,'CULTURAL_REVIEW_REQUIRED','Sensitive or restricted cultural material requires a dedicated authorization review before publication.');
        const media=await one(db,"SELECT count(*)::int AS total FROM seven.creator_artwork_media WHERE artwork_id=$1 AND status='READY_FOR_REVIEW'",[id]); if(!Number(media?.total)) return fail(409,'ARTWORK_MEDIA_REQUIRED','Completed artwork media is required for publication.');
        const now=new Date().toISOString(); const version=Number(art.review_version)+1;
        await db.query("UPDATE seven.creator_artworks SET status='APPROVED',public_active=true,published_at=now(),reviewed_at=now(),review_version=review_version+1,review_feedback='[]'::jsonb,updated_at=now() WHERE artwork_id=$1",[id]);
        await audit(db,a,'creator_artwork.approved_published',id,{reason:input.reason,reviewVersion:version});
        return {submissionId:id,status:'APPROVED',reviewedAt:now,publishedAt:now,publicUrl:'/campus-connect/art-culture/artworks/'+art.slug,reviewVersion:version};
      }
      await db.query('UPDATE seven.creator_artworks SET status=$2,public_active=false,reviewed_at=now(),review_version=review_version+1,review_feedback=$3,updated_at=now() WHERE artwork_id=$1',[id,input.decision,JSON.stringify(input.feedback)]);
      await audit(db,a,'creator_artwork.reviewed',id,{decision:input.decision,reason:input.reason,feedback:input.feedback});
      return {submissionId:id,status:input.decision,reviewedAt:new Date().toISOString(),reviewVersion:Number(art.review_version)+1};
    });
    res.json({data:result});
  });
  app.post('/api/creator/artworks/:artworkId/withdraw', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId);
    const result=await mutate(pool,req,user,async(db,a)=>{const art=await ownedArtwork(db,a,id); if(!['APPROVED','PENDING_REVIEW','CHANGES_REQUESTED'].includes(String(art.status))) return fail(409,'WITHDRAWAL_NOT_ALLOWED','This artwork cannot be withdrawn in its current state.'); await db.query("UPDATE seven.creator_artworks SET status='ARCHIVED',public_active=false,updated_at=now() WHERE artwork_id=$1",[id]); await audit(db,a,'creator_artwork.withdrawn',id); return {artworkId:id,status:'ARCHIVED',public:false};});
    res.json({data:result});
  });
  app.post('/api/admin/creator-submissions/:submissionId/takedown', async (req,res) => {
    const user=actor(res); admin(user); const id=z.uuid().parse(req.params.submissionId);
    const input=z.strictObject({reasonCode:z.string().trim().min(2).max(80),reason:z.string().trim().min(8).max(1000),creatorMessage:z.string().trim().max(1000).optional()}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{const art=await one(db,'SELECT artwork_id FROM seven.creator_artworks WHERE artwork_id=$1 FOR UPDATE',[id]); if(!art) return fail(404,'ARTWORK_NOT_FOUND','Artwork was not found.'); await db.query("UPDATE seven.creator_artworks SET status='SUSPENDED',public_active=false,updated_at=now() WHERE artwork_id=$1",[id]); await audit(db,a,'creator_artwork.taken_down',id,{reasonCode:input.reasonCode,reason:input.reason,creatorMessage:input.creatorMessage??null}); return {artworkId:id,status:'SUSPENDED',public:false};});
    res.json({data:result});
  });
  app.get('/api/art-culture/artworks', async (req,res) => {
    const discipline=typeof req.query.discipline==='string'?req.query.discipline:null; const country=typeof req.query.countryCode==='string'?req.query.countryCode:null; const cursor=decodePageCursor(req.query.cursor); const limit=Math.min(Math.max(Number(req.query.limit)||20,1),50);
    const items=await rows(pool,"SELECT a.artwork_id,a.slug,a.title,a.discipline,a.description,a.creation_year,a.origin,a.cultural_context,a.tags,a.accessibility_text,a.rights,a.published_at,a.published_at AS cursor_timestamp,a.artwork_id AS cursor_id,c.slug AS creator_slug,c.display_name,c.city,c.region,c.country_code FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.public_active AND a.status='APPROVED' AND c.profile_status='VERIFIED' AND ($1::text IS NULL OR a.discipline=$1) AND ($2::text IS NULL OR c.country_code=$2) AND ($3::timestamptz IS NULL OR (a.published_at,a.artwork_id)<($3::timestamptz,$4::uuid)) ORDER BY a.published_at DESC,a.artwork_id DESC LIMIT $5",[discipline,country,cursor?.timestamp??null,cursor?.id??null,limit+1]);
    const page=pageResult(items,limit);
    const output=await Promise.all(page.items.map(async x=>{
      const media=await rows(pool,"SELECT storage_path,caption,accessibility_text,is_cover FROM seven.creator_artwork_media WHERE artwork_id=$1 AND status='READY_FOR_REVIEW' ORDER BY is_cover DESC,sort_order",[x.artwork_id]);
      const images=await Promise.all(media.map(async m=>{const signed=await storageRequest('/object/sign/'+BUCKET+'/'+encodedPath(String(m.storage_path)),'POST',{expiresIn:3600});const cfg=storageConfig();const url=typeof signed.signedURL==='string'?signed.signedURL:null;return url?{url:url.startsWith('http')?url:cfg.baseUrl+'/storage/v1'+url,caption:m.caption,accessibilityText:m.accessibility_text,isCover:m.is_cover}:null;}));
      return {artworkId:x.artwork_id,slug:x.slug,title:x.title,discipline:x.discipline,description:x.description,creationYear:x.creation_year,origin:x.origin,culturalContext:x.cultural_context,tags:x.tags,accessibilityText:x.accessibility_text,attribution:x.rights?.attributionText,displayLicense:x.rights?.displayLicense,media:images.filter(Boolean),publishedAt:x.published_at,creator:{slug:x.creator_slug,displayName:x.display_name,location:{city:x.city,region:x.region,countryCode:x.country_code}}};
    }));
    res.json({data:{items:output,nextCursor:page.nextCursor}});
  });
  app.get('/api/art-culture/creators/:slug', async (req,res) => {
    const profile=await one(pool,"SELECT creator_id,slug,display_name,city,region,country_code,disciplines,biography FROM seven.creator_profiles WHERE slug=$1 AND profile_status='VERIFIED'",[z.string().min(1).max(120).parse(req.params.slug)]);
    if(!profile) return fail(404,'CREATOR_NOT_FOUND','Creator was not found.');
    const ids=await rows(pool,"SELECT artwork_id FROM seven.creator_artworks WHERE creator_id=$1 AND public_active AND status='APPROVED' ORDER BY published_at DESC LIMIT 50",[profile.creator_id]);
    const artworks=await Promise.all(ids.map(async item=>{const db=await pool.connect();try{return await detail(db,item.artwork_id,false);}finally{db.release();}}));
    res.json({data:{creator:{slug:profile.slug,displayName:profile.display_name,location:{city:profile.city,region:profile.region,countryCode:profile.country_code},disciplines:profile.disciplines,biography:profile.biography},artworks}});
  });
}

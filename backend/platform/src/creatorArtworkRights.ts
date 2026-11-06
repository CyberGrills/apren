import type { Express, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from '@7even/contracts';
import { fail, one, rows, transaction, string } from './db.ts';
import { digestToken } from './auth.ts';

type Context = { pool: Pool; actor: (res: Response) => SessionUser };
type Work<T> = (db: PoolClient, actor: SessionUser) => Promise<T>;
function requireAdmin(actor: SessionUser) {
  if (actor.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'Platform moderation access is required.');
}
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    : item);
async function auditDecision(db: PoolClient, actor: SessionUser, artworkId: string, decision: string, reason: string, subjectId: string | null, snapshot: Record<string, unknown> = {}) {
  await db.query(
    'INSERT INTO seven.creator_artwork_rights_decisions(decision_id,artwork_id,actor_user_id,decision_type,subject_id,reason,evidence_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [randomUUID(), artworkId, actor.id, decision, subjectId, reason, snapshot],
  );
  await db.query(
    'INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details) VALUES($1,$2,NULL,$3,$4,$5)',
    [randomUUID(), actor.id, 'creator_artwork.rights.' + decision.toLowerCase(), artworkId, { reason, subjectId }],
  );
}
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
    await db.query(
      'INSERT INTO seven.idempotencies(idempotency_id,user_id,operation_key,operation_name,payload_hash,response_body) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), actor.id, key, operation, hash, result],
    );
    return result;
  });
}
async function ownedArtwork(db: PoolClient, actor: SessionUser, artworkId: string, editable = false) {
  const art = await one(db, 'SELECT a.artwork_id,a.status,c.user_id FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1 AND c.user_id=$2 FOR UPDATE', [artworkId, actor.id]);
  if (!art) return fail(404, 'ARTWORK_NOT_FOUND', 'Artwork was not found.');
  if (editable && !['DRAFT','CHANGES_REQUESTED'].includes(String(art.status)))
    return fail(409, 'ARTWORK_LOCKED', 'Rights declarations cannot be changed after submission.');
  return art;
}
export function mountCreatorArtworkRights(app: Express, { pool, actor }: Context): void {
  app.get('/api/creator/artworks/:artworkId/rights', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId); const db=await pool.connect();
    try {
      await ownedArtwork(db,user,id);
      const [evidence,permissions,attributions]=await Promise.all([
        rows(db,'SELECT evidence_id,evidence_type,issuer_name,evidence_reference,description,status,review_reason,created_at,reviewed_at FROM seven.creator_artwork_rights_evidence WHERE artwork_id=$1 ORDER BY created_at DESC',[id]),
        rows(db,'SELECT permission_id,community_name,authority_name,permission_scope,evidence_reference,cultural_context,status,review_reason,created_at,reviewed_at FROM seven.creator_artwork_community_permissions WHERE artwork_id=$1 ORDER BY created_at DESC',[id]),
        rows(db,'SELECT attribution_review_id,attribution_text,source_description,status,review_reason,created_at,reviewed_at FROM seven.creator_artwork_attribution_reviews WHERE artwork_id=$1 ORDER BY created_at DESC',[id]),
      ]);
      res.json({data:{evidence,communityPermissions:permissions,attributionReviews:attributions}});
    } finally { db.release(); }
  });
  app.post('/api/creator/artworks/:artworkId/rights/evidence', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId);
    const input=z.strictObject({evidenceType:z.enum(['LICENSE','OWNERSHIP','AUTHORIZED_REPRESENTATIVE','SOURCE_PERMISSION','OTHER']),issuerName:z.string().trim().min(2).max(160),evidenceReference:z.string().trim().min(3).max(500),description:z.string().trim().min(10).max(1500)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      await ownedArtwork(db,a,id,true);
      const evidenceId=randomUUID();
      await db.query("INSERT INTO seven.creator_artwork_rights_evidence(evidence_id,artwork_id,submitted_by,evidence_type,issuer_name,evidence_reference,description) VALUES($1,$2,$3,$4,$5,$6,$7)",[evidenceId,id,a.id,input.evidenceType,input.issuerName,input.evidenceReference,input.description]);
      await auditDecision(db,a,id,'EVIDENCE_SUBMITTED','Evidence submitted for moderator review.',evidenceId,{evidenceType:input.evidenceType});
      return {evidenceId,status:'PENDING_REVIEW'};
    });
    res.status(202).json({data:result});
  });
  app.post('/api/creator/artworks/:artworkId/rights/community-permissions', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId);
    const input=z.strictObject({communityName:z.string().trim().min(2).max(160),authorityName:z.string().trim().min(2).max(160),permissionScope:z.string().trim().min(10).max(1000),evidenceReference:z.string().trim().min(3).max(500),culturalContext:z.string().trim().min(10).max(1500)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      await ownedArtwork(db,a,id,true); const permissionId=randomUUID();
      await db.query('INSERT INTO seven.creator_artwork_community_permissions(permission_id,artwork_id,submitted_by,community_name,authority_name,permission_scope,evidence_reference,cultural_context) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[permissionId,id,a.id,input.communityName,input.authorityName,input.permissionScope,input.evidenceReference,input.culturalContext]);
      await auditDecision(db,a,id,'COMMUNITY_PERMISSION_SUBMITTED','Community permission documentation submitted for moderator review.',permissionId,{communityName:input.communityName,authorityName:input.authorityName});
      return {permissionId,status:'PENDING_REVIEW'};
    });
    res.status(202).json({data:result});
  });
  app.post('/api/creator/artworks/:artworkId/rights/attribution', async (req,res) => {
    const user=actor(res); const id=z.uuid().parse(req.params.artworkId);
    const input=z.strictObject({attributionText:z.string().trim().min(2).max(300),sourceDescription:z.string().trim().min(5).max(1000)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      await ownedArtwork(db,a,id,true); const reviewId=randomUUID();
      await db.query('INSERT INTO seven.creator_artwork_attribution_reviews(attribution_review_id,artwork_id,submitted_by,attribution_text,source_description) VALUES($1,$2,$3,$4,$5)',[reviewId,id,a.id,input.attributionText,input.sourceDescription]);
      await auditDecision(db,a,id,'ATTRIBUTION_SUBMITTED','Attribution submitted for moderator verification.',reviewId);
      return {attributionReviewId:reviewId,status:'PENDING_REVIEW'};
    });
    res.status(202).json({data:result});
  });
  app.get('/api/admin/creator-submissions/:submissionId/rights', async (req,res) => {
    const user=actor(res); requireAdmin(user); const id=z.uuid().parse(req.params.submissionId);
    const [evidence,permissions,attributions,decisions]=await Promise.all([
      rows(pool,'SELECT * FROM seven.creator_artwork_rights_evidence WHERE artwork_id=$1 ORDER BY created_at DESC',[id]),
      rows(pool,'SELECT * FROM seven.creator_artwork_community_permissions WHERE artwork_id=$1 ORDER BY created_at DESC',[id]),
      rows(pool,'SELECT * FROM seven.creator_artwork_attribution_reviews WHERE artwork_id=$1 ORDER BY created_at DESC',[id]),
      rows(pool,'SELECT decision_id,actor_user_id,decision_type,subject_id,reason,evidence_snapshot,created_at FROM seven.creator_artwork_rights_decisions WHERE artwork_id=$1 ORDER BY created_at,decision_id',[id]),
    ]);
    res.json({data:{evidence,communityPermissions:permissions,attributionReviews:attributions,decisionHistory:decisions}});
  });
  app.post('/api/admin/creator-rights/:kind/:recordId/review', async (req,res) => {
    const user=actor(res); requireAdmin(user); const kind=z.enum(['evidence','community-permission','attribution']).parse(req.params.kind); const recordId=z.uuid().parse(req.params.recordId);
    const input=z.strictObject({decision:z.enum(['APPROVED','VERIFIED','REJECTED']),reason:z.string().trim().min(8).max(1000)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      const table=kind==='evidence'?'creator_artwork_rights_evidence':kind==='community-permission'?'creator_artwork_community_permissions':'creator_artwork_attribution_reviews';
      const idColumn=kind==='evidence'?'evidence_id':kind==='community-permission'?'permission_id':'attribution_review_id';
      const row=await one(db,`SELECT * FROM seven.${table} WHERE ${idColumn}=$1 FOR UPDATE`,[recordId]);
      if(!row) return fail(404,'RIGHTS_RECORD_NOT_FOUND','Rights review record was not found.');
      if(row.status!=='PENDING_REVIEW') return fail(409,'RIGHTS_REVIEW_ALREADY_COMPLETED','This rights record already has a decision.');
      const accepted=input.decision==='APPROVED'||input.decision==='VERIFIED';
      if(kind==='community-permission'&&input.decision==='VERIFIED') return fail(422,'INVALID_RIGHTS_DECISION','Community permission decisions must be APPROVED or REJECTED.');
      if(kind!=='community-permission'&&input.decision==='APPROVED') return fail(422,'INVALID_RIGHTS_DECISION','Evidence and attribution decisions must be VERIFIED or REJECTED.');
      const status=kind==='community-permission'?(accepted?'APPROVED':'REJECTED'):(accepted?'VERIFIED':'REJECTED');
      await db.query(`UPDATE seven.${table} SET status=$2,reviewed_by=$3,reviewed_at=now(),review_reason=$4 WHERE ${idColumn}=$1`,[recordId,status,a.id,input.reason]);
      const decision=kind==='evidence'?(accepted?'EVIDENCE_VERIFIED':'EVIDENCE_REJECTED'):kind==='community-permission'?(accepted?'COMMUNITY_PERMISSION_APPROVED':'COMMUNITY_PERMISSION_REJECTED'):(accepted?'ATTRIBUTION_VERIFIED':'ATTRIBUTION_REJECTED');
      await auditDecision(db,a,String(row.artwork_id),decision,input.reason,recordId,{kind,status});
      return {recordId,status,reviewedAt:new Date().toISOString()};
    });
    res.json({data:result});
  });
  app.post('/api/admin/creator-submissions/:submissionId/rights/hold', async (req,res) => {
    const user=actor(res); requireAdmin(user); const id=z.uuid().parse(req.params.submissionId);
    const input=z.strictObject({reason:z.string().trim().min(8).max(1000)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      const art=await one(db,'SELECT artwork_id,status,public_active FROM seven.creator_artworks WHERE artwork_id=$1 FOR UPDATE',[id]);
      if(!art) return fail(404,'ARTWORK_NOT_FOUND','Artwork was not found.');
      if(art.status!=='APPROVED'||art.public_active!==true) return fail(409,'RIGHTS_HOLD_NOT_ALLOWED','A rights hold can only be placed on a currently published artwork.');
      await db.query("UPDATE seven.creator_artworks SET status='SUSPENDED',public_active=false,updated_at=now() WHERE artwork_id=$1",[id]);
      await auditDecision(db,a,id,'RIGHTS_HOLD',input.reason,null,{previousStatus:art.status});
      return {artworkId:id,status:'SUSPENDED',public:false};
    });
    res.json({data:result});
  });
  app.post('/api/admin/creator-submissions/:submissionId/rights/restore', async (req,res) => {
    const user=actor(res); requireAdmin(user); const id=z.uuid().parse(req.params.submissionId);
    const input=z.strictObject({reason:z.string().trim().min(8).max(1000)}).parse(req.body);
    const result=await mutate(pool,req,user,async(db,a)=>{
      const art=await one(db,'SELECT a.*,c.profile_status FROM seven.creator_artworks a JOIN seven.creator_profiles c USING(creator_id) WHERE a.artwork_id=$1 FOR UPDATE',[id]);
      if(!art||art.status!=='SUSPENDED'||!art.published_at) return fail(409,'RESTORE_NOT_ALLOWED','Only a previously published artwork suspended for review can be restored.');
      if(art.profile_status!=='VERIFIED') return fail(409,'CREATOR_NOT_VERIFIED','Creator profile must be verified before restoration.');
      const rights=art.rights as Record<string,unknown>;
      if(rights.basis==='LICENSED'||rights.basis==='AUTHORIZED_REPRESENTATIVE'){
        const evidence=await one(db,"SELECT count(*)::int AS total FROM seven.creator_artwork_rights_evidence WHERE artwork_id=$1 AND evidence_type=$2 AND status='VERIFIED'",[id,rights.basis==='LICENSED'?'LICENSE':'AUTHORIZED_REPRESENTATIVE']);
        if(!Number(evidence?.total)) return fail(409,'RIGHTS_EVIDENCE_REQUIRED','Verified rights evidence is required before restoration.');
      }
      if(rights.communityPermission!=='NOT_REQUIRED'){
        const permission=await one(db,"SELECT count(*)::int AS total FROM seven.creator_artwork_community_permissions WHERE artwork_id=$1 AND status='APPROVED'",[id]);
        if(!Number(permission?.total)) return fail(409,'PERMISSION_EVIDENCE_REQUIRED','Approved community permission is required before restoration.');
      }
      const notice=art.content_notice as Record<string,unknown>; if(notice.containsSensitiveCulturalMaterial===true||(Array.isArray(notice.publicDisplayRestrictions)&&notice.publicDisplayRestrictions.length>0)) return fail(409,'CULTURAL_REVIEW_REQUIRED','Cultural display restrictions still prevent restoration.');
      const media=await one(db,"SELECT count(*)::int AS total FROM seven.creator_artwork_media WHERE artwork_id=$1 AND status='READY_FOR_REVIEW'",[id]); if(!Number(media?.total)) return fail(409,'ARTWORK_MEDIA_REQUIRED','Completed artwork media is required before restoration.');
      const attribution=await one(db,"SELECT count(*)::int AS total FROM seven.creator_artwork_attribution_reviews WHERE artwork_id=$1 AND attribution_text=$2 AND status='VERIFIED'",[id,rights.attributionText]);
      if(!Number(attribution?.total)) return fail(409,'ATTRIBUTION_VERIFICATION_REQUIRED','Verified attribution is required before restoration.');
      await db.query("UPDATE seven.creator_artworks SET status='APPROVED',public_active=true,published_at=COALESCE(published_at,now()),reviewed_at=now(),updated_at=now() WHERE artwork_id=$1",[id]);
      await auditDecision(db,a,id,'RESTORED',input.reason,null,{publishedAt:art.published_at??null});
      return {artworkId:id,status:'APPROVED',public:true,restoredAt:new Date().toISOString()};
    });
    res.json({data:result});
  });
}

import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { one, rows, transaction } from './db.ts';
import { HttpMalwareScanner } from './malwareScanner.ts';
import type { MalwareScanner } from './malwareScanner.ts';

const RIGHTS_BUCKET = 'creator-artwork-rights-documents';
const MAX_SCAN_ATTEMPTS = 5;
type ScanJob = { scan_job_id: string; document_id: string; object_sha256: string; attempts: number };
type ScanDocument = {
  document_id: string; artwork_id: string; uploaded_by: string;
  storage_path: string; mime_type: string; status: string; scan_sha256: string | null;
};

async function readPrivateObject(path: string): Promise<Uint8Array> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!base || !secret) throw new Error('PRIVATE_STORAGE_NOT_CONFIGURED');
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(base + '/storage/v1/object/' + RIGHTS_BUCKET + '/' + encoded, {
    headers: { apikey: secret, Authorization: 'Bearer ' + secret },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('PRIVATE_OBJECT_READ_FAILED');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.byteLength > 15 * 1024 * 1024) throw new Error('PRIVATE_OBJECT_SIZE_INVALID');
  return bytes;
}

/** Claim and process at most five durable jobs; only an exact clean scan releases a file. */
export async function processCreatorArtworkRightsDocumentScans(
  pool: Pool,
  scanner: MalwareScanner = new HttpMalwareScanner(),
): Promise<number> {
  const leaseId = randomUUID();
  const jobs = await transaction(pool, db => rows<ScanJob>(db, `
    UPDATE seven.creator_artwork_rights_document_scan_jobs
       SET status='PROCESSING',lease_id=$1,lease_expires_at=now()+interval '90 seconds',
           attempts=attempts+1,updated_at=now()
     WHERE scan_job_id IN (
       SELECT scan_job_id FROM seven.creator_artwork_rights_document_scan_jobs
        WHERE status IN ('QUEUED','PROCESSING') AND next_attempt_at<=now()
          AND (lease_expires_at IS NULL OR lease_expires_at<=now()) AND attempts<${MAX_SCAN_ATTEMPTS}
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 5
     )
     RETURNING scan_job_id,document_id,object_sha256,attempts
  `, [leaseId]));
  let completed = 0;
  for (const job of jobs) {
    try {
      const document = await one<ScanDocument>(pool,
        'SELECT document_id,artwork_id,uploaded_by,storage_path,mime_type,status,scan_sha256 FROM seven.creator_artwork_rights_documents WHERE document_id=$1',
        [job.document_id]);
      if (!document || document.status !== 'PENDING_SCAN' || document.scan_sha256 !== job.object_sha256)
        throw new Error('SCAN_DOCUMENT_STATE_MISMATCH');
      const bytes = await readPrivateObject(document.storage_path);
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (checksum !== job.object_sha256) throw new Error('SCAN_OBJECT_CHECKSUM_MISMATCH');
      const verdict = await scanner.scan({
        documentId: document.document_id, sha256: checksum, mimeType: document.mime_type, bytes,
      });
      await transaction(pool, async db => {
        const owned = await one(db,
          "SELECT scan_job_id FROM seven.creator_artwork_rights_document_scan_jobs WHERE scan_job_id=$1 AND lease_id=$2 AND status='PROCESSING' AND lease_expires_at>now() FOR UPDATE",
          [job.scan_job_id, leaseId]);
        if (!owned) return;
        const clean = verdict.verdict === 'CLEAN';
        const updated = await db.query(`
          UPDATE seven.creator_artwork_rights_documents
             SET status=$2,scan_result=$3,scan_provider=$4,scan_engine_version=$5,
                 scan_started_at=COALESCE(scan_started_at,now()),scan_completed_at=now(),
                 scan_error_code=NULL,updated_at=now()
           WHERE document_id=$1 AND status='PENDING_SCAN' AND scan_sha256=$6
        `, [document.document_id,clean ? 'AVAILABLE' : 'QUARANTINED',verdict.verdict,
          verdict.provider,verdict.engineVersion,checksum]);
        if (updated.rowCount !== 1) throw new Error('SCAN_DOCUMENT_STATE_CHANGED');
        await db.query(`
          UPDATE seven.creator_artwork_rights_document_scan_jobs
             SET status=$2,lease_id=NULL,lease_expires_at=NULL,completed_at=now(),updated_at=now()
           WHERE scan_job_id=$1
        `, [job.scan_job_id, clean ? 'COMPLETED' : 'QUARANTINED']);
        await db.query(`
          INSERT INTO seven.audit_events(audit_event_id,user_id,business_id,action_code,resource_id,details)
          VALUES($1,$2,NULL,$3,$4,$5)
        `, [randomUUID(),document.uploaded_by,
          clean ? 'creator_artwork_rights_document.scan_clean' : 'creator_artwork_rights_document.scan_quarantined',
          document.document_id,{ artworkId: document.artwork_id, checksum, provider: verdict.provider,
            engineVersion: verdict.engineVersion, verdict: verdict.verdict }]);
      });
      completed++;
    } catch {
      await transaction(pool, async db => {
        const owned = await one(db,
          "SELECT scan_job_id FROM seven.creator_artwork_rights_document_scan_jobs WHERE scan_job_id=$1 AND lease_id=$2 AND status='PROCESSING' FOR UPDATE",
          [job.scan_job_id, leaseId]);
        if (!owned) return;
        if (job.attempts >= MAX_SCAN_ATTEMPTS) {
          await db.query(`
            UPDATE seven.creator_artwork_rights_documents
               SET status='QUARANTINED',scan_result='ERROR',scan_provider='unavailable',
                   scan_error_code='SCAN_FAILED',scan_started_at=COALESCE(scan_started_at,now()),
                   scan_completed_at=now(),updated_at=now()
             WHERE document_id=$1 AND status='PENDING_SCAN'
          `, [job.document_id]);
          await db.query(`
            UPDATE seven.creator_artwork_rights_document_scan_jobs
               SET status='QUARANTINED',lease_id=NULL,lease_expires_at=NULL,
                   last_error_code='SCAN_FAILED',completed_at=now(),updated_at=now()
             WHERE scan_job_id=$1
          `, [job.scan_job_id]);
        } else {
          await db.query(`
            UPDATE seven.creator_artwork_rights_document_scan_jobs
               SET status='QUEUED',lease_id=NULL,lease_expires_at=NULL,
                   next_attempt_at=now()+(LEAST(900,30*power(2,attempts-1))*interval '1 second'),
                   last_error_code='SCANNER_UNAVAILABLE',updated_at=now()
             WHERE scan_job_id=$1
          `, [job.scan_job_id]);
        }
      });
    }
  }
  return completed;
}

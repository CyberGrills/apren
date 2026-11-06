import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type * as C from '@7even/contracts';
import { createApp } from '../../backend/platform/src/app.ts';
import { createPool, one } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';
import { seed } from '../../backend/platform/src/seed.ts';

const origin = 'http://localhost:5177';
const password = 'Integration-only-passphrase-42!';

interface ApiResult<T> {
  status: number;
  data: T;
  error?: { code: string; message: string };
}

class Client {
  cookie = '';
  csrf = '';
  private readonly base: string;
  constructor(base: string) {
    this.base = base;
  }

  async request<T>(path: string, method = 'GET', body?: unknown, key = randomUUID()): Promise<ApiResult<T>> {
    const response = await fetch(this.base + '/api' + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: this.cookie,
        'X-CSRF-Token': this.csrf,
        'Idempotency-Key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0]!;
    const payload = await response.json() as { data: T; error?: { code: string; message: string } };
    return { status: response.status, ...payload };
  }

  async login(email: string): Promise<C.SessionUser> {
    const result = await this.request<C.SessionData>('/auth/login', 'POST', { email, password });
    assert.equal(result.status, 200, JSON.stringify(result));
    this.csrf = result.data.csrfToken!;
    return result.data.user!;
  }
}

test('7EVEN creator artwork PostgreSQL migration and API isolation', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 120000,
}, async (t) => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const database = await one(pool, 'SELECT current_database() AS name');
  assert.match(String(database?.name), /_test_db$/, 'Creator artwork tests require a disposable *_test_db database.');

  await pool.query('DROP SCHEMA IF EXISTS seven CASCADE');
  await migrate(pool);
  await seed(pool, password);

  const migrationState = await one<{
    profile_rls: boolean;
    artwork_rls: boolean;
    media_rls: boolean;
    rights_documents_rls: boolean;
    profile_app: boolean;
    artwork_readonly: boolean;
  }>(pool, `
    SELECT
      (SELECT relrowsecurity FROM pg_class WHERE oid='seven.creator_profiles'::regclass) AS profile_rls,
      (SELECT relrowsecurity FROM pg_class WHERE oid='seven.creator_artworks'::regclass) AS artwork_rls,
      (SELECT relrowsecurity FROM pg_class WHERE oid='seven.creator_artwork_media'::regclass) AS media_rls,
      (SELECT relrowsecurity FROM pg_class WHERE oid='seven.creator_artwork_rights_documents'::regclass) AS rights_documents_rls,
      has_table_privilege('seven_app','seven.creator_profiles','SELECT,INSERT,UPDATE') AS profile_app,
      has_table_privilege('seven_readonly','seven.creator_artworks','SELECT') AS artwork_readonly
  `);
  assert.equal(migrationState?.profile_rls, true);
  assert.equal(migrationState?.artwork_rls, true);
  assert.equal(migrationState?.media_rls, true);
  assert.equal(migrationState?.rights_documents_rls, true);
  assert.equal(migrationState?.profile_app, true);
  assert.equal(migrationState?.artwork_readonly, true);
  const storageCatalog = await one<{ buckets_table: string | null }>(pool, "SELECT to_regclass('storage.buckets')::text AS buckets_table");
  if (storageCatalog?.buckets_table) {
    const bucket = await one<{ is_private: boolean }>(pool, "SELECT NOT public AS is_private FROM storage.buckets WHERE id='creator-artwork-media'");
    assert.equal(bucket?.is_private, true, 'Creator artwork storage bucket must remain private.');
    const rightsBucket = await one<{ is_private: boolean; file_size_limit: number }>(pool, "SELECT NOT public AS is_private,file_size_limit FROM storage.buckets WHERE id='creator-artwork-rights-documents'");
    assert.equal(rightsBucket?.is_private, true, 'Rights evidence documents must use a private bucket.');
    assert.equal(Number(rightsBucket?.file_size_limit), 15728640, 'Rights evidence bucket must enforce the 15 MB limit.');
  }

  const previousStorageUrl = process.env.SUPABASE_URL;
  const previousStorageSecret = process.env.SUPABASE_SECRET_KEY;
  const storedObjects = new Map<string, { bytes: Buffer; contentType: string }>();
  const storageServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const uploadPrefix = '/storage/v1/object/upload/sign/';
    const objectPrefix = '/storage/v1/object/';
    if (req.method === 'POST' && url.pathname.startsWith(uploadPrefix)) {
      const objectPath = url.pathname.slice(uploadPrefix.length);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        signedURL: `${storageBase}/storage/v1/object/upload/sign/${objectPath}?token=integration-token`,
        token: 'integration-token',
      }));
      return;
    }
    if (req.method === 'PUT' && url.pathname.startsWith(uploadPrefix)) {
      const objectPath = url.pathname.slice(uploadPrefix.length);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      storedObjects.set(objectPath, {
        bytes: Buffer.concat(chunks),
        contentType: String(req.headers['content-type'] ?? ''),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ Key: objectPath }));
      return;
    }
    if ((req.method === 'HEAD' || req.method === 'GET') && url.pathname.startsWith(objectPrefix)) {
      const objectPath = url.pathname.slice(objectPrefix.length);
      const stored = storedObjects.get(objectPath);
      if (!stored) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader('Content-Type', stored.contentType);
      res.setHeader('Content-Length', String(stored.bytes.length));
      if (req.method === 'HEAD') {
        res.writeHead(200);
        res.end();
      } else {
        res.writeHead(200);
        res.end(stored.bytes);
      }
      return;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/storage/v1/object/sign/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ signedURL: '/storage/v1/object/sign/test-public-image' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const storageAddress = await new Promise<AddressInfo>((resolve) => {
    storageServer.listen(0, '127.0.0.1', () => resolve(storageServer.address() as AddressInfo));
  });
  const storageBase = `http://127.0.0.1:${storageAddress.port}`;
  process.env.SUPABASE_URL = storageBase;
  process.env.SUPABASE_SECRET_KEY = 'integration-only-storage-secret';

  const runtimePool = process.env.TEST_RUNTIME_DATABASE_URL
    ? createPool(process.env.TEST_RUNTIME_DATABASE_URL)
    : pool;
  if (process.env.TEST_RUNTIME_DATABASE_URL) {
    const privileges = await one<{ schema_usage: boolean; app_privileges: boolean }>(runtimePool, "SELECT has_schema_privilege(current_user,'seven','USAGE') AS schema_usage, pg_has_role(current_user,'seven_app','USAGE') AS app_privileges");
    assert.equal(privileges?.schema_usage, true);
    assert.equal(privileges?.app_privileges, true);
  }
  const runtime = createApp({ pool: runtimePool, environment: 'test', publicOrigin: origin });
  const server = await new Promise<Server>((resolve) => {
    const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const creator = new Client(base);
  const otherUser = new Client(base);
  const admin = new Client(base);

  try {
    await creator.login('guest@seven.test');
    await otherUser.login('friend@seven.test');
    await admin.login('admin@seven.test');

    await t.test('creator profile writes are idempotent and conflicting replays are rejected', async () => {
      const key = randomUUID();
      const profile = {
        displayName: 'Uyo Test Creator',
        location: { city: 'Uyo', region: 'Akwa Ibom', countryCode: 'NG' },
        disciplines: ['DIGITAL_ART'],
        biography: 'An integration-test creator profile describing original digital artwork and visual storytelling.',
        portfolioUrls: [],
      };
      const first = await creator.request<{ creator: { creatorId: string; profileStatus: string } }>('/creator/profile', 'PUT', profile, key);
      assert.equal(first.status, 200, JSON.stringify(first));
      assert.equal(first.data.creator.profileStatus, 'DRAFT');

      const replay = await creator.request<{ creator: { creatorId: string } }>('/creator/profile', 'PUT', profile, key);
      assert.equal(replay.status, 200, JSON.stringify(replay));
      assert.equal(replay.data.creator.creatorId, first.data.creator.creatorId);

      const conflict = await creator.request('/creator/profile', 'PUT', { ...profile, displayName: 'Different Test Creator' }, key);
      assert.equal(conflict.status, 409, JSON.stringify(conflict));
      assert.equal(conflict.error?.code, 'IDEMPOTENCY_CONFLICT');
    });

    let artworkId = '';
    await t.test('creator artwork is persisted and inaccessible to a different account', async () => {
      const created = await creator.request<{ artwork: { artworkId: string; status: string } }>('/creator/artworks', 'POST', {
        title: 'Uyo Digital Pattern Study',
        discipline: 'DIGITAL_ART',
        description: 'A test artwork record used to verify creator ownership boundaries in PostgreSQL.',
        creationYear: 2026,
        origin: { city: 'Uyo', countryCode: 'NG' },
        culturalContext: 'Synthetic integration-test content; not a representation of a real community or tradition.',
        tags: ['integration-test'],
        accessibilityText: 'Abstract geometric pattern in a test artwork.',
        rights: {
          basis: 'LICENSED',
          rightsConfirmed: true,
          attributionText: 'Integration test fixture',
          thirdPartyPermissions: '',
          communityPermission: 'OBTAINED',
          displayLicense: 'ALL_RIGHTS_RESERVED',
        },
        contentNotice: { containsSensitiveCulturalMaterial: false, publicDisplayRestrictions: [] },
      });
      assert.equal(created.status, 201, JSON.stringify(created));
      artworkId = created.data.artwork.artworkId;
      assert.equal(created.data.artwork.status, 'DRAFT');

      const ownerRead = await creator.request<{ artwork: { artworkId: string } }>(`/creator/artworks/${artworkId}`);
      assert.equal(ownerRead.status, 200, JSON.stringify(ownerRead));
      assert.equal(ownerRead.data.artwork.artworkId, artworkId);

      const foreignRead = await otherUser.request(`/creator/artworks/${artworkId}`);
      assert.equal(foreignRead.status, 404, JSON.stringify(foreignRead));
      assert.equal(foreignRead.error?.code, 'ARTWORK_NOT_FOUND');
    });

    await t.test('upload intents reject unsupported media before storage is contacted', async () => {
      const result = await creator.request(`/creator/artworks/${artworkId}/media/upload-intents`, 'POST', {
        filename: 'payload.svg',
        mimeType: 'image/svg+xml',
        byteSize: 2048,
        caption: 'Unsupported vector',
        accessibilityText: 'An unsupported SVG upload test.',
        isCover: true,
      });
      assert.equal(result.status, 422, JSON.stringify(result));
    });

    await t.test('creator profile submission enters moderation and cannot be approved by a non-admin', async () => {
      const submitted = await creator.request<{ creatorId: string; profileStatus: string }>('/creator/profile/submit', 'POST', {});
      assert.equal(submitted.status, 202, JSON.stringify(submitted));
      assert.equal(submitted.data.profileStatus, 'PENDING_REVIEW');

      const forbidden = await creator.request('/admin/creator-submissions');
      assert.equal(forbidden.status, 403, JSON.stringify(forbidden));

      const queue = await admin.request<{ items: Array<{ submissionId: string; submissionType: string }> }>('/admin/creator-submissions?type=CREATOR_PROFILE');
      assert.equal(queue.status, 200, JSON.stringify(queue));
      assert.ok(queue.data.items.some((item) => item.submissionId === submitted.data.creatorId));
      const verified = await admin.request('/admin/creator-submissions/' + submitted.data.creatorId + '/review', 'POST', {
        type: 'CREATOR_PROFILE',
        decision: 'VERIFIED',
        reason: 'Integration fixture passed creator profile review.',
        feedback: [],
      });
      assert.equal(verified.status, 200, JSON.stringify(verified));
      assert.equal((verified.data as { status: string }).status, 'VERIFIED');
    });

    await t.test('completed media can be submitted, approved, discovered, and taken down', async () => {
      const imageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      const intent = await creator.request<{ mediaId: string; uploadUrl: string; requiredHeaders: { 'Content-Type': string } }>(
        `/creator/artworks/${artworkId}/media/upload-intents`,
        'POST',
        {
          filename: 'uyo-pattern.png',
          mimeType: 'image/png',
          byteSize: imageBytes.length,
          caption: 'Test cover image',
          accessibilityText: 'A test PNG image for the Uyo pattern artwork.',
          isCover: true,
        },
      );
      assert.equal(intent.status, 201, JSON.stringify(intent));
      const uploaded = await fetch(intent.data.uploadUrl, {
        method: 'PUT',
        headers: intent.data.requiredHeaders,
        body: imageBytes,
      });
      assert.equal(uploaded.status, 200, 'Signed upload must accept the image bytes.');

      const completed = await creator.request(
        `/creator/artworks/${artworkId}/media/${intent.data.mediaId}/complete`,
        'POST',
        {},
      );
      assert.equal(completed.status, 200, JSON.stringify(completed));
      assert.equal((completed.data as { status: string }).status, 'READY_FOR_REVIEW');

      const evidence = await creator.request<{ evidenceId: string }>(`/creator/artworks/${artworkId}/rights/evidence`, 'POST', {
        evidenceType: 'LICENSE',
        issuerName: 'Integration fixture creator',
        evidenceReference: 'fixture:ownership-proof-001',
        description: 'Synthetic ownership evidence reference for integration verification.',
      });
      assert.equal(evidence.status, 202, JSON.stringify(evidence));
      const blockedEvidenceReview = await admin.request(`/admin/creator-rights/evidence/${evidence.data.evidenceId}/review`, 'POST', {
        decision: 'VERIFIED',
        reason: 'This decision must remain blocked until a real document is attached.',
      });
      assert.equal(blockedEvidenceReview.status, 409, JSON.stringify(blockedEvidenceReview));
      assert.equal(blockedEvidenceReview.error?.code, 'RIGHTS_DOCUMENT_REQUIRED');
      const creatorUser = await one<{ user_id: string }>(runtimePool, 'SELECT user_id FROM seven.users WHERE email=$1', ['guest@seven.test']);
      assert.ok(creatorUser, 'The seeded creator account must exist.');
      for (let i = 0; i < 5; i += 1) {
        await runtimePool.query(
          `INSERT INTO seven.creator_artwork_rights_documents
            (document_id,artwork_id,evidence_id,uploaded_by,storage_path,original_filename,mime_type,byte_size,status,upload_expires_at)
           VALUES($1,$2,$3,$4,$5,'expired.pdf','application/pdf',64,'PENDING_UPLOAD',now()-interval '1 minute')`,
          [randomUUID(), artworkId, evidence.data.evidenceId, creatorUser.user_id, `expired/${randomUUID()}.pdf`],
        );
      }
      // Expired intents must not permanently consume the five-document limit.
      const evidenceBytes = Buffer.from('%PDF-1.7\\nSynthetic licence evidence for integration testing.\\n');
      const evidenceIntent = await creator.request<{ documentId: string; uploadUrl: string; requiredHeaders: { 'Content-Type': string } }>(
        `/creator/artworks/${artworkId}/rights/documents/upload-intents`, 'POST', {
          evidenceId: evidence.data.evidenceId, filename: 'licence-evidence.pdf',
          mimeType: 'application/pdf', byteSize: evidenceBytes.length,
        });
      assert.equal(evidenceIntent.status, 201, JSON.stringify(evidenceIntent));
      const evidenceUpload = await fetch(evidenceIntent.data.uploadUrl, { method: 'PUT', headers: evidenceIntent.data.requiredHeaders, body: evidenceBytes });
      assert.equal(evidenceUpload.status, 200);
      const evidenceComplete = await creator.request(
        `/creator/artworks/${artworkId}/rights/documents/${evidenceIntent.data.documentId}/complete`, 'POST', {});
      assert.equal(evidenceComplete.status, 200, JSON.stringify(evidenceComplete));
      const foreignDocuments = await otherUser.request(`/creator/artworks/${artworkId}/rights/documents`);
      assert.equal(foreignDocuments.status, 404, 'A different account must not list private rights documents.');
      const creatorDocuments = await creator.request<{ items: Array<{ documentId: string; status: string; storagePath?: string }> }>(
        `/creator/artworks/${artworkId}/rights/documents`);
      assert.equal(creatorDocuments.status, 200, JSON.stringify(creatorDocuments));
      assert.equal(creatorDocuments.data.items[0]?.status, 'AVAILABLE');
      assert.equal('storagePath' in (creatorDocuments.data.items[0] ?? {}), false, 'Private storage paths must not be returned.');
      const foreignDownload = await otherUser.request(`/creator/artworks/${artworkId}/rights/documents/${evidenceIntent.data.documentId}/download`);
      assert.equal(foreignDownload.status, 404, 'A different account must not receive a signed private download URL.');
      const nonAdminList = await creator.request(`/admin/creator-submissions/${artworkId}/rights/documents`);
      assert.equal(nonAdminList.status, 403, 'Private moderator document listing must remain admin-only.');
      const evidenceReview = await admin.request(`/admin/creator-rights/evidence/${evidence.data.evidenceId}/review`, 'POST', {
        decision: 'VERIFIED',
        reason: 'Synthetic ownership evidence verified in integration test.',
      });
      assert.equal(evidenceReview.status, 200, JSON.stringify(evidenceReview));

      const permission = await creator.request<{ permissionId: string }>(`/creator/artworks/${artworkId}/rights/community-permissions`, 'POST', {
        communityName: 'Integration fixture community',
        authorityName: 'Integration fixture authority',
        permissionScope: 'Synthetic test-only permission scope for controlled integration validation.',
        evidenceReference: 'fixture:community-permission-001',
        culturalContext: 'Synthetic integration fixture; no real community or cultural claim is represented.',
      });
      assert.equal(permission.status, 202, JSON.stringify(permission));
      const blockedPermissionReview = await admin.request(`/admin/creator-rights/community-permission/${permission.data.permissionId}/review`, 'POST', {
        decision: 'APPROVED',
        reason: 'This decision must remain blocked until community permission evidence is attached.',
      });
      assert.equal(blockedPermissionReview.status, 409, JSON.stringify(blockedPermissionReview));
      assert.equal(blockedPermissionReview.error?.code, 'RIGHTS_DOCUMENT_REQUIRED');
      const permissionBytes = Buffer.from('%PDF-1.7\\nSynthetic community permission evidence for integration testing.\\n');
      const permissionIntent = await creator.request<{ documentId: string; uploadUrl: string; requiredHeaders: { 'Content-Type': string } }>(
        `/creator/artworks/${artworkId}/rights/documents/upload-intents`, 'POST', {
          permissionId: permission.data.permissionId, filename: 'community-permission.pdf',
          mimeType: 'application/pdf', byteSize: permissionBytes.length,
        });
      assert.equal(permissionIntent.status, 201, JSON.stringify(permissionIntent));
      const permissionUpload = await fetch(permissionIntent.data.uploadUrl, { method: 'PUT', headers: permissionIntent.data.requiredHeaders, body: permissionBytes });
      assert.equal(permissionUpload.status, 200);
      const permissionComplete = await creator.request(
        `/creator/artworks/${artworkId}/rights/documents/${permissionIntent.data.documentId}/complete`, 'POST', {});
      assert.equal(permissionComplete.status, 200, JSON.stringify(permissionComplete));
      const adminDocuments = await admin.request<{ items: Array<{ documentId: string; status: string }> }>(
        `/admin/creator-submissions/${artworkId}/rights/documents`);
      assert.equal(adminDocuments.status, 200, JSON.stringify(adminDocuments));
      assert.equal(adminDocuments.data.items.length, 2);
      const adminDownload = await admin.request(
        `/admin/creator-submissions/${artworkId}/rights/documents/${evidenceIntent.data.documentId}/download`);
      assert.equal(adminDownload.status, 200, JSON.stringify(adminDownload));
      assert.ok((adminDownload.data as { downloadUrl: string }).downloadUrl);
      const permissionReview = await admin.request(`/admin/creator-rights/community-permission/${permission.data.permissionId}/review`, 'POST', {
        decision: 'APPROVED',
        reason: 'Synthetic community permission record approved in integration test.',
      });
      assert.equal(permissionReview.status, 200, JSON.stringify(permissionReview));

      const attribution = await creator.request<{ attributionReviewId: string }>(`/creator/artworks/${artworkId}/rights/attribution`, 'POST', {
        attributionText: 'Integration test fixture',
        sourceDescription: 'Original synthetic integration fixture created for this test.',
      });
      assert.equal(attribution.status, 202, JSON.stringify(attribution));
      const attributionReview = await admin.request(`/admin/creator-rights/attribution/${attribution.data.attributionReviewId}/review`, 'POST', {
        decision: 'VERIFIED',
        reason: 'Synthetic attribution verified in integration test.',
      });
      assert.equal(attributionReview.status, 200, JSON.stringify(attributionReview));

      // Verify the API review persisted the exact record that publication reads.
      const persistedAttribution = await one<{
        artwork_id: string;
        attribution_text: string;
        attribution_status: string;
        declared_attribution_text: string | null;
      }>(runtimePool, `SELECT r.artwork_id,r.attribution_text,r.status AS attribution_status,a.rights->>'attributionText' AS declared_attribution_text
        FROM seven.creator_artwork_attribution_reviews r
        JOIN seven.creator_artworks a ON a.artwork_id=r.artwork_id
        WHERE r.attribution_review_id=$1`, [attribution.data.attributionReviewId]);
      assert.ok(persistedAttribution, 'Reviewed attribution must be persisted and queryable.');
      assert.equal(persistedAttribution.artwork_id, artworkId, 'Attribution must belong to the submitted artwork.');
      assert.equal(persistedAttribution.attribution_status, 'VERIFIED', 'Moderator review must persist VERIFIED status.');
      assert.equal(persistedAttribution.attribution_text, persistedAttribution.declared_attribution_text,
        'Verified attribution must exactly match creatorArtwork.rights.attributionText.');

      const submitted = await creator.request(`/creator/artworks/${artworkId}/submit`, 'POST', {
        confirmRightsAndPermissions: true,
        confirmAccurateAttribution: true,
        confirmCulturalCare: true,
        confirmPublicVisibility: true,
      });
      assert.equal(submitted.status, 202, JSON.stringify(submitted));

      const queue = await admin.request<{ items: Array<{ submissionId: string }> }>('/admin/creator-submissions?type=ARTWORK');
      assert.equal(queue.status, 200, JSON.stringify(queue));
      assert.ok(queue.data.items.some(item => item.submissionId === artworkId));

      const approved = await admin.request(`/admin/creator-submissions/${artworkId}/review`, 'POST', {
        type: 'ARTWORK',
        decision: 'APPROVED',
        reason: 'Original artwork passed the integration moderation checks.',
        feedback: [],
      });
      assert.equal(approved.status, 200, JSON.stringify(approved));
      assert.equal((approved.data as { status: string }).status, 'APPROVED');

      const publicList = await creator.request<{ items: Array<{ artworkId: string; media: Array<{ url?: string }> }> }>('/art-culture/artworks?countryCode=NG');
      assert.equal(publicList.status, 200, JSON.stringify(publicList));
      const published = publicList.data.items.find(item => item.artworkId === artworkId);
      assert.ok(published, 'Approved artwork must appear in public discovery.');
      assert.equal(published.media.length, 1);
      assert.ok(published.media[0]?.url);
      assert.equal(JSON.stringify(published).includes('storagePath'), false);

      const takenDown = await admin.request(`/admin/creator-submissions/${artworkId}/takedown`, 'POST', {
        reasonCode: 'TEST_MODERATION',
        reason: 'Integration test verifies that moderator takedown removes public visibility.',
        creatorMessage: 'This is a synthetic integration-test action.',
      });
      assert.equal(takenDown.status, 200, JSON.stringify(takenDown));
      assert.equal((takenDown.data as { status: string; public: boolean }).status, 'SUSPENDED');
      assert.equal((takenDown.data as { public: boolean }).public, false);

      const afterTakedown = await creator.request<{ items: Array<{ artworkId: string }> }>('/art-culture/artworks?countryCode=NG');
      assert.equal(afterTakedown.status, 200, JSON.stringify(afterTakedown));
      assert.equal(afterTakedown.data.items.some(item => item.artworkId === artworkId), false);
    });

    await t.test('creator can withdraw a pending artwork and the mutation is audited', async () => {
      const created = await creator.request<{ artwork: { artworkId: string } }>('/creator/artworks', 'POST', {
        title: 'Uyo Withdrawal Test Study',
        discipline: 'DIGITAL_ART',
        description: 'A second synthetic artwork used to verify creator withdrawal from moderation.',
        creationYear: 2026,
        origin: { city: 'Uyo', countryCode: 'NG' },
        culturalContext: 'Synthetic integration-test content only.',
        tags: ['integration-test', 'withdrawal'],
        accessibilityText: 'A synthetic artwork used for withdrawal verification.',
        rights: {
          basis: 'ORIGINAL',
          rightsConfirmed: true,
          attributionText: 'Integration test fixture',
          thirdPartyPermissions: '',
          communityPermission: 'NOT_REQUIRED',
          displayLicense: 'ALL_RIGHTS_RESERVED',
        },
        contentNotice: { containsSensitiveCulturalMaterial: false, publicDisplayRestrictions: [] },
      });
      assert.equal(created.status, 201, JSON.stringify(created));
      const withdrawnId = created.data.artwork.artworkId;

      // Withdrawal is allowed for a pending submission, not an untouched DRAFT.
      const withdrawalImage = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      const uploadIntent = await creator.request<{ mediaId: string; uploadUrl: string; requiredHeaders: { 'Content-Type': string } }>(
        `/creator/artworks/${withdrawnId}/media/upload-intents`,
        'POST',
        {
          filename: 'withdrawal-test.png',
          mimeType: 'image/png',
          byteSize: withdrawalImage.length,
          caption: 'Withdrawal test image',
          accessibilityText: 'A synthetic image for the withdrawal lifecycle test.',
          isCover: true,
        },
      );
      assert.equal(uploadIntent.status, 201, JSON.stringify(uploadIntent));
      const uploadResponse = await fetch(uploadIntent.data.uploadUrl, {
        method: 'PUT',
        headers: uploadIntent.data.requiredHeaders,
        body: withdrawalImage,
      });
      assert.equal(uploadResponse.status, 200);
      const mediaCompleted = await creator.request(
        `/creator/artworks/${withdrawnId}/media/${uploadIntent.data.mediaId}/complete`,
        'POST',
        {},
      );
      assert.equal(mediaCompleted.status, 200, JSON.stringify(mediaCompleted));
      const submitted = await creator.request(`/creator/artworks/${withdrawnId}/submit`, 'POST', {
        confirmRightsAndPermissions: true,
        confirmAccurateAttribution: true,
        confirmCulturalCare: true,
        confirmPublicVisibility: true,
      });
      assert.equal(submitted.status, 202, JSON.stringify(submitted));
      assert.equal((submitted.data as { status: string }).status, 'PENDING_REVIEW');

      const withdrawn = await creator.request(`/creator/artworks/${withdrawnId}/withdraw`, 'POST', {});
      assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn));
      assert.deepEqual(withdrawn.data, { artworkId: withdrawnId, status: 'ARCHIVED', public: false });
      // Assert this artwork's own withdrawal event; do not depend on publication/takedown
      // side effects from a different nested test.
      const withdrawalAudit = await one<{ total: number }>(runtimePool,
        "SELECT count(*)::int AS total FROM seven.audit_events WHERE action_code='creator_artwork.withdrawn' AND resource_id=$1",
        [withdrawnId],
      );
      assert.equal(Number(withdrawalAudit?.total), 1, 'Withdrawal must write exactly one audit event for this artwork.');
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (runtimePool !== pool) await runtimePool.end();
    await new Promise<void>((resolve, reject) => storageServer.close((error) => error ? reject(error) : resolve()));
    if (previousStorageUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousStorageUrl;
    if (previousStorageSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousStorageSecret;
    await pool.end();
  }
});

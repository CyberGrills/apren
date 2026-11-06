import { api } from './api.ts';

export type CreatorProfileStatus = 'DRAFT' | 'PENDING_REVIEW' | 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'SUSPENDED';
export type CreatorArtworkStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'ARCHIVED' | 'SUSPENDED';
export type CreatorDiscipline = 'DIGITAL_ART' | 'PHOTOGRAPHY' | 'FASHION_DESIGN' | 'ILLUSTRATION' | 'SCULPTURE' | 'PAINTING' | 'TEXTILE_ART' | 'CRAFT' | 'HERITAGE_STORY' | 'OTHER';
export type RightsBasis = 'ORIGINAL' | 'LICENSED' | 'AUTHORIZED_REPRESENTATIVE';
export type DisplayLicense = 'ALL_RIGHTS_RESERVED' | 'CC_BY_4_0' | 'CC_BY_NC_4_0' | 'OTHER_DOCUMENTED_LICENSE';
export type CommunityPermission = 'NOT_REQUIRED' | 'OBTAINED' | 'PENDING' | 'NOT_SURE';

export interface CreatorProfile {
  creatorId: string;
  slug: string;
  displayName: string;
  location: { city: string; region: string | null; countryCode: string };
  disciplines: string[];
  biography: string;
  portfolioUrls: string[];
  profileStatus: CreatorProfileStatus;
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export interface CreatorRights {
  basis: RightsBasis;
  rightsConfirmed: true;
  attributionText: string;
  thirdPartyPermissions: string;
  communityPermission: CommunityPermission;
  communityPermissionDetails?: string | null;
  displayLicense: DisplayLicense;
}
export interface CreatorMedia {
  mediaId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  caption: string;
  accessibilityText: string;
  isCover: boolean;
  status: 'PENDING_UPLOAD' | 'READY_FOR_REVIEW' | 'REMOVED';
  sortOrder: number;
  storagePath?: string;
}
export interface CreatorReviewFeedback {
  category: string;
  message: string;
}
export interface CreatorArtwork {
  artworkId: string;
  title: string;
  slug?: string;
  discipline: CreatorDiscipline;
  description: string;
  creationYear: number | null;
  origin: Record<string, unknown>;
  culturalContext: string;
  tags: string[];
  accessibilityText: string;
  rights: CreatorRights;
  contentNotice: Record<string, unknown>;
  media: CreatorMedia[];
  status?: CreatorArtworkStatus;
  reviewFeedback?: CreatorReviewFeedback[];
  submittedAt?: string | null;
  reviewedAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string;
  creator?: { slug: string; displayName: string; location: CreatorProfile['location'] };
}
export interface CreatorArtworkSummary {
  artworkId: string;
  title: string;
  discipline: CreatorDiscipline;
  status: CreatorArtworkStatus;
  updatedAt: string;
}
export interface CreatorUploadIntent {
  mediaId: string;
  uploadUrl: string;
  token: string;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}
export interface CreatorRightsRecord {
  evidence?: Array<{ evidence_id: string; evidence_type: string; issuer_name: string; evidence_reference: string; description: string; status: string; review_reason?: string | null }>;
  communityPermissions?: Array<{ permission_id: string; community_name: string; authority_name: string; permission_scope: string; evidence_reference: string; cultural_context: string; status: string; review_reason?: string | null }>;
  attributionReviews?: Array<{ attribution_review_id: string; attribution_text: string; source_description: string; status: string; review_reason?: string | null }>;
}

const key = () => crypto.randomUUID();
const artworkPath = (id: string) => `/creator/artworks/${encodeURIComponent(id)}`;

export const creatorApi = {
  getProfile: () => api<{ creator: CreatorProfile | null }>('/creator/profile'),
  saveProfile: (input: {
    displayName: string;
    location: { city: string; region?: string; countryCode: string };
    disciplines: string[];
    biography: string;
    portfolioUrls: string[];
  }) => api<{ creator: CreatorProfile }>('/creator/profile', { method: 'PUT', body: input, idempotencyKey: key() }),
  submitProfile: () => api<{ creatorId: string; profileStatus: CreatorProfileStatus; submittedAt: string }>('/creator/profile/submit', { method: 'POST', body: {}, idempotencyKey: key() }),
  listArtworks: () => api<{ items: CreatorArtworkSummary[]; nextCursor: string | null }>('/creator/artworks?limit=50'),
  getArtwork: (id: string) => api<{ artwork: CreatorArtwork }>(artworkPath(id)),
  createArtwork: (input: Omit<CreatorArtwork, 'artworkId' | 'media' | 'status' | 'reviewFeedback' | 'submittedAt' | 'reviewedAt' | 'publishedAt' | 'creator'>) => api<{ artwork: CreatorArtworkSummary }>('/creator/artworks', { method: 'POST', body: input, idempotencyKey: key() }),
  updateArtwork: (id: string, input: Partial<Omit<CreatorArtwork, 'artworkId' | 'media' | 'status' | 'reviewFeedback' | 'submittedAt' | 'reviewedAt' | 'publishedAt' | 'creator'>>) => api<{ artwork: { artworkId: string; status: CreatorArtworkStatus } }>(artworkPath(id), { method: 'PATCH', body: input, idempotencyKey: key() }),
  createUploadIntent: (id: string, input: { filename: string; mimeType: string; byteSize: number; caption: string; accessibilityText: string; isCover: boolean }) => api<CreatorUploadIntent>(`${artworkPath(id)}/media/upload-intents`, { method: 'POST', body: input, idempotencyKey: key() }),
  completeUpload: (id: string, mediaId: string) => api<{ mediaId: string; status: 'READY_FOR_REVIEW' }>(`${artworkPath(id)}/media/${encodeURIComponent(mediaId)}/complete`, { method: 'POST', body: {}, idempotencyKey: key() }),
  updateMedia: (id: string, mediaId: string, input: { caption?: string; accessibilityText?: string }) => api(`${artworkPath(id)}/media/${encodeURIComponent(mediaId)}`, { method: 'PATCH', body: input, idempotencyKey: key() }),
  reorderMedia: (id: string, mediaIds: string[]) => api(`${artworkPath(id)}/media/reorder`, { method: 'POST', body: { mediaIds }, idempotencyKey: key() }),
  setCover: (id: string, mediaId: string) => api(`${artworkPath(id)}/media/${encodeURIComponent(mediaId)}/cover`, { method: 'PUT', body: {}, idempotencyKey: key() }),
  removeMedia: (id: string, mediaId: string) => api(`${artworkPath(id)}/media/${encodeURIComponent(mediaId)}`, { method: 'DELETE', idempotencyKey: key() }),
  submitArtwork: (id: string, confirmations: { confirmRightsAndPermissions: true; confirmAccurateAttribution: true; confirmCulturalCare: true; confirmPublicVisibility: true }) => api<{ artworkId: string; status: CreatorArtworkStatus; submittedAt: string }>(`${artworkPath(id)}/submit`, { method: 'POST', body: confirmations, idempotencyKey: key() }),
  getRights: (id: string) => api<CreatorRightsRecord>(`${artworkPath(id)}/rights`),
  addRightsEvidence: (id: string, input: { evidenceType: 'LICENSE' | 'OWNERSHIP' | 'AUTHORIZED_REPRESENTATIVE' | 'SOURCE_PERMISSION' | 'OTHER'; issuerName: string; evidenceReference: string; description: string }) => api(`${artworkPath(id)}/rights/evidence`, { method: 'POST', body: input, idempotencyKey: key() }),
  addCommunityPermission: (id: string, input: { communityName: string; authorityName: string; permissionScope: string; evidenceReference: string; culturalContext: string }) => api(`${artworkPath(id)}/rights/community-permissions`, { method: 'POST', body: input, idempotencyKey: key() }),
  submitAttribution: (id: string, input: { attributionText: string; sourceDescription: string }) => api(`${artworkPath(id)}/rights/attribution`, { method: 'POST', body: input, idempotencyKey: key() }),
  publicArtworks: (discipline?: string) => api<{ items: PublicArtwork[]; nextCursor: string | null }>(`/art-culture/artworks?limit=50${discipline ? `&discipline=${encodeURIComponent(discipline)}` : ''}`),
  publicCreator: (slug: string) => api<{ creator: PublicCreator; artworks: PublicArtwork[] }>(`/art-culture/creators/${encodeURIComponent(slug)}`),
};

export interface PublicArtwork {
  artworkId: string;
  slug: string;
  title: string;
  discipline: string;
  description: string;
  creationYear: number | null;
  origin: Record<string, unknown>;
  culturalContext: string;
  tags: string[];
  accessibilityText: string;
  attribution?: string;
  displayLicense?: string;
  media: Array<{ url: string; caption: string; accessibilityText: string; isCover: boolean }>;
  publishedAt: string;
  creator: { slug: string; displayName: string; location: CreatorProfile['location'] };
}
export interface PublicCreator {
  slug: string;
  displayName: string;
  location: CreatorProfile['location'];
  disciplines: string[];
  biography: string;
}

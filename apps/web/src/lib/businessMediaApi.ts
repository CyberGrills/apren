import { api } from './api.ts';

export type BusinessMediaStatus =
  | 'PENDING_UPLOAD'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REMOVED';

export interface BusinessMediaItem {
  mediaId: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  caption: string;
  altText: string;
  status: BusinessMediaStatus;
  rejectionReason: string | null;
  sortOrder: number;
  isCover: boolean;
  imageUrl: string | null;
  createdAt: string;
}

export interface BusinessMediaList {
  items: BusinessMediaItem[];
}

export interface BusinessMediaUploadIntent {
  mediaId: string;
  uploadUrl: string;
  token: string;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}

export interface BusinessMediaReviewItem {
  mediaId: string;
  businessId: string;
  businessName: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  caption: string;
  altText: string;
  createdAt: string;
  replacedMediaId: string | null;
  imageUrl: string | null;
}

export interface BusinessMediaReviewList {
  items: BusinessMediaReviewItem[];
}

export const businessMediaRoutes = {
  ownerList: '/business/media',
  uploadIntents: '/business/media/upload-intents',
  completeUpload: (mediaId: string) => `/business/media/${encodeURIComponent(mediaId)}/complete`,
  update: (mediaId: string) => `/business/media/${encodeURIComponent(mediaId)}`,
  cover: (mediaId: string) => `/business/media/${encodeURIComponent(mediaId)}/cover`,
  order: '/business/media/order',
  adminList: '/admin/business-media',
  review: (mediaId: string) => `/admin/business-media/${encodeURIComponent(mediaId)}/review`,
} as const;

export const businessMediaApi = {
  createUploadIntent(input: {
    filename: string;
    mimeType: string;
    byteSize: number;
    caption: string;
    altText: string;
    replacesMediaId?: string;
  }) {
    return api<BusinessMediaUploadIntent>(businessMediaRoutes.uploadIntents, {
      method: 'POST',
      body: input,
    });
  },
  completeUpload(mediaId: string) {
    return api<{ mediaId: string; status: BusinessMediaStatus }>(
      businessMediaRoutes.completeUpload(mediaId),
      { method: 'POST', body: {} },
    );
  },
  updateDetails(mediaId: string, input: { caption: string; altText: string }) {
    return api(businessMediaRoutes.update(mediaId), { method: 'PATCH', body: input });
  },
  setCover(mediaId: string) {
    return api(businessMediaRoutes.cover(mediaId), { method: 'PATCH', body: {} });
  },
  reorder(mediaIds: string[]) {
    return api(businessMediaRoutes.order, { method: 'PATCH', body: { mediaIds } });
  },
  remove(mediaId: string) {
    return api(businessMediaRoutes.update(mediaId), { method: 'DELETE' });
  },
  review(mediaId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) {
    return api(businessMediaRoutes.review(mediaId), {
      method: 'PATCH',
      body: { decision, ...(reason ? { reason } : {}) },
    });
  },
};

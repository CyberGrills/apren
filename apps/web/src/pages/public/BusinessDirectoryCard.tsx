import type { DirectoryKind } from '../../lib/nigeriaDirectory.ts';

export interface BusinessDirectoryProfile {
  id: string;
  slug: string;
  name: string;
  kind: DirectoryKind;
  state: string | null;
  city: string;
  venueName: string | null;
  address: string | null;
  description: string | null;
  imageUrl: string | null;
  photos?: { imageUrl: string; altText: string; caption: string; isCover: boolean }[];
  verificationStatus: 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';
  businessStatus: 'APPROVED';
  listingStatus: 'DIRECTORY_ONLY';
  bookable: false;
  hasPublishedOffering: boolean;
}

const categoryLabel: Record<DirectoryKind, string> = {
  STAY: 'Stay',
  DINING: 'Dining',
  EXPERIENCE: 'Experience',
};

export function BusinessDirectoryCard({ profile }: { profile: BusinessDirectoryProfile }) {
  return (
    <article className="seven-directory-card seven-business-directory-card">
      {profile.photos?.length ? (
        <div className="seven-business-photo-gallery" aria-label={`${profile.name} photo gallery`}>
          <div className="seven-directory-image-link">
            <img
              src={profile.photos[0]?.imageUrl}
              alt={profile.photos[0]?.altText || `${profile.name} in ${profile.city}, ${profile.state ?? 'Nigeria'}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            {profile.photos[0]?.caption && <span className="seven-business-photo-caption">{profile.photos[0].caption}</span>}
          </div>
          {profile.photos.length > 1 && <div className="seven-business-photo-thumbnails">
            {profile.photos.slice(1, 5).map((photo) => (
              <img key={photo.imageUrl} src={photo.imageUrl} alt={photo.altText} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ))}
          </div>}
        </div>
      ) : profile.imageUrl ? (
        <div className="seven-directory-image-link">
          <img
            src={profile.imageUrl}
            alt={`${profile.name} in ${profile.city}, ${profile.state ?? 'Nigeria'}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div
          className="seven-directory-image-link seven-business-directory-photo-placeholder"
          role="img"
          aria-label={`Original ${profile.name} photo is not available yet`}
        >
          <span>Original photos pending</span>
        </div>
      )}
      <div className="seven-directory-card-body">
        <div className="seven-directory-card-meta">
          <span>{categoryLabel[profile.kind]} · Business profile</span>
          <span>Directory only</span>
        </div>
        <h3>{profile.name}</h3>
        <p className="seven-directory-location">
          {profile.city}{profile.state ? `, ${profile.state}` : ''}
        </p>
        {profile.venueName && <p className="seven-directory-area">{profile.venueName}</p>}
        {profile.address && <p className="seven-directory-area">{profile.address}</p>}
        <p className="seven-directory-description">
          {profile.description ?? 'Original profile details are being restored from the submitted business record.'}
        </p>
        {profile.kind === 'STAY' && profile.verificationStatus === 'REVIEW_REQUIRED' && (
          <p className="seven-business-directory-warning">
            Property evidence requires review. This is not a verified 7even stay.
          </p>
        )}
        <p className="seven-directory-disclaimer">
          {profile.hasPublishedOffering
            ? 'This directory card cannot start a booking. Current authoritative inventory must still pass the server-side eligibility check.'
            : 'No published offering is attached to this business yet. Booking is disabled.'}
        </p>
      </div>
    </article>
  );
}

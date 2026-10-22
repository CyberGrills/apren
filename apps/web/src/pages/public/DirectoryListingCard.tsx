import type { DirectoryListing } from '../../lib/nigeriaDirectory.ts';

const categoryLabel = {
  STAY: 'Stay',
  DINING: 'Dining',
  EXPERIENCE: 'Experience',
} as const;

export function DirectoryListingCard({ listing }: { listing: DirectoryListing }) {
  return (
    <article className="seven-directory-card">
      <a
        className="seven-directory-image-link"
        href={listing.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`View ${listing.name} at its source website`}
      >
        <img
          src={listing.imageUrl}
          alt={`${listing.name} in ${listing.city}, ${listing.state}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.visibility = 'hidden';
          }}
        />
      </a>
      <div className="seven-directory-card-body">
        <div className="seven-directory-card-meta">
          <span>{categoryLabel[listing.kind]}</span>
          <span>Directory only</span>
        </div>
        <h3>{listing.name}</h3>
        <p className="seven-directory-location">
          {listing.city}, {listing.state}
        </p>
        {listing.area && <p className="seven-directory-area">{listing.area}</p>}
        <p className="seven-directory-description">{listing.description}</p>
        <a
          className="seven-directory-source-link"
          href={listing.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          View source listing <span aria-hidden="true">↗</span>
        </a>
        <a
          className="seven-directory-photo-credit"
          href={listing.imageSourceUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Photo: {listing.imageSourceName}
        </a>
        <p className="seven-directory-disclaimer">Not bookable on 7even yet.</p>
      </div>
    </article>
  );
}

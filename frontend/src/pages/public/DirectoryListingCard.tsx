import type { DirectoryListing } from '../../lib/nigeriaDirectory.ts';
import { OfflineSaveButton } from '../../components/OfflineSaveButton.tsx';

const categoryLabel = {
  STAY: 'Stay',
  DINING: 'Dining',
  EXPERIENCE: 'Experience',
} as const;

export function DirectoryListingCard({ listing }: { listing: DirectoryListing }) {
  return (
    <article className="seven-directory-card">
      {listing.photoStatus && listing.photoStatus !== 'AVAILABLE' ? (
        <div className="seven-directory-image-link seven-business-directory-photo-placeholder" role="img" aria-label={`Original ${listing.name} photos are pending`}>
          <span>{listing.photoStatus === 'PENDING_MEDIA_IMPORT' ? 'Uploaded property photos being prepared' : 'Property photos pending owner upload'}</span>
        </div>
      ) : (
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
      )}
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
        {listing.amenities && listing.amenities.length > 0 && (
          <section className="seven-directory-amenities" aria-label="Property-sourced amenities pending confirmation">
            <p className="public-eyebrow">Property-sourced amenities · pending confirmation</p>
            <ul>{listing.amenities.slice(0, 8).map((amenity) => <li key={amenity.name}>{amenity.name}</li>)}</ul>
          </section>
        )}
        <OfflineSaveButton listing={listing} />
        <a
          className="seven-directory-source-link"
          href={listing.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          View source listing <span aria-hidden="true">↗</span>
        </a>
        {(!listing.photoStatus || listing.photoStatus === 'AVAILABLE') && (
          <a
            className="seven-directory-photo-credit"
            href={listing.imageSourceUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Photo: {listing.imageSourceName}
          </a>
        )}
        {listing.publishedRateNotes && (
          <section className="seven-directory-rate-notes" aria-label="Published third-party rate references">
            <p className="public-eyebrow">Published rate references · not live quotes</p>
            <p className="seven-directory-rate-warning">
              These are published website references, not live 7EVEN rates or date-specific availability. The hotel team must confirm the current rate and cancellation terms before the property becomes bookable.
            </p>
            <ul>
              {listing.publishedRateNotes.map((note) => (
                <li key={`${note.source}:${note.roomType}`}>
                  <span><strong>{note.roomType}</strong><small><a href={note.url} target="_blank" rel="noreferrer noopener">{note.source}</a></small></span>
                  <span>{note.rate}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {listing.externalListings && (
          <nav className="seven-directory-external-links" aria-label="Other booking and source listings">
            {listing.externalListings.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">
                {source.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </nav>
        )}
        {listing.contactPhone && (
          <p className="seven-directory-contact">
            Contact the property: <a href={`tel:${listing.contactPhone.replace(/[^+\d]/g, '')}`}>{listing.contactPhone}</a>
          </p>
        )}
        {listing.contactEmail && (
          <p className="seven-directory-contact">
            Email: <a href={`mailto:${listing.contactEmail}`}>{listing.contactEmail}</a>
          </p>
        )}
        {listing.officialBookingUrl && (
          <a className="btn btn-primary seven-directory-direct-booking" href={listing.officialBookingUrl} target="_blank" rel="noreferrer noopener">
            Check dates with the property <span aria-hidden="true">↗</span>
          </a>
        )}
        {listing.kind === 'STAY' && listing.claimable && (
          <a className="btn btn-primary seven-directory-claim" href={`/business/apply?listingId=${encodeURIComponent(listing.id)}`}>
            Claim this hotel
          </a>
        )}
        {listing.kind === 'STAY' && listing.claimed && (
          <p className="seven-business-directory-warning">Property onboarding is in progress. Live booking will open after owner verification and hotel-managed inventory setup.</p>
        )}
        <p className="seven-directory-disclaimer">
          Not bookable through 7EVEN yet. The property must claim its profile, complete verification, add room categories and rate plans, and publish current nightly availability before guests can reserve.
        </p>
      </div>
    </article>
  );
}

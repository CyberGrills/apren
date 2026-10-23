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
        {listing.publishedRateNotes && (
          <section className="seven-directory-rate-notes" aria-label="Published third-party rate references">
            <p className="public-eyebrow">Published rate references · not live quotes</p>
            <p className="seven-directory-rate-warning">
              Sources disagree on prices. These are public snapshots, not guaranteed 7even rates or date-specific availability. Confirm the final total and cancellation terms with the property before paying.
            </p>
            <ul>
              {listing.publishedRateNotes.map((note) => (
                <li key={`${note.source}:${note.roomType}`}>
                  <span><strong>{note.roomType}</strong><small>{note.source}</small></span>
                  <span>{note.rate}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {listing.externalListings && (
          <div className="seven-directory-external-links" aria-label="Other booking and source listings">
            {listing.externalListings.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">
                {source.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        )}
        {listing.whatsappNumber && (
          <a
            className="btn btn-secondary seven-directory-direct-booking"
            href={`https://wa.me/${listing.whatsappNumber}?text=${encodeURIComponent(
              `Hello Kiniz team, I found Kiniz Apartments & Hotel on 7EVEN. Please confirm current room availability, rates, and cancellation terms for my dates before I make a booking.`,
            )}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Message Kiniz on WhatsApp <span aria-hidden="true">↗</span>
          </a>
        )}
        {listing.contactPhone && (
          <p className="seven-directory-contact">
            Call Kiniz: <a href={`tel:${listing.contactPhone.replace(/[^+\d]/g, '')}`}>{listing.contactPhone}</a>
          </p>
        )}
        {listing.contactEmail && (
          <p className="seven-directory-contact">
            Email: <a href={`mailto:${listing.contactEmail}`}>{listing.contactEmail}</a>
          </p>
        )}
        {listing.officialBookingUrl && (
          <a className="btn btn-primary seven-directory-direct-booking" href={listing.officialBookingUrl} target="_blank" rel="noreferrer noopener">
            Check dates with Kiniz <span aria-hidden="true">↗</span>
          </a>
        )}
        <p className="seven-directory-disclaimer">Not bookable or payable through 7even yet. Use the official or marketplace booking flow for date-specific rates and payment protections.</p>
      </div>
    </article>
  );
}

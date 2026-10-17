import type { Offering } from '@7even/contracts';
import { ArrowLeft, ArrowUpRight, Check, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorNotice, Loading } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { BookingPanel } from './BookingPanel.tsx';
import { editorialImages, PublicFooter, PublicHeader } from './PublicShell.tsx';

export function OfferingPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<Offering>(
    id ? `/offerings/${encodeURIComponent(id)}` : null,
  );
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="public-container offering-page">
        {loading && <Loading />}
        {error && <ErrorNotice message={error} retry={reload} />}
        {data && <OfferingDetail key={data.id} offering={data} />}
      </main>
      <PublicFooter />
    </div>
  );
}

function OfferingDetail({ offering }: { offering: Offering }) {
  const [image, setImage] = useState(0);
  const fallback =
    offering.kind === 'STAY'
      ? editorialImages.room
      : offering.kind === 'DINING'
        ? editorialImages.dining
        : editorialImages.beach;
  const pictures = Array.from(new Set(offering.images.length ? offering.images : [fallback]));
  return (
    <>
      <Link to={`/explore?kind=${offering.kind}`} className="offering-back">
        <ArrowLeft size={16} aria-hidden="true" /> Back to{' '}
        {offering.kind === 'STAY' ? 'stays' : offering.kind === 'DINING' ? 'dining' : 'experiences'}
      </Link>
      <header className="offering-heading">
        <div>
          <span className="public-eyebrow">
            {offering.businessName}
            {offering.isSample && ' / Sample business'}
          </span>
          <h1>{offering.title}</h1>
          <p>
            <MapPin size={15} aria-hidden="true" />
            {offering.city}, Nigeria
          </p>
        </div>
        <span className="offering-sector">
          {offering.kind === 'STAY'
            ? 'Stay a while'
            : offering.kind === 'DINING'
              ? 'Around the table'
              : 'Make a day of it'}{' '}
          <ArrowUpRight size={18} aria-hidden="true" />
        </span>
      </header>
      <div className="offering-layout">
        <div className="offering-content">
          <figure className="offering-gallery">
            <img
              src={pictures[image]}
              alt={
                offering.images.length
                  ? `${offering.title}, photo ${image + 1}`
                  : 'Illustrative hospitality photograph. This image does not represent the listed business.'
              }
              width="1500"
              height="1000"
              fetchPriority="high"
            />
            {pictures.length > 1 && (
              <fieldset className="offering-thumbnails">
                <legend className="sr-only">Choose a photograph</legend>
                {pictures.map((src, index) => (
                  <button
                    type="button"
                    key={src}
                    aria-label={`View photograph ${index + 1}`}
                    aria-pressed={image === index}
                    onClick={() => setImage(index)}
                  >
                    <img src={src} alt="" width="120" height="90" />
                  </button>
                ))}
              </fieldset>
            )}
            {(!offering.images.length || offering.isSample) && (
              <figcaption>
                Illustrative photography. Sample listings are for local testing and are not live
                merchant inventory.
              </figcaption>
            )}
          </figure>
          <section className="offering-about" aria-labelledby="about-title">
            <span className="public-eyebrow">A little about the place</span>
            <h2 id="about-title">Make yourself at home.</h2>
            <p>{offering.description}</p>
          </section>
          {offering.amenities.length > 0 && (
            <section className="offering-amenities" aria-labelledby="included-title">
              <h2 id="included-title">Good to know.</h2>
              <ul>
                {offering.amenities.map((amenity) => (
                  <li key={amenity}>
                    <Check size={17} aria-hidden="true" />
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="offering-policy" aria-labelledby="details-title">
            <h2 id="details-title">Before you book.</h2>
            <dl>
              <div>
                <dt>The place</dt>
                <dd>
                  {offering.address}, {offering.city}
                </dd>
              </div>
              <div>
                <dt>Booking and payment</dt>
                <dd>
                  Your booking is confirmed after the payment provider's result has been verified. A
                  payment still being checked does not mean your reservation is confirmed.
                </dd>
              </div>
              <div>
                <dt>Cancellation</dt>
                <dd>
                  Cancel at least {offering.cancellationHours} hours before the start time, subject
                  to the business's policy. Refund and settlement status are shown separately in
                  your bookings.
                </dd>
              </div>
              <div>
                <dt>Your points</dt>
                <dd>
                  Points are issued for eligible completed bookings. A booking that is cancelled or
                  refunded does not earn points.
                </dd>
              </div>
            </dl>
          </section>
        </div>
        <BookingPanel offering={offering} />
      </div>
    </>
  );
}

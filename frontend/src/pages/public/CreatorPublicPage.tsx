import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Palette } from 'lucide-react';
import { ErrorNotice, Loading, PageHeader } from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import type { PublicArtwork, PublicCreator } from '../../lib/creatorApi.ts';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

export function CreatorPublicPage() {
  const { slug = '' } = useParams();
  const { data, loading, error, reload } = useApi<{ creator: PublicCreator; artworks: PublicArtwork[] }>(slug ? `/art-culture/creators/${encodeURIComponent(slug)}` : null);
  const creator = data?.creator;
  return <div className="public-page creator-public-page"><PublicHeader /><main id="main-content" className="public-container creator-public-main">
    <Link to="/campus-connect/art-culture" className="creator-back-link"><ArrowLeft size={15} /> Art & Culture collection</Link>
    {loading && <Loading />}{error && <ErrorNotice message={error} retry={reload} />}
    {creator && <>
      <header className="creator-public-hero"><p className="public-eyebrow">VERIFIED 7EVEN CREATOR</p><h1>{creator.displayName}</h1><p className="creator-public-location"><MapPin size={16} /> {[creator.location.city, creator.location.region, creator.location.countryCode].filter(Boolean).join(', ')}</p><p className="creator-public-bio">{creator.biography}</p><div className="creator-public-disciplines">{creator.disciplines.map((discipline) => <span key={discipline}><Palette size={13} />{discipline}</span>)}</div></header>
      <section className="creator-public-works"><PageHeader eyebrow="APPROVED PORTFOLIO" title="Published work" description="Only artworks approved by 7EVEN moderators are shown on this public page." />
        {data.artworks.length === 0 ? <p className="creator-inline-note">This verified creator has no published artworks yet.</p> : <div className="creator-public-grid">{data.artworks.map((artwork) => <PublicArtworkCard artwork={artwork} key={artwork.artworkId} />)}</div>}
      </section>
    </>}
    {!loading && !error && !creator && <div className="creator-public-missing"><h1>Creator page unavailable</h1><p>This creator profile may not be verified or may no longer be public.</p><Link className="btn btn-primary" to="/campus-connect/art-culture">Return to Art & Culture</Link></div>}
  </main><PublicFooter /></div>;
}

export function PublicArtworkCard({ artwork }: { artwork: PublicArtwork }) {
  const cover = artwork.media.find((media) => media.isCover) ?? artwork.media[0];
  return <article className="creator-public-artwork">{cover ? <img src={cover.url} alt={cover.accessibilityText || artwork.accessibilityText} loading="lazy" /> : <div className="creator-public-artwork-placeholder"><Palette size={28} /></div>}<div className="creator-public-artwork-copy"><p className="public-eyebrow">{artwork.discipline.replaceAll('_', ' ')}</p><h3>{artwork.title}</h3><p>{artwork.description}</p><p className="creator-public-attribution">{artwork.attribution || 'Creator attribution available'} · <Link to={`/creators/${encodeURIComponent(artwork.creator.slug)}`}>{artwork.creator.displayName}</Link></p></div></article>;
}

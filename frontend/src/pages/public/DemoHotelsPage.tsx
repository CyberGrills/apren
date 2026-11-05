import { ArrowLeft, BedDouble, MapPin, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';
import { demoProperties } from './demoHotels.ts';

const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);

export function DemoHotelsPage() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'ALL' | 'HOTEL' | 'APARTMENT'>('ALL');
  const [city, setCity] = useState('ALL');
  const cities = useMemo(() => [...new Set(demoProperties.map((property) => property.city))], []);
  const visible = useMemo(() => demoProperties.filter((property) => {
    const matchesQuery = `${property.name} ${property.city} ${property.state}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (kind === 'ALL' || property.kind === kind) && (city === 'ALL' || property.city === city);
  }), [query, kind, city]);

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="public-container demo-catalog" id="main-content">
        <div className="demo-catalog-top">
          <Link to="/" className="public-text-link"><ArrowLeft size={16} /> Back to 7even</Link>
          <Link to="/demo/marketplace" className="public-text-link">Try the interactive demo marketplace <ArrowLeft size={16}/></Link>
        </div>
        <header className="demo-catalog-heading">
          <span className="public-eyebrow">7EVEN · PRODUCT DEMONSTRATION</span>
          <h1>Stay ideas, <em>all in one place.</em></h1>
          <p>Explore 100 fictional hotel and apartment profiles across Nigeria. Names, room counts and illustrative nightly prices are demonstration content—not real businesses, offers or availability.</p>
        </header>
        <section className="demo-catalog-controls" aria-label="Filter demo properties">
          <label className="demo-catalog-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search property, city or state" aria-label="Search demo properties" /></label>
          <label>Property type<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="ALL">All types</option><option value="HOTEL">Hotels</option><option value="APARTMENT">Apartments</option></select></label>
          <label>Destination<select value={city} onChange={(event) => setCity(event.target.value)}><option value="ALL">All destinations</option>{cities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <strong className="demo-catalog-count">{visible.length} of 100</strong>
        </section>
        <div className="demo-catalog-grid">
          {visible.map((property) => (
            <article className="demo-catalog-card" key={property.id}>
              <div className="demo-catalog-gallery">
                {property.images.slice(0,3).map((src,index) => <img key={src} src={src} alt={`Illustrative editorial property image ${index+1}; not an actual photo of ${property.name}`} loading="lazy" />)}
                <span className="demo-only-pill">DEMO ONLY</span>
              </div>
              <div className="demo-catalog-card-copy">
                <div className="demo-catalog-card-title"><span className="public-eyebrow">{property.kind === 'HOTEL' ? 'Hotel' : 'Apartment'}</span><span>{property.city}, {property.state}</span></div>
                <h2>{property.name}</h2>
                <p className="demo-catalog-location"><MapPin size={14} /> {property.city}, Nigeria</p>
                <div className="demo-catalog-facts"><span><BedDouble size={15} /> {property.rooms} sample rooms</span><span><Users size={15} /> Up to {property.guests} guests</span></div>
                <div className="demo-catalog-amenities">{property.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
                <div className="demo-catalog-price"><div><strong>{money(property.pricePerNight)}</strong><small> / night · illustrative</small></div><span>Not bookable</span></div>
              </div>
            </article>
          ))}
        </div>
        {visible.length === 0 && <div className="demo-catalog-empty"><h2>No demo properties match.</h2><p>Try another city or search term.</p></div>}
        <p className="demo-catalog-footnote">Photography is licensed/hosted editorial imagery for interface demonstration only and does not depict the fictional property named on each card. No listing here represents a verified hotel partner. No reservation or payment can be made from this catalogue.</p>
      </main>
      <PublicFooter />
    </div>
  );
}

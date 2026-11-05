import { ArrowRight, ArrowUpRight, Palette, Camera, Shirt, BookOpen, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

const categories = [
  { name: 'Digital art', detail: 'Illustration, painting and new visual forms', icon: Palette },
  { name: 'Photography', detail: 'Contemporary life, places and people across Africa', icon: Camera },
  { name: 'Fashion & design', detail: 'Textiles, style, objects and visual identity', icon: Shirt },
  { name: 'Heritage & stories', detail: 'Living histories, craft and cultural knowledge', icon: BookOpen },
];

export function ArtCulturePage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [creatorOpen, setCreatorOpen] = useState(false);
  const filters = ['All', 'Digital art', 'Photography', 'Fashion & design', 'Heritage & stories'];

  return (
    <div className="public-page art-culture-page">
      <PublicHeader />
      <main id="main-content">
        <section className="ac-hero public-container">
          <div className="ac-hero-copy">
            <p className="public-eyebrow">7EVEN CAMPUS CONNECT · AFRICAN CREATIVITY</p>
            <p className="ac-kicker">A living canvas of Africa</p>
            <h1>Discover the stories <em>behind the art.</em></h1>
            <p className="ac-lead">A space for African artists, photographers, designers and cultural storytellers to be discovered, credited and celebrated.</p>
            <div className="ac-hero-actions">
              <a className="btn btn-primary" href="#discover">Explore the collection <ArrowRight size={16} /></a>
              <button className="btn btn-secondary" type="button" onClick={() => setCreatorOpen(true)}>For creators</button>
            </div>
            <p className="ac-note"><ShieldCheck size={15} /> Creator attribution, permission and cultural respect come first.</p>
          </div>
          <div className="ac-hero-art" aria-label="Abstract artwork inspired by African forms and patterns">
            <div className="ac-art-orbit ac-orbit-one" />
            <div className="ac-art-orbit ac-orbit-two" />
            <div className="ac-art-sun" />
            <div className="ac-art-shape ac-shape-one" />
            <div className="ac-art-shape ac-shape-two" />
            <span className="ac-art-caption">AFRICA · INFINITE EXPRESSION</span>
          </div>
        </section>

        <section className="ac-intro public-container" aria-labelledby="ac-intro-title">
          <div><p className="public-eyebrow">THE CULTURAL CANVAS</p><h2 id="ac-intro-title">Many voices. One continent of creativity.</h2></div>
          <p>From contemporary digital art to photography, fashion, craft and cultural storytelling, 7EVEN will help audiences find the people and perspectives shaping African creativity today.</p>
        </section>

        <section className="ac-categories public-container" aria-label="Art and culture categories">
          {categories.map(({ name, detail, icon: Icon }, index) => (
            <button type="button" className={activeCategory === name ? 'ac-category is-active' : 'ac-category'} key={name} onClick={() => { setActiveCategory(name); document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <span className="ac-category-index">0{index + 1}</span><Icon size={21} strokeWidth={1.5} /><strong>{name}</strong><span>{detail}</span><ArrowUpRight className="ac-category-arrow" size={17} />
            </button>
          ))}
        </section>

        <section className="ac-discover public-container" id="discover">
          <div className="ac-section-heading">
            <div><p className="public-eyebrow">DISCOVER</p><h2>Art, identity and imagination.</h2><p>Explore by creative discipline. New work will appear as creators are onboarded and submissions are reviewed.</p></div>
            <span className="ac-curation-label"><ShieldCheck size={15} /> Curated submissions</span>
          </div>
          <div className="ac-filter-row" role="group" aria-label="Filter creative disciplines">
            {filters.map((filter) => <button type="button" key={filter} className={activeCategory === filter ? 'is-active' : ''} onClick={() => setActiveCategory(filter)}>{filter}</button>)}
          </div>
          <div className="ac-empty-state">
            <div className="ac-empty-mark"><Sparkles size={26} strokeWidth={1.4} /></div>
            <p className="public-eyebrow">THE FIRST COLLECTION IS TAKING SHAPE</p>
            <h3>{activeCategory === 'All' ? 'A place for African creativity to be seen.' : `A space for ${activeCategory.toLowerCase()}.`}</h3>
            <p>We are preparing creator onboarding and a review process before publishing any artwork. No sample artists, unverified works or simulated ownership will be displayed.</p>
            <button type="button" className="btn btn-primary" onClick={() => setCreatorOpen(true)}>Creator information <ArrowRight size={16} /></button>
          </div>
        </section>

        <section className="ac-principles">
          <div className="public-container ac-principles-inner">
            <div><p className="public-eyebrow">OUR COMMITMENT</p><h2>Celebrate culture.<br /><em>Respect its roots.</em></h2></div>
            <div className="ac-principle-list">
              <article><strong>Credit the creator</strong><p>Every published work must identify its creator and provide clear attribution.</p></article>
              <article><strong>Respect cultural ownership</strong><p>Sacred, restricted or community-held material requires appropriate authorization.</p></article>
              <article><strong>Verify before publishing</strong><p>Submissions are reviewed for ownership, permission and accurate descriptions.</p></article>
            </div>
          </div>
        </section>

        <section className="ac-nft-note public-container">
          <div><p className="public-eyebrow">A FUTURE DIGITAL COLLECTION</p><h2>Built for discovery first. NFTs when the time is right.</h2><p>Our first release focuses on discovery, creator profiles and carefully reviewed collections. Blockchain minting, wallets and NFT transactions are intentionally not part of this release.</p></div>
          <span className="ac-phase-pill">PHASE 1 · DISCOVERY</span>
        </section>
      </main>
      <PublicFooter />
      {creatorOpen && <div className="ac-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreatorOpen(false); }}>
        <section className="ac-creator-modal" role="dialog" aria-modal="true" aria-labelledby="ac-modal-title">
          <button className="ac-modal-close" type="button" onClick={() => setCreatorOpen(false)} aria-label="Close creator information">×</button>
          <p className="public-eyebrow">FOR AFRICAN CREATORS</p>
          <h2 id="ac-modal-title">Your work deserves the right context.</h2>
          <p>We are preparing a creator onboarding process for artists, photographers, designers and cultural storytellers.</p>
          <ul><li>Creator profiles and portfolios</li><li>Artwork attribution and permission checks</li><li>Curated collections and editorial discovery</li><li>Future NFT options, introduced separately</li></ul>
          <p className="ac-modal-disclaimer">Creator submissions are not open yet. This preview does not collect or transmit personal information.</p>
          <button className="btn btn-primary" type="button" onClick={() => setCreatorOpen(false)}>Got it</button>
        </section>
      </div>}
    </div>
  );
}

import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Camera, CircleUserRound, FileCheck2, ImagePlus, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

const studioSteps = [
  { number: '01', title: 'Introduce yourself', detail: 'Your creator name, location, creative disciplines and a short biography.' , icon: CircleUserRound },
  { number: '02', title: 'Present your portfolio', detail: 'A small selection of work with titles, descriptions and original source files.' , icon: ImagePlus },
  { number: '03', title: 'Confirm your rights', detail: 'Explain who created each work and confirm the permissions needed to display it.' , icon: FileCheck2 },
  { number: '04', title: 'Editorial review', detail: 'The 7EVEN team checks attribution, cultural context and submission completeness.' , icon: BadgeCheck },
];

export function CreatorStudioPage() {
  return (
    <div className="public-page creator-space-page">
      <PublicHeader />
      <main id="main-content">
        <section className="creator-space-hero public-container">
          <div>
            <Link className="creator-back-link" to="/campus-connect/art-culture"><ArrowLeft size={16} /> Art &amp; Culture</Link>
            <p className="public-eyebrow">7EVEN CAMPUS CONNECT · CREATOR SPACE</p>
            <h1>Your work has a story. <em>Let it be seen.</em></h1>
            <p className="creator-space-lead">Creator Studio is the planned home for African artists, photographers, designers and cultural storytellers to prepare a profile and submit work for review.</p>
            <span className="creator-status"><LockKeyhole size={15} /> Creator onboarding is not open yet</span>
          </div>
          <div className="creator-space-art" aria-hidden="true">
            <div className="creator-space-ring" />
            <div className="creator-space-tile creator-tile-one"><PaletteMark /></div>
            <div className="creator-space-tile creator-tile-two"><Camera size={38} strokeWidth={1.2} /></div>
            <div className="creator-space-tile creator-tile-three"><BookOpen size={36} strokeWidth={1.2} /></div>
            <span>CREATE · CREDIT · PRESERVE</span>
          </div>
        </section>

        <section className="creator-process public-container" aria-labelledby="creator-process-title">
          <div className="creator-section-heading">
            <p className="public-eyebrow">THE CREATOR JOURNEY</p>
            <h2 id="creator-process-title">A thoughtful path from creator to collection.</h2>
            <p>When onboarding opens, every creator will have a clear process and know what is required before work can be published.</p>
          </div>
          <div className="creator-step-grid">
            {studioSteps.map(({ number, title, detail, icon: Icon }) => (
              <article className="creator-step" key={number}>
                <span className="creator-step-number">{number}</span>
                <Icon size={24} strokeWidth={1.5} />
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="creator-rights">
          <div className="public-container creator-rights-inner">
            <div>
              <p className="public-eyebrow">CREATOR RIGHTS &amp; CULTURAL CARE</p>
              <h2>Respect is part of the process.</h2>
              <p>Creators retain ownership of their work unless a separate, explicit agreement says otherwise. Display permission is not a transfer of copyright.</p>
            </div>
            <ul>
              <li><ShieldCheck size={19} /><span><strong>Clear attribution</strong><small>Names, credits and context stay connected to each work.</small></span></li>
              <li><LockKeyhole size={19} /><span><strong>Permission before publication</strong><small>Work is not published until rights and permissions are reviewed.</small></span></li>
              <li><BookOpen size={19} /><span><strong>Cultural context matters</strong><small>Sacred, restricted or community-held material requires appropriate authorization.</small></span></li>
            </ul>
          </div>
        </section>

        <section className="creator-studio-notice public-container">
          <div className="creator-notice-icon"><Sparkles size={22} /></div>
          <div>
            <p className="public-eyebrow">PHASE 1 · PREPARATION</p>
            <h2>We are preparing the creator experience.</h2>
            <p>This page is an interface preview only. It does not accept uploads, collect personal information, create accounts or submit work. Creator onboarding will open after the review and rights process is ready.</p>
          </div>
          <Link className="btn btn-secondary" to="/campus-connect/art-culture">Return to Art &amp; Culture <ArrowRight size={16} /></Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function CreatorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="public-page creator-profile-page">
      <PublicHeader />
      <main id="main-content" className="public-container creator-profile-main">
        <Link className="creator-back-link" to="/campus-connect/art-culture"><ArrowLeft size={16} /> Art &amp; Culture</Link>
        <section className="creator-profile-empty" aria-labelledby="creator-profile-title">
          <div className="creator-profile-mark"><CircleUserRound size={34} strokeWidth={1.2} /></div>
          <p className="public-eyebrow">7EVEN CREATOR PROFILE</p>
          <h1 id="creator-profile-title">This creator profile is not published yet.</h1>
          <p>{slug ? 'The requested creator page is not available in the current curated collection.' : 'Creator profiles will appear here after onboarding and review.'} We do not display placeholder artists, unverified portfolios or unapproved cultural material.</p>
          <Link className="btn btn-primary" to="/campus-connect/creator-studio">Learn about Creator Studio <ArrowRight size={16} /></Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function PaletteMark() {
  return <span className="creator-palette-mark" aria-hidden="true">✳</span>;
}

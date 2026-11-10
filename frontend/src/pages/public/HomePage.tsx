import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Compass,
  FileText,
  Hotel,
  Leaf,
  Palette,
  Receipt,
  ShieldCheck,
  Smartphone,
  Users,
  Utensils,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SeasonalCampaignBanner } from '../../components/SeasonalCampaignBanner.tsx';
import { editorialImages } from '../../lib/editorialImages.ts';
import { sevenCopy, useSevenLanguage } from '../../lib/sevenLanguage.ts';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

interface PhotoCreditLinks {
  creator: string;
  creatorUrl?: string;
  sourceName: string;
  sourceUrl: string;
}

interface Photo {
  src: string;
  alt: string;
  /** Plain-text credit, used where links cannot be nested (inside a tile link). */
  credit: string;
  /** Optional linked credit, shown under photos that are not inside a link. */
  creditLinks?: PhotoCreditLinks;
}

function PhotoCredit({ photo }: { photo: Photo }) {
  const links = photo.creditLinks;
  if (!links) return <span>{photo.credit}</span>;
  return (
    <span>
      Photo:{' '}
      {links.creatorUrl ? (
        <a href={links.creatorUrl} target="_blank" rel="noopener noreferrer">
          {links.creator}
        </a>
      ) : (
        links.creator
      )}
      {' / '}
      <a href={links.sourceUrl} target="_blank" rel="noopener noreferrer">
        {links.sourceName}
      </a>
    </span>
  );
}

/*
 * Photos. The four editorial photos are already licensed and recorded in
 * public/media/SOURCES.txt. The three calm and nature slots are empty until
 * real photos are added: copy a file into public/media/home/, fill in src,
 * alt and credit, then add the photographer to SOURCES.txt.
 * Empty slots show a soft colour panel instead of an image.
 */
const photos: Record<'courtyard' | 'room' | 'dining' | 'coast' | 'stillness' | 'green' | 'horizon', Photo | null> = {
  courtyard: {
    src: editorialImages.courtyard,
    alt: 'A hotel courtyard with palms and balconies. Illustrative stock photograph.',
    credit: 'Photo: Francesca Saraco / Unsplash',
  },
  room: {
    src: editorialImages.room,
    alt: 'A hotel room with white bed linen and cushions. Illustrative stock photograph.',
    credit: 'Photo: Vojtech Bruzek / Unsplash',
  },
  dining: {
    src: editorialImages.dining,
    alt: 'A softly lit restaurant interior. Illustrative stock photograph.',
    credit: 'Photo: Jason Leung / Unsplash',
  },
  coast: {
    src: editorialImages.beach,
    alt: 'Two people beside the ocean in Lagos, Nigeria. Illustrative stock photograph.',
    credit: 'Photo: Ben Iwara / Unsplash',
  },
  stillness: {
    src: '/media/home/meditation.jpg',
    alt: 'A person sitting on a porch meditating in the sunset. Illustrative stock photograph.',
    credit: 'Photo: Jared Rice / Unsplash',
    creditLinks: {
      creator: 'Jared Rice',
      creatorUrl: 'https://unsplash.com/@jareddrice?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText',
      sourceName: 'Unsplash',
      sourceUrl:
        'https://unsplash.com/photos/woman-meditating-on-floor-with-overlooking-view-of-trees-8w7b4SdhOgw?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText',
    },
  },
  green: {
    src: '/media/home/green.jpg',
    alt: 'An hotel green courtyard. illustrative stock photograph.',
    credit: 'Photo: Kate Gundareva / Unsplash',
    creditLinks: {
      creator: 'Kate Gundareva',
      creatorUrl:
        'https://unsplash.com/@kategundareva?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText',
      sourceName: 'Unsplash',
      sourceUrl:
        'https://unsplash.com/photos/green-forest-path-7bVJ9XZQzqY?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText',
    },
  },
  horizon: {
    src: '/media/home/horizon.jpg',
    alt: 'A hotel balcony with a view of the horizon. Illustrative stock photograph.',
    credit: 'Photo: Sarah Vivian / Pexels',
    creditLinks: {
      creator: 'Sarah Vivian',
      creatorUrl: 'https://www.pexels.com/@sarahvivian',
      sourceName: 'Pexels',
      sourceUrl: 'https://www.pexels.com/photo/coastal-view-from-modern-interior-balcony-34009161/',
    },
  },
};

function HomePhoto({
  photo,
  label,
  tall = false,
  eager = false,
}: {
  photo: Photo | null;
  label?: string;
  tall?: boolean;
  eager?: boolean;
}) {
  return (
    <figure className={tall ? 'home-photo home-photo-tall' : 'home-photo'}>
      {photo ? (
        <img src={photo.src} alt={photo.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      ) : (
        <div className="home-photo-placeholder" aria-hidden="true">
          <Leaf size={34} strokeWidth={1.3} />
        </div>
      )}
      {(label || photo) && (
        <figcaption>
          {label && <span>{label}</span>}
          {photo && <PhotoCredit photo={photo} />}
        </figcaption>
      )}
    </figure>
  );
}

/* Fades content in as it scrolls into view. Always visible without JS support or with reduced motion. */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(
    () =>
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const node = ref.current;
    if (shown || !node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);
  return (
    <div
      ref={ref}
      className={shown ? 'home-reveal is-visible' : 'home-reveal'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function Section({
  id,
  tone = 'plain',
  labelledBy,
  children,
}: {
  id?: string;
  tone?: 'plain' | 'tint' | 'soft' | 'deep';
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`home-section home-tone-${tone}`} aria-labelledby={labelledBy}>
      <div className="public-container">{children}</div>
    </section>
  );
}

export function HomePage() {
  const language = useSevenLanguage();
  const t = (english: string, pidgin: string) => sevenCopy(language, english, pidgin);

  const problems = [
    {
      title: t('Availability you cannot confirm', 'Availability wey you no fit confirm'),
      text: t(
        'A room is listed, then it is gone by the time you call.',
        'Dem list room, but e don go before you call.',
      ),
    },
    {
      title: t('Prices that move', 'Price wey dey change'),
      text: t(
        'The rate you were quoted and the rate you pay do not always match.',
        'The price dem tell you and the price you pay no always match.',
      ),
    },
    {
      title: t('Listings you cannot verify', 'Place wey you no fit verify'),
      text: t(
        'Photos and promises are easy to publish and hard to check.',
        'Photo and promise easy to post but hard to check.',
      ),
    },
  ];

  const helps = [
    {
      Icon: ShieldCheck,
      title: t('Verified properties', 'Verified places'),
      text: t(
        'Stays appear on 7even only after a verification review.',
        'Stay go show for 7even only after verification review.',
      ),
    },
    {
      Icon: CalendarCheck,
      title: t('Availability confirmed', 'Availability confirmed'),
      text: t(
        'The partner confirms room availability before a stay is shown as bookable.',
        'The partner go confirm room availability before stay show as bookable.',
      ),
    },
    {
      Icon: Receipt,
      title: t('A clear price', 'Clear price'),
      text: t(
        'See the full price breakdown before you confirm anything.',
        'See the full price breakdown before you confirm anything.',
      ),
    },
    {
      Icon: FileText,
      title: t('Rules in plain language', 'Rules wey simple'),
      text: t(
        'Booking rules are written to be understood, not skimmed past.',
        'Booking rules dey written so that you fit understand am.',
      ),
    },
  ];

  const pillars = [
    {
      Icon: Users,
      title: t('For guests', 'For guests'),
      text: t('Information you can trust before you book.', 'Information wey you fit trust before you book.'),
    },
    {
      Icon: Building2,
      title: t('For businesses', 'For business'),
      text: t(
        'Demand insight to plan rooms, tables and experiences.',
        'Demand insight to plan rooms, tables and experiences.',
      ),
    },
    {
      Icon: Compass,
      title: t('Built for Nigeria first', 'Made for Nigeria first'),
      text: t('Starting in Uyo, with the whole country in view.', 'Starting from Uyo, with the whole country for mind.'),
    },
  ];

  const tiles = [
    { to: '/explore?kind=STAY', label: t('Hotels & stays', 'Places to stay'), Icon: Hotel, photo: photos.room },
    { to: '/explore?kind=DINING', label: t('Dining', 'Food'), Icon: Utensils, photo: photos.dining },
    { to: '/explore?kind=EXPERIENCE', label: 'Things to do', Icon: Compass, photo: photos.coast },
    { to: '/campus-connect/art-culture', label: 'Art & Culture', Icon: Palette, photo: null },
  ];

  return (
    <div className="public-page home-page">
      <PublicHeader />
      <main id="main-content">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="public-container home-hero-grid">
            <div className="home-hero-copy">
              <p className="public-eyebrow">{t('Welcome to 7even', 'You are welcome to 7even')}</p>
              <h1 id="home-title">{t('Good places. Worth your time.', 'Correct places. Make your time count.')}</h1>
              <p className="home-lead">
                {t(
                  'Find verified stays, tables worth booking and quiet ways to unwind across Nigeria, beginning in Uyo.',
                  'Find verified places to stay, tables wey worth am and calm ways to rest for Nigeria, starting from Uyo.',
                )}
              </p>
              <div className="home-actions">
                <Link className="btn btn-primary" to="/explore?kind=STAY">
                  {t('Explore 7even', 'Explore 7even')} <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a className="btn btn-secondary" href="#why-7even">
                  {t('See how it helps', 'See how e dey help')}
                </a>
              </div>
            </div>
            <HomePhoto photo={photos.courtyard} tall eager />
          </div>
        </section>

        <Section id="why-7even" labelledBy="why-title">
          <Reveal>
            <div className="home-heading">
              <p className="public-eyebrow">{t('Finding a hotel in Uyo', 'To find hotel for Uyo')}</p>
              <h2 id="why-title">{t('A good stay should not depend on luck.', 'Good stay no suppose depend on luck.')}</h2>
              <p className="home-lead">
                {t(
                  'Looking for a hotel in Uyo can mean hours of calls and messages. Is the room really free? Is the price the same when you arrive? Is the place what the photos promised?',
                  'To find hotel for Uyo fit mean hours of calls and messages. The room really free? The price go still be the same when you reach? The place match wetin the photo show?',
                )}
              </p>
            </div>
          </Reveal>
          <div className="home-cards">
            {problems.map((item, index) => (
              <Reveal key={item.title} delay={index * 100}>
                <div className="home-card">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section tone="tint" id="how-7even-helps" labelledBy="help-title">
          <Reveal>
            <div className="home-heading">
              <p className="public-eyebrow">{t('How 7even helps', 'How 7even dey help')}</p>
              <h2 id="help-title">{t('Clear information before you commit.', 'Clear information before you book.')}</h2>
            </div>
          </Reveal>
          <div className="home-helps">
            {helps.map(({ Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 90}>
                <div className="home-card">
                  <span className="home-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="home-after">
              <Link className="home-link" to="/booking-rules">
                {t('Read the booking rules', 'Read the booking rules')} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          </Reveal>
        </Section>

        <Section id="rest" labelledBy="rest-title">
          <div className="home-split">
            <Reveal>
              <div>
                <p className="public-eyebrow">{t('Rest and recreation', 'Rest and recreation')}</p>
                <h2 id="rest-title">{t('Rest is part of the trip.', 'Rest too na part of the trip.')}</h2>
                <p className="home-body">
                  {t(
                    'A quiet morning, a walk outside, an afternoon with people you care about. Time away from the usual rhythm gives you room to breathe, and you return clearer. 7even helps you plan the pause, whether it is a weekend away or one slow afternoon.',
                    'Quiet morning, small waka outside, afternoon with people wey you love. Time away from the usual rush dey give you space to breathe, and you go come back with clear mind. 7even dey help you plan the break, whether na weekend away or one slow afternoon.',
                  )}
                </p>
                <Link className="home-link" to="/explore?kind=EXPERIENCE">
                  {t('Find things to do', 'Find things to do')} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>
            <div className="home-mosaic">
              <Reveal>
                <HomePhoto photo={photos.stillness} tall label={t('A quiet morning', 'Quiet morning')} />
              </Reveal>
              <Reveal delay={120}>
                <HomePhoto photo={photos.green} label={t('Time in green space', 'Time for green space')} />
              </Reveal>
              <Reveal delay={240}>
                <HomePhoto photo={photos.horizon} label={t('Room to look far', 'Room to look far')} />
              </Reveal>
            </div>
          </div>
        </Section>

        <Reveal>
          <SeasonalCampaignBanner />
        </Reveal>

        <Section tone="soft" id="eat" labelledBy="eat-title">
          <div className="home-split">
            <Reveal>
              <HomePhoto photo={photos.dining} tall label={t('A table for a slower evening', 'Table for slow evening')} />
            </Reveal>
            <Reveal delay={120}>
              <div>
                <p className="public-eyebrow">{t('Food worth planning for', 'Food wey worth planning for')}</p>
                <h2 id="eat-title">{t('Eat well, wherever you land.', 'Chop well, wherever you reach.')}</h2>
                <p className="home-body">
                  {t(
                    'Rich, nourishing food brings people together. Browse restaurants and places to eat on 7even, from a long family lunch to a late dinner after a day of travel.',
                    'Rich food wey dey nourish dey bring people together. Browse restaurants and places to chop for 7even, from long family lunch to late dinner after day of travel.',
                  )}
                </p>
                <Link className="home-link" to="/explore?kind=DINING">
                  {t('Find dining', 'Find food')} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>
          </div>
        </Section>

        <Section tone="deep" id="behind" labelledBy="behind-title">
          <Reveal>
            <div className="home-heading">
              <p className="public-eyebrow">{t('Behind 7even', 'Wetin dey behind 7even')}</p>
              <h2 id="behind-title">
                {t('Hospitality expertise, built into the product.', 'Hospitality expertise, built inside the product.')}
              </h2>
              <p className="home-lead">
                {t(
                  '7even is powered by \u0101pr\u0259n, a hospitality demand intelligence engine. It helps businesses read demand, so rooms, tables and experiences are ready when guests arrive. For you, it means listings and availability you can rely on.',
                  '7even dey run on \u0101pr\u0259n, hospitality demand intelligence engine. E dey help business read demand, so rooms, tables and experiences go ready when guests reach. For you, e mean listings and availability wey you fit trust.',
                )}
              </p>
            </div>
          </Reveal>
          <div className="home-pillars">
            {pillars.map(({ Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 100}>
                <div className="home-pillar">
                  <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section id="explore" labelledBy="explore-title">
          <Reveal>
            <div className="home-heading">
              <p className="public-eyebrow">{t('Explore 7even', 'Explore 7even')}</p>
              <h2 id="explore-title">{t('Where to next?', 'Where we dey go next?')}</h2>
            </div>
          </Reveal>
          <div className="home-tiles">
            {tiles.map(({ to, label, Icon, photo }, index) => (
              <Reveal key={to} delay={index * 90}>
                <Link className="home-tile" to={to}>
                  {photo ? (
                    <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
                  ) : (
                    <span className="home-photo-placeholder" aria-hidden="true">
                      <Icon size={34} strokeWidth={1.3} />
                    </span>
                  )}
                  <span className="home-tile-label">
                    <Icon size={18} aria-hidden="true" /> {label} <ArrowRight size={16} aria-hidden="true" />
                  </span>
                  {photo && <span className="home-tile-credit">{photo.credit}</span>}
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section tone="soft" id="together">
          <div className="home-duo">
            <Reveal>
              <div className="home-panel">
                <span className="home-icon">
                  <Building2 size={22} aria-hidden="true" />
                </span>
                <p className="public-eyebrow">{t('For businesses', 'For business')}</p>
                <h2 id="business-title">{t('Run a hotel, restaurant or experience?', 'You get hotel, restaurant or experience?')}</h2>
                <p>
                  {t(
                    'Bring your business to guests who plan ahead. Apply to be listed on 7even.',
                    'Bring your business to guests wey dey plan ahead. Apply make dem list you for 7even.',
                  )}
                </p>
                <Link className="btn btn-primary" to="/business/apply">
                  {t('List your property or business', 'List your business')}
                </Link>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="home-panel">
                <span className="home-icon">
                  <Smartphone size={22} aria-hidden="true" />
                </span>
                <p className="public-eyebrow">{t('The app', 'The app')}</p>
                <h2 id="app-title">{t('Take 7even with you.', 'Carry 7even with you.')}</h2>
                <p>
                  {t(
                    'Add 7even to your home screen for a focused, app-like experience.',
                    'Add 7even to your home screen for correct app-like experience.',
                  )}
                </p>
                <Link className="btn btn-secondary" to="/install">
                  {t('Install app', 'Install app')}
                </Link>
              </div>
            </Reveal>
          </div>
        </Section>
      </main>
      <PublicFooter />
    </div>
  );
}

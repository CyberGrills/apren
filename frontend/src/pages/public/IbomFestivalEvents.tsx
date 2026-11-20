import { ExternalLink, CalendarDays, MapPin, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const festivalArtwork = 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/111485d1-e94f-48d5-b3b9-48dc9503935e/ibom-christmas-logo.png';
const scheduleUrl = 'https://ibomfest.akwaibomstate.gov.ng/schedule';

type FestivalEvent = {
  date: string;
  dateLabel: string;
  title: string;
  description: string;
  venue: string;
  image: string;
  imageAlt: string;
  imageNote?: string;
  officialUrl?: string;
  time?: string;
};

const events: FestivalEvent[] = [
  { date: '2026-11-30', dateLabel: '30 November 2026', title: 'Opening Ceremony', description: 'Carnival Street Party and the unveiling of Ibom Kitchen mark the opening of the festival.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/2d5eb866-cef2-4e33-9bb0-41f0fa01219a/opening-ceremony-2026.jpg', imageAlt: 'Official Opening Ceremony poster for Ibom Christmas Unplugged 4.0' },
  { date: '2026-12-06', dateLabel: '6 December 2026', title: 'Ibom Air Day', description: 'A festival day celebrating Ibom Air and the people who connect Akwa Ibom to the world.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/89c37b85-8ce5-409e-b92c-813375b6cd52/ibom-air-2026.jpg', imageAlt: 'Official Ibom Air Day poster' },
  { date: '2026-12-09', dateLabel: '9 December 2026', title: 'Civil Service Day', description: 'A festival day celebrating Akwa Ibom’s civil service community.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/c3e32039-af7c-4a61-860c-4421253a3614/civil-service-2026.jpg', imageAlt: 'Official Civil Service Day poster' },
  { date: '2026-12-10', dateLabel: '10 December 2026', title: 'Corporate Hangout', description: 'A festive gathering for Akwa Ibom’s corporate community.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/b059548d-5059-4427-94e6-a9fd7fb88862/corporate-hangout-2026.jpg', imageAlt: 'Official Corporate Hangout poster' },
  { date: '2026-12-11', dateLabel: '11 December 2026', title: 'Ibom Happy Hour', description: 'An evening to unwind with friends, music and good cheer.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/583238ce-1cc5-429c-aad2-21c071725035/happy-hour-2026.jpg', imageAlt: 'Official Ibom Happy Hour poster' },
  { date: '2026-12-12', dateLabel: '12 December 2026', title: 'Community Outreach', description: 'A Christmas community outreach as part of the festival programme.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/490ea57a-cd75-43ac-895d-c8deb74e9547/community-outreach-2026.jpg', imageAlt: 'Official Community Outreach poster' },
  { date: '2026-12-15', dateLabel: '15 December 2026', title: 'Women’s Day', description: 'Celebrating the women of Akwa Ibom across professions and communities.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/cf562f93-4d77-49cd-a343-92186c444193/womens-day-2026.jpg', imageAlt: 'Official Women’s Day poster' },
  { date: '2026-12-16', dateLabel: '16 December 2026', title: 'ALGON Night', description: 'A celebration of the Association of Local Governments of Nigeria at the festival.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/dd1d4f2a-cc08-40c6-8907-2d668ce65b4a/algon-night-2026.jpg', imageAlt: 'Official ALGON Night poster' },
  { date: '2026-12-18', dateLabel: '18 December 2026', title: 'Akwa Ibom Christmas Carols Festival', description: 'Choirs and worshippers gather under the theme “Peace on Earth, Goodwill to Men.”', venue: 'Amphitheatre, Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/f9d563b5-8649-4473-bdb5-1a0fe8d9b6b6/christmas-carols-festival-2026.jpg', imageAlt: 'Official Akwa Ibom Christmas Carols Festival flyer', officialUrl: 'https://ibomfest.akwaibomstate.gov.ng/carol-night' },
  { date: '2026-12-19', dateLabel: '19 December 2026', title: 'Niger Delta Day', description: 'A celebration of the people, traditions and cultural heritage of the Niger Delta.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/fb2c21a3-b12d-48aa-bad7-960183f968ff/niger-delta-day-2026.jpg', imageAlt: 'Official Niger Delta Day poster' },
  { date: '2026-12-20', dateLabel: '20 December 2026', title: 'Mbopo Akwa Ibom Beauty Pageant', description: 'The 31-LGA cultural pageant and tourism ambassador platform. Grand finale at 6:00 PM.', venue: 'Arise Palm Banquet Hall, Brooks Street, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/3a249273-2936-4f7e-8e8d-a65b844b3745/mbopo-entries-2026.jpg', imageAlt: 'Official Mbopo Akwa Ibom pageant flyer', officialUrl: 'https://ibomfest.akwaibomstate.gov.ng/mbopo-akwa-ibom', time: '6:00 PM' },
  { date: '2026-12-21', dateLabel: '21 December 2026', title: 'Arise Football Fiesta', description: 'Football teams representing all 31 LGAs compete, with the grand finale on 21 December.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/588bfad2-cb53-4de4-b845-5576890efae3/arise-football-fiesta-2026.jpg', imageAlt: 'Official Arise Football Fiesta poster' },
  { date: '2026-12-22', dateLabel: '22 December 2026', title: 'Non-Indigenes Day', description: 'A celebration of the diverse communities who call Akwa Ibom home.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/a4ddfb69-3481-4c8d-b09f-f595ddd4b2d7/non-indigenes-day-2026.jpg', imageAlt: 'Official Non-Indigenes Day poster' },
  { date: '2026-12-23', dateLabel: '23 December 2026', title: 'EXCO-Hangout', description: 'An event listed in the official festival programme. Further details will be published by the organisers.', venue: 'Unity Park, Uyo', image: festivalArtwork, imageAlt: 'Official Ibom Christmas Unplugged 4.0 festival artwork', imageNote: 'Event-specific poster not yet published' },
  { date: '2026-12-24', dateLabel: '24 December 2026', title: 'Children’s Christmas Party', description: 'A Christmas celebration for children and families.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/a807fedf-362f-44b8-8463-85e13e8b99b1/children-party-2026.jpg', imageAlt: 'Official Children’s Christmas Party poster' },
  { date: '2026-12-26', dateLabel: '26 December 2026', title: 'Reggae Night', description: 'A reggae music night listed in the official festival programme. Further details will be published by the organisers.', venue: 'Unity Park, Uyo', image: festivalArtwork, imageAlt: 'Official Ibom Christmas Unplugged 4.0 festival artwork', imageNote: 'Event-specific poster not yet published' },
  { date: '2026-12-27', dateLabel: '27 December 2026', title: 'Ibom Golf Tournament', description: 'A golf tournament included in the festive programme.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/a39a50d4-ff4b-4e68-861d-73342e91b5ab/ibom-golf-dec27-2026.jpg', imageAlt: 'Official Ibom Golf Tournament poster' },
  { date: '2026-12-29', dateLabel: '29 December 2026', title: 'Old Skool Night', description: 'A festive night celebrating old-school music and nostalgia.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/6efbeabd-b832-4dea-97e7-b30935ca931e/old-skool-night-2026.jpg', imageAlt: 'Official Old Skool Night poster' },
  { date: '2026-12-30', dateLabel: '30 December 2026', title: 'Ibom Youth Day', description: 'A celebration of Akwa Ibom’s young people and their place in the festival.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/f1c74767-4b0f-4865-92ca-90f9855b806f/ibom-youth-day-2026.jpg', imageAlt: 'Official Ibom Youth Day poster' },
  { date: '2026-12-31', dateLabel: '31 December 2026', title: 'Cross-Over Service', description: 'Close the year with the festival community at Unity Park.', venue: 'Unity Park, Uyo', image: 'https://ibomfest.akwaibomstate.gov.ng/__l5e/assets-v1/a83222e2-cad5-41fb-8838-8edb05ee1e70/cross-over-2026.jpg', imageAlt: 'Official Cross-Over Service poster' },
];

const months = [
  { value: 'all', label: 'All dates' },
  { value: '2026-11', label: 'November' },
  { value: '2026-12', label: 'December' },
];

export function IbomFestivalEvents() {
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('all');
  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesMonth = month === 'all' || event.date.startsWith(month);
    const haystack = [event.title, event.description, event.venue].join(' ').toLocaleLowerCase();
    return matchesMonth && haystack.includes(query.trim().toLocaleLowerCase());
  }), [month, query]);

  return (
    <section className="ibom-events-section" id="ibom-festival-events" aria-labelledby="ibom-events-title">
      <div className="ibom-events-heading">
        <div>
          <p className="public-eyebrow">Official festival programme · Uyo</p>
          <h2 id="ibom-events-title">Ibom Christmas Unplugged 4.0</h2>
          <p>Explore all 20 flagship events announced for 30 November–31 December 2026.</p>
        </div>
        <a className="ibom-events-source" href={scheduleUrl} target="_blank" rel="noopener noreferrer">
          Full official programme <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
      <div className="ibom-events-tools">
        <label className="ibom-events-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events or locations" aria-label="Search festival events" />
        </label>
        <div className="ibom-events-months" role="group" aria-label="Filter events by month">
          {months.map((item) => (
            <button key={item.value} type="button" className={month === item.value ? 'active' : ''} aria-pressed={month === item.value} onClick={() => setMonth(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="ibom-events-count" aria-live="polite">Showing {visibleEvents.length} of 20 official events</p>
      {visibleEvents.length ? (
        <div className="ibom-events-grid">
          {visibleEvents.map((event) => (
            <article className="ibom-event-card" key={event.title}>
              <a className="ibom-event-image-link" href={event.officialUrl ?? scheduleUrl} target="_blank" rel="noopener noreferrer" aria-label={'View ' + event.title + ' on the official festival website'}>
                <img src={event.image} alt={event.imageAlt} loading="lazy" decoding="async" />
                {event.imageNote && <span className="ibom-event-image-note">{event.imageNote}</span>}
              </a>
              <div className="ibom-event-card-content">
                <p className="ibom-event-date"><CalendarDays size={14} aria-hidden="true" /> {event.dateLabel}</p>
                <h3>{event.title}</h3>
                <p className="ibom-event-description">{event.description}</p>
                <p className="ibom-event-venue"><MapPin size={14} aria-hidden="true" /> {event.venue}</p>
                <p className="ibom-event-time">{event.time ?? 'Time to be announced'}</p>
                <a className="btn btn-primary ibom-event-action" href={event.officialUrl ?? scheduleUrl} target="_blank" rel="noopener noreferrer">
                  View official event <ExternalLink size={15} aria-hidden="true" />
                </a>
                <p className="ibom-event-credit">Official event artwork · <a href="https://ibomfest.akwaibomstate.gov.ng/media" target="_blank" rel="noopener noreferrer">Festival Media Centre</a></p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ibom-events-empty" role="status">
          <p>No events match that search.</p>
          <button type="button" className="btn btn-secondary" onClick={() => { setQuery(''); setMonth('all'); }}>Clear filters</button>
        </div>
      )}
      <p className="ibom-events-disclosure">Visitor entry is listed as free by the organisers. Event times and details may change; check the official programme before travelling. 7EVEN is an independent discovery platform and does not sell tickets or represent the organisers.</p>
    </section>
  );
}

import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';
import { SeasonThemeControl } from '../../components/SeasonThemeControl.tsx';

export function AppearancePage() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="appearance-page">
        <p className="public-eyebrow">Your 7even experience</p>
        <h1>Appearance</h1>
        <p className="appearance-intro">
          Choose the seasonal character of 7even. Your selection updates accents, active states,
          buttons and subtle surface tints across the app, while the core forest-green and warm-ivory
          brand identity remains familiar.
        </p>
        <section className="appearance-panel" aria-labelledby="appearance-season-heading">
          <h2 id="appearance-season-heading">Seasonal appearance</h2>
          <p>Choose a season or let 7even follow the calendar in Nigeria (Lagos time).</p>
          <SeasonThemeControl />
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

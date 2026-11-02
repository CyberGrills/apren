import { Link } from 'react-router-dom';
import { useSeason } from '../context/SeasonContext.tsx';
import { seasonalCampaigns } from '../lib/seasonalCampaigns.ts';

const seasonPositions = {
  spring: '0% 0%',
  summer: '100% 0%',
  autumn: '0% 100%',
  winter: '100% 100%',
} as const;

export function SeasonalCampaignBanner() {
  const season = useSeason();
  const campaign = seasonalCampaigns[season];
  return (
    <section className="public-container seven-seasonal-promo" aria-labelledby="seasonal-promo-title">
      <div className="seven-seasonal-promo-copy">
        <span className="seasonal-campaign-label">{campaign.label}</span>
        <p className="public-eyebrow">A seasonal 7EVEN edit</p>
        <h2 id="seasonal-promo-title">Plan every arrival before it happens.</h2>
        <p>{campaign.message}</p>
        <Link className="btn btn-primary" to="/explore?kind=STAY">Find a stay</Link>
      </div>
      <div
        className={`seven-seasonal-flyer season-${season}`}
        role="img"
        aria-label={`${season} 7EVEN campaign flyer. Plan every arrival before it happens. Find a stay in Uyo, Akwa Ibom.`}
        style={{ backgroundPosition: seasonPositions[season] }}
      />
    </section>
  );
}

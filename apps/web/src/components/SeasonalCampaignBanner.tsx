import { Link } from 'react-router-dom';
import { useSeason } from '../context/SeasonContext.tsx';
import { seasonalCampaigns } from '../lib/seasonalCampaigns.ts';

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
      <figure className="seven-seasonal-flyer">
        <img src={campaign.image.src} alt={campaign.image.alt} loading="lazy" />
        <figcaption>
          <span>{campaign.image.caption}</span>
          <span>{campaign.image.credit}</span>
        </figcaption>
      </figure>
    </section>
  );
}

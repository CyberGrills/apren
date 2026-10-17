import { editorialImages } from './editorialImages.ts';
import type { Season } from './season.ts';

interface SeasonalCampaign {
  label: string;
  message: string;
  image: {
    src: string;
    alt: string;
    caption: string;
    credit: string;
    width: number;
    height: number;
  };
}

// Calendar campaigns for 7even, rather than claims about Nigeria's weather.
export const seasonalCampaigns: Record<Season, SeasonalCampaign> = {
  spring: {
    label: 'Spring edit',
    message:
      'A courtyard for a slow afternoon. A new place for the weekend. Make room for a fresh plan.',
    image: {
      src: editorialImages.courtyard,
      alt: 'A hotel courtyard with palms and balconies. Illustrative stock photograph.',
      caption: 'A little space to stay a while · Illustrative stock',
      credit: 'Photo: Francesca Saraco / Unsplash',
      width: 1600,
      height: 1800,
    },
  },
  summer: {
    label: 'Summer edit',
    message: 'A day by the water. A meal with friends. Find a reason to get out for a while.',
    image: {
      src: editorialImages.beach,
      alt: 'Two people beside the ocean in Lagos, Nigeria. Illustrative stock photograph.',
      caption: 'Time by the water in Lagos · Illustrative stock',
      credit: 'Photo: Ben Iwara / Unsplash',
      width: 1000,
      height: 1200,
    },
  },
  autumn: {
    label: 'Autumn edit',
    message: 'A long lunch. A table for the evening. Leave a little room in your weekend.',
    image: {
      src: editorialImages.dining,
      alt: 'A softly lit restaurant interior. Illustrative stock photograph.',
      caption: 'A table for a slower evening · Illustrative stock',
      credit: 'Photo: Jason Leung / Unsplash',
      width: 1000,
      height: 1200,
    },
  },
  winter: {
    label: 'Winter edit',
    message: 'A few days away. A room to settle into. Make time for the people you want to see.',
    image: {
      src: editorialImages.room,
      alt: 'A hotel room with white bed linen and cushions. Illustrative stock photograph.',
      caption: 'A room for a few days away · Illustrative stock',
      credit: 'Photo: Vojtech Bruzek / Unsplash',
      width: 1000,
      height: 1200,
    },
  },
};

import { Check } from 'lucide-react';
import { useSetSeasonPreference, useSeason, useSeasonPreference, type SeasonPreference } from '../context/SeasonContext.tsx';

const options: {
  value: SeasonPreference;
  label: string;
  description: string;
  swatch: string;
}[] = [
  { value: 'auto', label: 'Automatic', description: 'Follows the Lagos seasonal calendar', swatch: 'linear-gradient(135deg, #8baa8a 0 25%, #c67b55 25% 50%, #b77943 50% 75%, #466c78 75%)' },
  { value: 'spring', label: 'Spring', description: 'Soft sage and fresh seasonal accents', swatch: '#8baa8a' },
  { value: 'summer', label: 'Summer', description: 'Warm terracotta accents', swatch: '#c67b55' },
  { value: 'autumn', label: 'Autumn', description: 'Rich copper accents', swatch: '#b77943' },
  { value: 'winter', label: 'Winter', description: 'Cool slate-blue accents', swatch: '#466c78' },
];

export function SeasonThemeControl() {
  const preference = useSeasonPreference();
  const season = useSeason();
  const setPreference = useSetSeasonPreference();

  return (
    <div className="appearance-theme-picker">
      <div className="appearance-season-grid" role="group" aria-label="Choose the 7even seasonal appearance">
        {options.map((option) => {
          const selected = preference === option.value;
          return (
            <button
              type="button"
              className="appearance-season-option"
              key={option.value}
              aria-pressed={selected}
              onClick={() => setPreference(option.value)}
            >
              <span className="appearance-season-swatch" style={{ background: option.swatch }} aria-hidden="true" />
              <span className="appearance-season-copy">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              {selected && <span className="appearance-season-check"><Check size={17} aria-hidden="true" /> Selected</span>}
            </button>
          );
        })}
      </div>
      <div className="appearance-current" role="status" aria-live="polite">
        <span className="appearance-current-swatch" aria-hidden="true" />
        {preference === 'auto'
          ? `Automatic is on. The current Lagos campaign is ${season}.`
          : `${preference.replace(/^./, (letter) => letter.toUpperCase())} appearance is selected.`}
      </div>
    </div>
  );
}

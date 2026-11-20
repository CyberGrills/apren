import { Check } from 'lucide-react';
import { useSetSeasonPreference, useSeason, useSeasonPreference, type SeasonPreference } from '../context/SeasonContext.tsx';

const options: {
  value: SeasonPreference;
  label: string;
  description: string;
  swatch: string;
}[] = [
  { value: 'auto', label: 'Automatic', description: 'Follows the Lagos seasonal calendar', swatch: 'linear-gradient(135deg, #8baa8a 0 25%, #D99A32 25% 50%, #C66A3D 50% 75%, #466c78 75%)' },
  { value: 'spring', label: 'Spring', description: 'Soft sage and fresh seasonal accents', swatch: '#8baa8a' },
  { value: 'summer', label: 'Summer', description: 'Sunshine gold and bright coral accents', swatch: '#D99A32' },
  { value: 'autumn', label: 'Autumn', description: 'Burnt orange, copper and harvest accents', swatch: '#C66A3D' },
  { value: 'winter', label: 'Winter', description: 'Cool slate-blue accents', swatch: '#466c78' },
];

export function SeasonThemeControl() {
  const preference = useSeasonPreference();
  const season = useSeason();
  const setPreference = useSetSeasonPreference();

  return (
    <div className="appearance-theme-picker">
      <fieldset className="appearance-season-grid">
        <legend className="sr-only">Choose the 7even seasonal appearance</legend>
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
      </fieldset>
      <div className="appearance-current" role="status" aria-live="polite">
        <span className="appearance-current-swatch" aria-hidden="true" />
        {preference === 'auto'
          ? `Automatic is on. The current Lagos campaign is ${season}.`
          : `${preference.replace(/^./, (letter) => letter.toUpperCase())} appearance is selected.`}
      </div>
    </div>
  );
}

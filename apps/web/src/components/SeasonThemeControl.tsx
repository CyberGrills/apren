import { useSetSeasonPreference, useSeasonPreference, type SeasonPreference } from '../context/SeasonContext.tsx';

const options: { value: SeasonPreference; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'autumn', label: 'Autumn' },
  { value: 'winter', label: 'Winter' },
];

export function SeasonThemeControl({ compact = false }: { compact?: boolean }) {
  const preference = useSeasonPreference();
  const setPreference = useSetSeasonPreference();
  return (
    <label className={`season-theme-control${compact ? ' is-compact' : ''}`}>
      <span>Season</span>
      <select
        aria-label="Seasonal colour preference"
        value={preference}
        onChange={(event) => setPreference(event.target.value as SeasonPreference)}
      >
        {options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

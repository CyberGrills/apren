import { PublicFooter, PublicHeader } from '../public/PublicShell.tsx';
import { SeasonThemeControl } from '../../components/SeasonThemeControl.tsx';
import {
  useAppearanceModePreference,
  useSetAppearanceModePreference,
  type AppearanceModePreference,
} from '../../context/SeasonContext.tsx';

const modeOptions: { value: AppearanceModePreference; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'The familiar warm-ivory 7EVEN appearance.' },
  { value: 'dark', label: 'Dark', description: 'A deep forest-inspired appearance for low-light use.' },
  { value: 'system', label: 'System', description: 'Follow the appearance setting on your device.' },
];

function AppearanceModeControl() {
  const preference = useAppearanceModePreference();
  const setPreference = useSetAppearanceModePreference();
  return (
    <fieldset className="appearance-mode-options">
      <legend className="sr-only">Choose light, dark, or system appearance</legend>
      {modeOptions.map((option) => (
        <button
          type="button"
          className="appearance-mode-option"
          key={option.value}
          aria-pressed={preference === option.value}
          onClick={() => setPreference(option.value)}
        >
          <strong>{option.label}</strong>
          <small>{option.description}</small>
          {preference === option.value && <span className="appearance-mode-selected">Selected</span>}
        </button>
      ))}
    </fieldset>
  );
}

export function AppearancePage() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="appearance-page">
        <p className="public-eyebrow">Your 7even experience</p>
        <h1>Appearance</h1>
        <p className="appearance-intro">
          Choose how 7EVEN looks. Your colour mode works together with the seasonal accents, while
          the brand’s forest-green identity and hospitality character remain familiar.
        </p>
        <section className="appearance-panel" aria-labelledby="appearance-mode-heading">
          <h2 id="appearance-mode-heading">Colour mode</h2>
          <p>Choose Light, Dark, or let your device decide. Your selection is saved on this device.</p>
          <AppearanceModeControl />
        </section>
        <section className="appearance-panel" aria-labelledby="appearance-season-heading">
          <h2 id="appearance-season-heading">Seasonal appearance</h2>
          <p>Choose a season or let 7EVEN follow the calendar in Nigeria (Lagos time).</p>
          <SeasonThemeControl />
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

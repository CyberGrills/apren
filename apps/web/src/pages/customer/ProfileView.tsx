import type { SessionUser } from '@7even/contracts';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccountSignInMethods } from '../../components/AccountSignInMethods.tsx';
import { ErrorNotice, Field, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../lib/api.ts';

type TripPurpose = 'ANY' | 'COUPLES' | 'BUSINESS' | 'FAMILY' | 'SOFT_LIFE';
type PreferredRoomType = 'ANY' | 'STANDARD' | 'DELUXE' | 'SUITE';
type BedPreference = 'ANY' | 'KING' | 'TWIN';

export function ProfileView({ user }: { user: SessionUser }) {
  const { refresh, logout } = useSession();
  const { showSuccess } = useFeedback();
  const navigate = useNavigate();
  const details = user.profileDetails ?? {};
  const [name, setName] = useState(user.displayName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [city, setCity] = useState(details.city ?? '');
  const [state, setState] = useState(details.state ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(details.dateOfBirth ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'pcm'>(details.preferredLanguage ?? 'en');
  const [tripPurpose, setTripPurpose] = useState<TripPurpose>(details.tripPurpose ?? 'ANY');
  const [preferredRoomType, setPreferredRoomType] = useState<PreferredRoomType>(details.preferredRoomType ?? 'ANY');
  const [bedPreference, setBedPreference] = useState<BedPreference>(details.bedPreference ?? 'ANY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<SessionUser>('/me', {
        method: 'PATCH',
        body: {
          displayName: name.trim(),
          phone: phone.trim(),
          city: city.trim(),
          state: state.trim(),
          dateOfBirth: dateOfBirth || null,
          preferredLanguage,
          tripPurpose,
          preferredRoomType,
          bedPreference,
        },
        idempotencyKey: attempt.current,
      });
      await refresh();
      try {
        window.localStorage.setItem('7even-language-style', preferredLanguage);
        window.dispatchEvent(new CustomEvent('7even-language-change', { detail: preferredLanguage }));
      } catch {
        // The saved account preference remains authoritative when browser storage is unavailable.
      }
      showSuccess('Your profile details have been saved.', 'Profile saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await logout();
      showSuccess('You have signed out of this device.', 'Signed out.');
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not sign you out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="customer-profile">
      <section className="customer-profile-editor" aria-labelledby="profile-details-title">
        <div className="customer-profile-intro">
          <div className="customer-profile-avatar" aria-hidden="true">
            {name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '7'}
          </div>
          <div>
            <span className="public-eyebrow">Your 7even profile</span>
            <h2 id="profile-details-title">Make yourself at home.</h2>
            <p>Keep your contact details and stay preferences together so future bookings are easier.</p>
          </div>
        </div>
        <form onSubmit={save} onChange={() => { attempt.current = crypto.randomUUID(); }}>
          <div className="customer-profile-section">
            <span className="public-eyebrow">01 / Account details</span>
            <div className="customer-profile-fields">
              <Field label="Your name">
                <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={100} required />
              </Field>
              <Field label="Email address" hint="Your email identifies your 7even account.">
                <input className="field-input" type="email" value={user.email} readOnly autoComplete="email" />
              </Field>
              <Field label="Phone number" hint="Optional; useful if a property needs to contact you about a booking.">
                <input className="field-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={30} />
              </Field>
            </div>
          </div>
          <div className="customer-profile-section">
            <span className="public-eyebrow">02 / About you</span>
            <div className="customer-profile-fields">
              <Field label="Home city">
                <input className="field-input" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" maxLength={100} placeholder="e.g. Port Harcourt" />
              </Field>
              <Field label="State or FCT" hint="Choose a Nigerian state name; this helps personalise destination suggestions.">
                <input className="field-input" value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" maxLength={100} placeholder="e.g. Rivers" />
              </Field>
              <Field label="Date of birth" hint="Optional. Used only as a profile detail; it is not shown publicly.">
                <input className="field-input" type="date" value={dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDateOfBirth(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="customer-profile-section">
            <span className="public-eyebrow">03 / Stay preferences</span>
            <div className="customer-profile-fields">
              <Field label="Website language" hint="Your choice is remembered across visits when you are using this browser.">
                <select className="field-input" value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'pcm')}>
                  <option value="en">English</option>
                  <option value="pcm">Naija Pidgin</option>
                </select>
              </Field>
              <Field label="Usual trip purpose">
                <select className="field-input" value={tripPurpose} onChange={(e) => setTripPurpose(e.target.value as TripPurpose)}>
                  <option value="ANY">Any kind of stay</option>
                  <option value="COUPLES">Couples / romantic</option>
                  <option value="BUSINESS">Business trip</option>
                  <option value="FAMILY">Family stay</option>
                  <option value="SOFT_LIFE">Relaxation / soft life</option>
                </select>
              </Field>
              <Field label="Preferred room type" hint="A preference only; the hotel must confirm the room and price.">
                <select className="field-input" value={preferredRoomType} onChange={(e) => setPreferredRoomType(e.target.value as PreferredRoomType)}>
                  <option value="ANY">No preference</option>
                  <option value="STANDARD">Standard</option>
                  <option value="DELUXE">Deluxe</option>
                  <option value="SUITE">Suite</option>
                </select>
              </Field>
              <Field label="Bed setup" hint="Optional preference; availability is confirmed by the property.">
                <select className="field-input" value={bedPreference} onChange={(e) => setBedPreference(e.target.value as BedPreference)}>
                  <option value="ANY">No preference</option>
                  <option value="KING">King bed</option>
                  <option value="TWIN">Twin beds</option>
                </select>
              </Field>
            </div>
          </div>
          {error && <ErrorNotice message={error} />}
          <div className="customer-profile-save-row">
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile details'}</button>
            <Link className="text-button" to="/app/security">Change your password</Link>
          </div>
        </form>
      </section>
      <aside className="customer-profile-account">
        <span className="public-eyebrow">Account and security</span>
        <h2>Keep it yours.</h2>
        <p>Your bookings and benefits stay in your account. Sign out when you have finished on a shared device.</p>
        <button className="btn btn-secondary" type="button" onClick={signOut} disabled={busy}>Sign out</button>
        <AccountSignInMethods />
      </aside>
    </div>
  );
}

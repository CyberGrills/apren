import type { Business } from '@7even/contracts';
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, Store } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StateCityFields } from '../../components/LocationFields.tsx';
import { ErrorNotice, Field, Loading, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import type { DirectoryListing } from '../../lib/nigeriaDirectory.ts';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

interface DirectoryApiResponse {
  listings: DirectoryListing[];
}

export function BusinessApplicationPage() {
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get('listingId');
  const { user, refresh, loading } = useSession();
  const { showSuccess } = useFeedback();
  const { data: directory, loading: directoryLoading, error: directoryError, reload: reloadDirectory } =
    useApi<DirectoryApiResponse>(listingId ? '/directory?kind=STAY&page=1&pageSize=100' : null);
  const selectedListing = directory?.listings.find((item) => item.id === listingId) ?? null;
  const [business, setBusiness] = useState<Business | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());
  const returnTo = listingId ? `/business/apply?listingId=${encodeURIComponent(listingId)}` : '/business/apply';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ['businessName', 'state', 'city', 'address', 'phone', 'sector', 'description'].map((key) => [
        key,
        String(form.get(key) ?? '').trim(),
      ]),
    );
    if (listingId) Object.assign(body, { discoveryListingId: listingId });
    setError(null);
    setBusy(true);
    try {
      const result = await api<Business>('/business/applications', {
        method: 'POST',
        body,
        idempotencyKey: attempt.current,
      });
      setBusiness(result);
      await refresh();
      showSuccess(
        `${result.businessName} is awaiting review. Your team can prepare its room categories, rates, amenities and availability in the 7EVEN workspace while the listing remains unpublished.`,
        'Application received.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not save your application. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const claimUnavailable = !!listingId && !directoryLoading && (!selectedListing || !selectedListing.claimable);

  return (
    <div className="public-page">
      <PublicHeader />
      <main id="main-content" className="public-container business-apply-page">
        <div className="business-apply-intro">
          <span className="public-eyebrow">7even for business</span>
          <h1>
            More time for
            <br />
            <em>your guests.</em>
          </h1>
          <p>
            Bring your rooms, tables or experiences to 7EVEN. You do not need a working hotel
            website or a central payment gateway to start.
          </p>
          <ul className="business-apply-benefits">
            <li>
              <Store size={22} aria-hidden="true" />
              <div>
                <h2>A place to be found.</h2>
                <p>Publish the details guests need to make a decision.</p>
              </div>
            </li>
            <li>
              <CalendarDays size={22} aria-hidden="true" />
              <div>
                <h2>A clear front desk.</h2>
                <p>Your authorised team manages room categories, rate plans, nightly availability and reservations.</p>
              </div>
            </li>
            <li>
              <ChartNoAxesCombined size={22} aria-hidden="true" />
              <div>
                <h2>Demand you can examine.</h2>
                <p>See booking activity and the evidence behind demand suggestions. Your team controls its own rates and inventory.</p>
              </div>
            </li>
          </ul>
        </div>
        <section className="business-apply-form" aria-labelledby="apply-title">
          {business ? (
            <div className="application-received">
              <span className="public-eyebrow">Application status</span>
              <h2 id="apply-title">Awaiting review.</h2>
              <p>
                {business.businessName} is awaiting review. Your listings stay unpublished until
                the business verification and inventory checks are complete.
              </p>
              <Link className="btn btn-primary" to="/business">
                Open your workspace <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <span className="public-eyebrow">{listingId ? 'Claim a preloaded hotel profile' : 'Tell us about your place'}</span>
              <h2 id="apply-title">{listingId ? 'Confirm your property details.' : 'Start with the essentials.'}</h2>
              {listingId && directoryLoading && <Loading inline label="Loading the hotel profile" />}
              {listingId && directoryError && <ErrorNotice message={directoryError} retry={reloadDirectory} />}
              {listingId && !directoryLoading && !directoryError && !selectedListing && (
                <ErrorNotice message="This hotel profile could not be found. Return to the directory and choose an available property." />
              )}
              {listingId && selectedListing && !selectedListing.claimable && (
                <div className="application-signin">
                  <p>This hotel profile is already claimed or its onboarding is in progress. Contact 7EVEN support if you are the authorised property representative.</p>
                  <Link className="btn btn-secondary" to="/directory?kind=STAY">Back to hotel directory</Link>
                </div>
              )}
              {loading ? (
                <p>Checking your account…</p>
              ) : !user ? (
                <div className="application-signin">
                  {selectedListing && <p>You are requesting access to manage <strong>{selectedListing.name}</strong> in Uyo.</p>}
                  <p>Sign in or create an account so the property application belongs to an authorised team member.</p>
                  <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`} className="btn btn-primary">
                    Create your account
                  </Link>
                  <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="public-text-link">
                    Already have an account? Sign in
                  </Link>
                </div>
              ) : user.businessId ? (
                <div>
                  <p>
                    Your account already belongs to a business. Open your workspace to manage it.
                  </p>
                  <Link className="btn btn-primary" to="/business">
                    Open your workspace
                  </Link>
                </div>
              ) : !claimUnavailable && (!listingId || (selectedListing && selectedListing.claimable)) ? (
                <form
                  onSubmit={submit}
                  onChange={() => {
                    attempt.current = crypto.randomUUID();
                  }}
                >
                  {selectedListing && (
                    <div className="application-claim-summary">
                      <strong>{selectedListing.name}</strong>
                      <span>{selectedListing.address}, {selectedListing.city}, {selectedListing.state}</span>
                      <p>This profile is preloaded from the 7EVEN hotel onboarding records. Your application links your team to this property; it does not publish unverified rates or availability.</p>
                      {selectedListing.amenities && selectedListing.amenities.length > 0 && (
                        <div className="application-claim-source-data">
                          <strong>Facilities to review in your workspace</strong>
                          <ul>{selectedListing.amenities.map((amenity) => <li key={amenity.name}>{amenity.name}</li>)}</ul>
                        </div>
                      )}
                      {selectedListing.publishedRateNotes && selectedListing.publishedRateNotes.length > 0 && (
                        <p className="public-small">The published website rate references are included for review. They are not live 7EVEN rate plans; confirm or update them in your workspace before publishing inventory.</p>
                      )}
                    </div>
                  )}
                  <Field label="Business name">
                    <input
                      className="field-input"
                      name="businessName"
                      required
                      minLength={1}
                      maxLength={160}
                      autoComplete="organization"
                      defaultValue={selectedListing?.name ?? ''}
                      readOnly={!!selectedListing}
                    />
                  </Field>
                  <Field label="What do you offer?">
                    <select name="sector" className="field-input" defaultValue={selectedListing?.kind ?? 'STAY'} disabled={!!selectedListing}>
                      <option value="STAY">Rooms and places to stay</option>
                      <option value="DINING">Dining and table reservations</option>
                      <option value="EXPERIENCE">Experiences and activities</option>
                    </select>
                    {selectedListing && <input type="hidden" name="sector" value="STAY" />}
                  </Field>
                  <div className="public-form-row">
                    <StateCityFields required prefix="application" initialState={selectedListing?.state ?? 'Akwa Ibom'} initialCity={selectedListing?.city ?? ''} />
                    <Field label="Business phone">
                      <input
                        className="field-input"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        minLength={5}
                        maxLength={30}
                        defaultValue={selectedListing?.contactPhone ?? ''}
                      />
                    </Field>
                  </div>
                  <Field label="Street address">
                    <input
                      className="field-input"
                      name="address"
                      autoComplete="street-address"
                      required
                      minLength={4}
                      maxLength={300}
                      defaultValue={selectedListing?.address ?? ''}
                    />
                  </Field>
                  <Field
                    label="Tell guests about your place"
                    hint="At least 20 characters. Add the details you want guests to know; your team can update amenities and policies in the workspace."
                  >
                    <textarea
                      className="field-input"
                      name="description"
                      rows={5}
                      required
                      minLength={20}
                      maxLength={2000}
                      defaultValue={selectedListing?.description ?? ''}
                    />
                  </Field>
                  {error && <ErrorNotice message={error} />}
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Saving your application…' : selectedListing ? 'Claim this hotel profile' : 'Send your application'}{' '}
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </button>
                  <p className="public-small">
                    We review business authority before a property can publish bookable offers.
                    Room rates and availability become live only after the hotel team enters and
                    confirms its inventory.
                  </p>
                </form>
              ) : null}
            </>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

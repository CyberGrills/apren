import type { Business } from '@7even/contracts';
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, Store } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { StateCityFields } from '../../components/LocationFields.tsx';
import { ErrorNotice, Field, useFeedback } from '../../components/ui.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../lib/api.ts';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';

export function BusinessApplicationPage() {
  const { user, refresh, loading } = useSession();
  const { showSuccess } = useFeedback();
  const [business, setBusiness] = useState<Business | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(crypto.randomUUID());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ['businessName', 'state', 'city', 'address', 'phone', 'sector', 'description'].map((key) => [
        key,
        String(form.get(key) ?? '').trim(),
      ]),
    );
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
        `${result.businessName} is awaiting review. Your listings stay unpublished until your business is approved.`,
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
            Bring your rooms, tables or experiences to 7even. Keep bookings in order and get a
            clearer view of the days ahead.
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
                <p>Reservations, arrivals and availability in one workspace.</p>
              </div>
            </li>
            <li>
              <ChartNoAxesCombined size={22} aria-hidden="true" />
              <div>
                <h2>Demand you can examine.</h2>
                <p>Suggestions show the evidence behind them. You decide what to change.</p>
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
                your business is approved.
              </p>
              <Link className="btn btn-primary" to="/business">
                Open your workspace <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <span className="public-eyebrow">Tell us about your place</span>
              <h2 id="apply-title">Start with the essentials.</h2>
              {loading ? (
                <p>Checking your account…</p>
              ) : !user ? (
                <div className="application-signin">
                  <p>Sign in or create an account so your application belongs to you.</p>
                  <Link to="/register?returnTo=%2Fbusiness%2Fapply" className="btn btn-primary">
                    Create your account
                  </Link>
                  <Link to="/login?returnTo=%2Fbusiness%2Fapply" className="public-text-link">
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
              ) : (
                <form
                  onSubmit={submit}
                  onChange={() => {
                    attempt.current = crypto.randomUUID();
                  }}
                >
                  <Field label="Business name">
                    <input
                      className="field-input"
                      name="businessName"
                      required
                      minLength={1}
                      maxLength={160}
                      autoComplete="organization"
                    />
                  </Field>
                  <Field label="What do you offer?">
                    <select name="sector" className="field-input" defaultValue="STAY">
                      <option value="STAY">Rooms and places to stay</option>
                      <option value="DINING">Dining and table reservations</option>
                      <option value="EXPERIENCE">Experiences and activities</option>
                    </select>
                  </Field>
                  <div className="public-form-row">
                    <StateCityFields required prefix="application" />
                    <Field label="Business phone">
                      <input
                        className="field-input"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        minLength={5}
                        maxLength={30}
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
                    />
                  </Field>
                  <Field
                    label="Tell guests about your place"
                    hint="At least 20 characters. Include the details you would want to know before visiting."
                  >
                    <textarea
                      className="field-input"
                      name="description"
                      rows={5}
                      required
                      minLength={20}
                      maxLength={2000}
                    />
                  </Field>
                  {error && <ErrorNotice message={error} />}
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Saving your application…' : 'Send your application'}{' '}
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </button>
                  <p className="public-small">
                    We review businesses before their listings appear. Sending this form does not
                    publish your business.
                  </p>
                </form>
              )}
            </>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

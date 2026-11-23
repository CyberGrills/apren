import type { Business } from '@7even/contracts';
import { useState } from 'react';
import { Field, ErrorNotice } from '../../../components/ui.tsx';
import { api } from '../../../lib/api.ts';

export function BusinessResubmission({
  business,
  onSubmitted,
}: {
  business: Business;
  onSubmitted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ['businessName', 'state', 'city', 'phone', 'address', 'sector', 'description'].map((key) => [
        key,
        String(form.get(key) ?? '').trim(),
      ]),
    );
    setBusy(true);
    setError(null);
    try {
      await api<Business>('/business/applications/resubmit', {
        method: 'POST',
        body,
        idempotencyKey: crypto.randomUUID(),
      });
      onSubmitted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not resubmit your application.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form-stack" aria-labelledby="resubmit-title">
      <span className="eyebrow">Application needs changes</span>
      <h2 id="resubmit-title">Update your business details and request another review.</h2>
      <p className="small-copy">
        Your application remains private and unpublished while it is reviewed again. Correct the
        details below and include the evidence requested in your review notification.
      </p>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Business name">
          <input className="field-input" name="businessName" defaultValue={business.businessName} required maxLength={160} />
        </Field>
        <div className="form-grid">
          <Field label="State">
            <input className="field-input" name="state" defaultValue={business.state ?? ''} required maxLength={80} />
          </Field>
          <Field label="City">
            <input className="field-input" name="city" defaultValue={business.city} required maxLength={100} />
          </Field>
        </div>
        <Field label="Business phone">
          <input className="field-input" name="phone" type="tel" defaultValue={business.phone} required minLength={5} maxLength={30} />
        </Field>
        <Field label="Street address">
          <input className="field-input" name="address" defaultValue={business.address} required minLength={4} maxLength={300} />
        </Field>
        <Field label="Business type">
          <select className="field-input" name="sector" defaultValue={business.sector}>
            <option value="STAY">Rooms and places to stay</option>
            <option value="DINING">Dining and table reservations</option>
            <option value="EXPERIENCE">Experiences and activities</option>
          </select>
        </Field>
        <Field label="Business description">
          <textarea className="field-input" name="description" defaultValue={business.description} required minLength={20} maxLength={2000} rows={4} />
        </Field>
        {error && <ErrorNotice message={error} />}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Resubmitting…' : 'Submit corrected application'}
        </button>
      </form>
    </section>
  );
}

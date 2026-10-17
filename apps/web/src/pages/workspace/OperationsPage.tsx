import { useFeedback } from '../../components/Feedback.tsx';
import type { AdminOperations } from '@7even/contracts';
import { useState } from 'react';
import {
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
} from '../../components/ui.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { api } from '../../lib/api.ts';
import { dateLabel } from './shared.tsx';
type Decision =
  | { kind: 'source'; id: string; label: string; enabled: boolean }
  | { kind: 'reward'; id: string; label: string; enabled: boolean };
export function OperationsPage() {
  const { data, loading, error, reload } = useApi<AdminOperations>('/admin/operations');
  const [decision, setDecision] = useState<Decision | null>(null);
  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Keep the connections clear."
        description="Recovery queues, reception sources and published rewards. These records come from the running platform."
      />
      {loading && <Loading />}
      {error && <ErrorNotice message={error} retry={reload} />}
      {data && (
        <>
          <div className="metrics-grid">
            {Object.entries(data.health)
              .filter(([key]) => key !== 'checkedAt')
              .map(([key, value]) => (
                <div className="metric" key={key}>
                  <p>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</p>
                  <strong>{value}</strong>
                </div>
              ))}
          </div>
          <section className="workspace-section">
            <div className="section-heading">
              <h2>Reception sources</h2>
              <p>Checked {dateLabel(data.health.checkedAt)}</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Business / team member</th>
                    <th>Last accepted sync</th>
                    <th>Recorded events</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((source) => (
                    <tr key={source.id}>
                      <td>
                        <strong>{source.businessName}</strong>
                        <small>{source.displayName}</small>
                      </td>
                      <td>
                        {source.lastSyncedAt
                          ? dateLabel(source.lastSyncedAt)
                          : 'No accepted sync yet'}
                      </td>
                      <td>{source.eventCount}</td>
                      <td>
                        <StatusBadge status={source.isActive ? 'ACTIVE' : 'REVOKED'} />
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            setDecision({
                              kind: 'source',
                              id: source.id,
                              label: `${source.displayName} at ${source.businessName}`,
                              enabled: !source.isActive,
                            })
                          }
                        >
                          {source.isActive ? 'Disable source' : 'Enable source'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="workspace-section">
            <div className="section-heading">
              <h2>Reward moderation</h2>
            </div>
            <div className="work-offering-grid">
              {data.rewards.map((reward) => (
                <article className="panel" key={reward.id}>
                  <p className="eyebrow">{reward.businessName}</p>
                  <h2>{reward.title}</h2>
                  <p className="small-copy">{reward.description}</p>
                  <p>
                    {reward.pointsCost} points · {reward.remaining} left
                  </p>
                  <StatusBadge status={reward.published ? 'PUBLISHED' : 'UNPUBLISHED'} />
                  <div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setDecision({
                          kind: 'reward',
                          id: reward.id,
                          label: reward.title,
                          enabled: !reward.published,
                        })
                      }
                    >
                      {reward.published ? 'Unpublish reward' : 'Review publication'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {decision && (
        <DecisionDialog decision={decision} onClose={() => setDecision(null)} onDone={reload} />
      )}
    </>
  );
}
function DecisionDialog({
  decision,
  onClose,
  onDone,
}: {
  decision: Decision;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(crypto.randomUUID());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
    setError(null);
    setBusy(true);
    try {
      await api(
        `/admin/${decision.kind === 'source' ? 'sources' : 'rewards'}/${decision.id}/${decision.kind === 'source' ? 'status' : 'moderation'}`,
        {
          method: 'POST',
          idempotencyKey: key,
          body:
            decision.kind === 'source'
              ? { active: decision.enabled, reason }
              : { published: decision.enabled, reason },
        },
      );
      showSuccess('The operations decision has been recorded.');
      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this decision.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={decision.enabled ? 'Enable this record?' : 'Disable this record?'}
      onClose={onClose}
      busy={busy}
    >
      <p>{decision.label}</p>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Reason">
          <textarea name="reason" minLength={3} maxLength={500} required />
        </Field>
        {error && <ErrorNotice message={error} />}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Go back
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm decision'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

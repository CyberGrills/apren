import type { Notification } from '@7even/contracts';
import { ArrowUpRight, Bell } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorNotice, useFeedback } from '../../components/ui.tsx';
import { api } from '../../lib/api.ts';
import { friendlyDate } from '../public/PublicShell.tsx';

export function ActivityView({
  notifications,
  reload,
}: {
  notifications: Notification[];
  reload: () => void;
}) {
  const { showSuccess } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef<Record<string, string>>({});
  async function markRead(notification: Notification) {
    setBusy(notification.id);
    setError(null);
    attempts.current[notification.id] ??= crypto.randomUUID();
    try {
      await api<Notification>(`/notifications/${notification.id}/read`, {
        method: 'POST',
        idempotencyKey: attempts.current[notification.id],
      });
      showSuccess('This update is marked as read.', 'Update saved.');
      reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not update this notification. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  }
  if (!notifications.length)
    return (
      <EmptyState
        title="Nothing new for now."
        description="Booking updates and invitations will appear here when there is something to review."
      />
    );
  return (
    <>
      {error && <ErrorNotice message={error} retry={reload} />}
      <div className="customer-updates">
        {notifications.map((notification) => {
          const href = /^\/app\/[a-z-]+$/.test(notification.href)
            ? notification.href
            : '/app/bookings';
          return (
            <article
              className={`customer-update${notification.readAt ? '' : ' unread'}`}
              key={notification.id}
            >
              <div className="customer-update-icon">
                <Bell size={20} aria-hidden="true" />
              </div>
              <div className="customer-update-content">
                <div className="customer-update-meta">
                  <span className="public-eyebrow">
                    {notification.readAt ? 'Read' : 'New update'}
                  </span>
                  <time dateTime={notification.createdAt}>
                    {friendlyDate(notification.createdAt)}
                  </time>
                </div>
                <h2>{notification.title}</h2>
                <p>{notification.body}</p>
                <div className="customer-update-actions">
                  <Link to={href} className="public-text-link">
                    Review this update <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  {!notification.readAt && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy === notification.id}
                      onClick={() => markRead(notification)}
                    >
                      {busy === notification.id ? 'Saving…' : 'Mark as read'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

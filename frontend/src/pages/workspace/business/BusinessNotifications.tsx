import type { Notification } from '@7even/contracts';
import { ArrowUpRight, Bell } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFeedback } from '../../../components/Feedback.tsx';
import { EmptyState, ErrorNotice } from '../../../components/ui.tsx';
import { api } from '../../../lib/api.ts';

function notificationDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(value));
}

function businessNotificationHref(value: string) {
  return /^\/(business(?:\/[a-z-]+)?|reception)$/.test(value) ? value : '/business';
}

export function BusinessNotifications({
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
      showSuccess('This business update is marked as read.');
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this notification.');
    } finally {
      setBusy(null);
    }
  }

  if (!notifications.length) {
    return (
      <EmptyState
        title="You’re all caught up."
        description="Reservation updates and important business notices will appear here."
      />
    );
  }

  return (
    <section className="business-notifications" aria-label="Business notifications">
      {error && <ErrorNotice message={error} retry={reload} />}
      {notifications.map((notification) => (
        <article className={`business-notification ${notification.readAt ? '' : 'is-unread'}`} key={notification.id}>
          <span className="business-notification-icon"><Bell size={18} aria-hidden="true" /></span>
          <div className="business-notification-body">
            <div className="business-notification-meta">
              <span>{notification.readAt ? 'Read' : 'New update'}</span>
              <time dateTime={notification.createdAt}>{notificationDate(notification.createdAt)}</time>
            </div>
            <h2>{notification.title}</h2>
            <p>{notification.body}</p>
            <div className="business-notification-actions">
              <Link to={businessNotificationHref(notification.href)}>
                Review update <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
              {!notification.readAt && (
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  disabled={busy === notification.id}
                  onClick={() => void markRead(notification)}
                >
                  {busy === notification.id ? 'Saving…' : 'Mark as read'}
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

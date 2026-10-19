import { ErrorPopup } from './Feedback.tsx';
export { useFeedback, SuccessNotice } from './Feedback.tsx';
import type { Offering } from '@7even/contracts';
import { formatMoney } from '@7even/engine';
import { ArrowUpRight, MapPin, X } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      {status.toLowerCase().replaceAll('_', ' ')}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <ErrorPopup message={message} retry={retry} />;
}
export function Loading() {
  return (
    <p className="loading-state" role="status">
      <span className="loading-dot" /> Loading…
    </p>
  );
}
export function Money({ minor, currency = 'NGN' }: { minor: string; currency?: string }) {
  return <span className="money">{formatMoney(minor, currency)}</span>;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generated = useId();
  const child = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? children
    : null;
  const controlId = child?.props.id ?? generated;
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {child
        ? cloneElement(child as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
            id: controlId,
            'aria-describedby':
              [child.props['aria-describedby'], hint ? `${controlId}-hint` : null]
                .filter(Boolean)
                .join(' ') || undefined,
          })
        : children}
      {hint && <small id={`${controlId}-hint`}>{hint}</small>}
    </div>
  );
}
export function Metric({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  returnFocusRef,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      queueMicrotask(() => {
        const target = returnFocusRef?.current ?? opener;
        if (target?.isConnected && !target.hasAttribute('disabled')) target.focus();
      });
    };
  }, [returnFocusRef]);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function OfferingCard({ offering }: { offering: Offering }) {
  const location = useLocation();
  const to = `/places/${offering.id}${location.pathname === '/explore' ? location.search : ''}`;
  return (
    <article className="offering-card">
      <Link to={to} className="offering-image-link" tabIndex={-1} aria-hidden="true">
        {offering.images[0] ? (
          <img src={offering.images[0]} alt="" loading="lazy" width="640" height="460" />
        ) : (
          <div className="image-placeholder">7</div>
        )}
        {offering.isSample && <span className="sample-tag">Sample place</span>}
      </Link>
      <div className="offering-card-copy">
        <p className="offering-kind">
          {offering.kind === 'STAY'
            ? 'A place to stay'
            : offering.kind === 'DINING'
              ? 'At the table'
              : 'Something to do'}
          <span>
            <MapPin size={12} /> {offering.city}
          </span>
        </p>
        <h3>
          <Link to={to}>
            {offering.title}
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </h3>
        <p className="offering-business">{offering.businessName}</p>
        {offering.bookingOptimization && (
          <div className="hotel-match" aria-label={`7even booking match score ${offering.bookingOptimization.matchScore} out of 100`}>
            <div className="hotel-match-line">
              <strong>7even match {offering.bookingOptimization.matchScore}/100</strong>
              <span>{offering.bookingOptimization.roomsAvailable} rooms · {offering.bookingOptimization.nights} night(s)</span>
            </div>
            <p>{offering.bookingOptimization.reasons[0]}</p>
          </div>
        )}
        <div className="offering-price">
          <Money minor={offering.priceMinor} />
          <span>/ {offering.unitLabel}</span>
        </div>
      </div>
    </article>
  );
}

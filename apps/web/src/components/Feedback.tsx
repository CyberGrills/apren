import { CircleCheck, CircleAlert, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
interface Feedback {
  id: string;
  kind: 'success' | 'error';
  title: string;
  message: ReactNode;
  retry?: () => void;
}
interface FeedbackApi {
  showSuccess(message: ReactNode, title?: string): void;
  showError(message: ReactNode, retry?: () => void): void;
}
const Context = createContext<FeedbackApi | null>(null);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Feedback[]>([]);
  const showSuccess = useCallback((message: ReactNode, title = 'Done.') => {
    setQueue((current) => [
      ...current,
      { id: crypto.randomUUID(), kind: 'success', title, message },
    ]);
  }, []);
  const showError = useCallback((message: ReactNode, retry?: () => void) => {
    setQueue((current) =>
      current.some((item) => item.kind === 'error' && item.message === message)
        ? current
        : [
            ...current,
            { id: crypto.randomUUID(), kind: 'error', title: 'Please check this.', message, retry },
          ],
    );
  }, []);
  const close = useCallback(() => setQueue((current) => current.slice(1)), []);
  return (
    <Context value={{ showSuccess, showError }}>
      {children}
      {queue[0] && <FeedbackDialog key={queue[0].id} feedback={queue[0]} onClose={close} />}
    </Context>
  );
}
export function useFeedback() {
  const value = useContext(Context);
  if (!value) throw new Error('FeedbackProvider is missing.');
  return value;
}
function FeedbackDialog({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const messageId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const before =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    const formControl = document.querySelector<HTMLElement>(
      'dialog[open] input:not([disabled]), form input:not([disabled]), form button[type=submit]:not([disabled]), main button:not([disabled]), main a[href]',
    );
    dialog?.showModal();
    primary.current?.focus();
    return () => {
      dialog?.close();
      queueMicrotask(() => {
        const target =
          before?.isConnected && !before.hasAttribute('disabled')
            ? before
            : formControl?.isConnected
              ? formControl
              : null;
        target?.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`feedback-popup feedback-${feedback.kind}`}
      role={feedback.kind === 'error' ? 'alertdialog' : 'dialog'}
      aria-labelledby={heading}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        type="button"
        className="icon-button feedback-close"
        aria-label="Close message"
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <div className="feedback-icon" aria-hidden="true">
        {feedback.kind === 'success' ? (
          <CircleCheck size={30} strokeWidth={1.5} />
        ) : (
          <CircleAlert size={30} strokeWidth={1.5} />
        )}
      </div>
      <p className="eyebrow">
        {feedback.kind === 'success' ? '7even update' : 'Something needs attention'}
      </p>
      <h2 id={heading}>{feedback.title}</h2>
      <div
        className="feedback-message"
        id={messageId}
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest('a[href]')) onClose();
        }}
      >
        {typeof feedback.message === 'string' ? <p>{feedback.message}</p> : feedback.message}
      </div>
      <div className="feedback-actions">
        {feedback.retry && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onClose();
              feedback.retry?.();
            }}
          >
            Try again
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onClose} ref={primary}>
          {feedback.kind === 'success' ? 'Continue' : 'Got it'}
        </button>
      </div>
    </dialog>
  );
}
export function SuccessNotice({ message, title }: { message: ReactNode; title?: string }) {
  const { showSuccess } = useFeedback();
  const shown = useRef(false);
  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      showSuccess(message, title);
    }
  }, [message, title, showSuccess]);
  return null;
}
export function ErrorPopup({ message, retry }: { message: string; retry?: () => void }) {
  const { showError } = useFeedback();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current !== message) {
      previous.current = message;
      showError(message, retry);
    }
  }, [message, retry, showError]);
  return null;
}

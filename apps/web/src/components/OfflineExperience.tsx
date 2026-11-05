import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export function useConnectionStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function OfflineStatusBar() {
  const online = useConnectionStatus();
  return (
    <div className={online ? 'seven-connectivity-bar is-online' : 'seven-connectivity-bar is-offline'} role="status" aria-live="polite">
      <span className="seven-connectivity-indicator" aria-hidden="true" />
      <span>{online ? 'You’re online' : 'You’re offline · Saved information is still available'}</span>
      <Link to="/offline">Offline space</Link>
    </div>
  );
}

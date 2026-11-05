import { useEffect, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Smartphone } from 'lucide-react';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';
import './install-app.css';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppPage() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [ios, setIos] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setIos(isIosDevice());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setMessage('7even has been added to your device.');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setMessage(choice.outcome === 'accepted'
      ? 'Follow the prompt to finish adding 7even to your device.'
      : 'No problem. You can install 7even whenever you are ready.');
  }

  return (
    <div className="public-page seven-install-page">
      <PublicHeader />
      <main id="main-content" className="public-container seven-install-main">
        <section className="seven-install-card" aria-labelledby="install-title">
          <div className="seven-install-icon"><Smartphone size={30} aria-hidden="true" /></div>
          <p className="public-eyebrow">7EVEN · YOUR TRAVEL COMPANION</p>
          <h1 id="install-title">Take 7even with you.</h1>
          <p className="seven-install-lead">
            Add 7even to your home screen for a focused, app-like experience. Your installed
            shortcut opens the same 7even service; it does not create a separate account.
          </p>
          {installed ? (
            <p className="seven-install-status" role="status"><CheckCircle2 size={18} /> 7even is already installed on this device.</p>
          ) : installEvent ? (
            <button type="button" className="btn btn-primary seven-install-action" onClick={() => void install()}>
              <ArrowDownToLine size={18} /> Install 7even
            </button>
          ) : ios ? (
            <div className="seven-install-steps">
              <h2>Install on iPhone or iPad</h2>
              <ol>
                <li>Open this page in Safari.</li>
                <li>Tap the Share button.</li>
                <li>Choose <strong>Add to Home Screen</strong>, then tap Add.</li>
              </ol>
            </div>
          ) : (
            <div className="seven-install-steps">
              <h2>Install from your browser</h2>
              <ol>
                <li>Open 7even in Chrome or another supported browser.</li>
                <li>Open the browser menu.</li>
                <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, if shown.</li>
              </ol>
              <p>Your browser controls whether installation is available on this device.</p>
            </div>
          )}
          {message && <p className="seven-install-feedback" role="status">{message}</p>}
          <p className="seven-install-footnote">
            7even is currently an installable web app (PWA), not a Play Store or Apple App Store
            download. Installation availability depends on your browser and device.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

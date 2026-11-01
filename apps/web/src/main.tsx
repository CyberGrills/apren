import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/newsreader/latin-400-italic.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { SeasonProvider } from './context/SeasonContext.tsx';
import { seasonAt } from './lib/season.ts';
import './styles/global.css';
import './styles/public.css';
import './styles/demo-stay.css';
import './styles/customer.css';
import './styles/workspace.css';
document.documentElement.dataset.season = seasonAt(new Date());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SeasonProvider>
      <App />
    </SeasonProvider>
  </StrictMode>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

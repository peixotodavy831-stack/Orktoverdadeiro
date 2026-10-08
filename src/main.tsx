import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import TodayPrototype from './components/prototype/TodayPrototype';
import './index.css';

const isTodayPrototype = new URLSearchParams(window.location.search).get('prototype') === 'hoje';

if (isTodayPrototype) {
  document.querySelectorAll('link[rel="icon"]').forEach(icon => icon.remove());
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/svg+xml';
  icon.href = '/wia-favicon.svg';
  document.head.appendChild(icon);
  document.title = 'ORKTO · Protótipo';
}

const sentryDsn = import.meta.env.VITE_APP_ENV === 'staging' ? undefined : import.meta.env.VITE_SENTRY_DSN;

if (!isTodayPrototype && sentryDsn) Sentry.init({
  dsn: sentryDsn,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/orkto\.vercel\.app/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isTodayPrototype ? <TodayPrototype /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { Screen } from './components/Screen';
import { mockScreen, PREVIEW_STATES, type PreviewState } from './preview/mock';

// /preview?state=<stare>: ecranul cu date mock identice cu design/static (bucla de verificare vizuală).
// Orice altă adresă: ecranul live, conectat la HA prin proxy-ul serverului.
const params = new URLSearchParams(location.search);
const preview = /\/preview\/?$/.test(location.pathname) || params.has('state');

function pickState(): PreviewState {
  const s = params.get('state') as PreviewState | null;
  return s && PREVIEW_STATES.includes(s) ? s : 'pregatit';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{preview ? <Screen model={mockScreen(pickState())} /> : <App />}</StrictMode>,
);

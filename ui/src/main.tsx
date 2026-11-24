import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Screen } from './components/Screen';
import { mockScreen, PREVIEW_STATES, type PreviewState } from './preview/mock';

// /preview?state=<stare>: ecranul cu date mock identice cu design/static (bucla de verificare vizuală).
// Rădăcina va folosi datele live din HA (pasul următor); până atunci afișează tot mock-ul.
function pickState(): PreviewState {
  const s = new URLSearchParams(location.search).get('state') as PreviewState | null;
  return s && PREVIEW_STATES.includes(s) ? s : 'pregatit';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Screen model={mockScreen(pickState())} />
  </StrictMode>,
);

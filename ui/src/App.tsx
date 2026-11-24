import { useEffect } from 'react';
import { Screen } from './components/Screen';
import { useLive } from './live/useLive';

const typing = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

// Ecranul live. Space ținut apăsat = push-to-talk (doar când focusul nu e într-un câmp sau buton).
export function App() {
  const { model, actions, onSpace } = useLive();

  useEffect(() => {
    const ok = (e: KeyboardEvent) => e.code === 'Space' && !typing(document.activeElement) && !(document.activeElement instanceof HTMLButtonElement) && !document.querySelector('[role="dialog"]');
    const down = (e: KeyboardEvent) => {
      if (!ok(e)) return;
      e.preventDefault();
      if (!e.repeat) onSpace(true);
    };
    const up = (e: KeyboardEvent) => {
      if (!ok(e)) return;
      onSpace(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onSpace]);

  if (!model) {
    return (
      <div className="min-h-[100dvh] bg-bg flex items-center justify-center font-mono text-[12px] tracking-[0.2em] text-text-muted" role="status">
        MĂ CONECTEZ LA HOME ASSISTANT…
      </div>
    );
  }
  return <Screen model={model} actions={actions} />;
}

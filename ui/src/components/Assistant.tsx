import { useEffect, useId, useRef } from 'react';
import type { ConfirmRequest, Conversation, OrbState } from '../model';
import { Orb } from './Orb';

export interface AssistantProps {
  orb: OrbState;
  stateLabel: string;
  conversation: Conversation;
  micActive: boolean;
  confirm?: ConfirmRequest;
  micMessage?: { text: string; fullscreen: boolean };
  onAdjust?: (delta: number) => void;
  onConfirm?: () => void;
  onCancelConfirm?: () => void;
  onRetry?: () => void;
  onSubmitText?: (text: string) => void;
  onMicDown?: () => void;
  onMicUp?: () => void;
}

const LABEL_TONE: Record<OrbState, string> = {
  idle: 'text-text-muted',
  listening: 'text-accent',
  processing: 'text-accent',
  responding: 'text-accent',
  confirm: 'text-warning',
  offline: 'text-danger',
};

export function Assistant(props: AssistantProps) {
  const { orb, stateLabel, conversation, micActive, confirm, onSubmitText, onMicDown, onMicUp } = props;
  const inputId = useId();
  return (
    <section aria-label="Asistent" className="flex flex-col items-center justify-center gap-[20px] relative">
      <div className={'font-mono text-[12px] tracking-[0.2em] ' + LABEL_TONE[orb]} aria-live="polite">
        {stateLabel}
      </div>
      <Orb state={orb} />
      <ConversationView c={conversation} onRetry={props.onRetry} />
      <form
        className="w-full max-w-[520px] flex gap-[10px] items-stretch"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('cmd') as HTMLInputElement;
          const text = input.value.trim();
          if (text) {
            onSubmitText?.(text);
            input.value = '';
          }
        }}
      >
        <label htmlFor={inputId} className="sr-only-label">
          Comandă
        </label>
        <input
          id={inputId}
          name="cmd"
          type="text"
          autoComplete="off"
          placeholder="Scrie o comandă pentru Vena sau ține Space"
          className="flex-1 min-h-[48px] box-border bg-[rgba(7,17,25,0.9)] border border-solid border-border-strong text-text font-mono text-[13px] px-[16px] py-0"
        />
        <button
          type="button"
          aria-label="Vorbește cu Vena"
          aria-pressed={micActive}
          onPointerDown={(e) => {
            e.preventDefault();
            onMicDown?.();
          }}
          onPointerUp={onMicUp}
          onPointerLeave={onMicUp}
          onPointerCancel={onMicUp}
          className={
            'w-[48px] min-h-[48px] cursor-pointer flex items-center justify-center border border-solid border-accent ' +
            (micActive ? 'bg-accent text-accent-on' : 'bg-transparent text-accent')
          }
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      </form>
      {props.micMessage && (
        <div role="alert" className="w-full max-w-[520px] font-mono text-[12px] text-warning leading-[1.5] -mt-[8px]">
          {props.micMessage.text}
          {props.micMessage.fullscreen && (
            <>
              {' '}
              <a href={location.href} target="_blank" rel="noopener" className="text-accent">
                Deschide Vena pe tot ecranul
              </a>
            </>
          )}
        </div>
      )}
      {confirm && <ConfirmDialog req={confirm} onConfirm={props.onConfirm} onCancel={props.onCancelConfirm} onAdjust={props.onAdjust} />}
    </section>
  );
}

// Ecranul de confirmare pentru aparatele protejate. Focusul trece pe dialog (fără inel vizibil),
// Escape anulează; Tab rămâne în dialog cât timp e deschis.
function ConfirmDialog({ req, onConfirm, onCancel, onAdjust }: { req: ConfirmRequest; onConfirm?: () => void; onCancel?: () => void; onAdjust?: (d: number) => void }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => prev?.focus?.();
  }, []);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel?.();
        if (e.key === 'Tab') {
          const btns = ref.current?.querySelectorAll('button');
          if (!btns?.length) return;
          const first = btns[0], last = btns[btns.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }}
      className="absolute top-[-40px] bottom-[-40px] left-[-14%] right-[-14%] z-[2] flex items-center justify-center outline-none"
      // Fundal radial care se estompează spre exterior (fără margini dure, fără backdrop-filter).
      style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(4,7,11,0.82) 0%, rgba(4,7,11,0.6) 40%, rgba(4,7,11,0.25) 70%, rgba(4,7,11,0) 100%)' }}
    >
      <div className="w-full max-w-[440px] border border-solid border-warning bg-[#0d0f0c] px-[28px] py-[26px] flex flex-col gap-[14px] shadow-[0_0_40px_rgba(232,178,90,0.18)]">
        <div className="font-mono text-[11px] tracking-[0.2em] text-warning">{req.kicker}</div>
        <h2 id={titleId} className="m-0 text-[24px] font-semibold">
          {req.title}
        </h2>
        <p className="m-0 text-[15px] text-text leading-[1.5]">{req.body}</p>
        {req.adjust !== undefined && (
          <div className="flex items-center gap-[10px]">
            <button type="button" aria-label="Scade" onClick={() => onAdjust?.(-0.5)} className="w-[44px] min-h-[40px] border border-solid border-[#5a4520] bg-transparent text-warning font-mono text-[16px] cursor-pointer">
              −
            </button>
            <span className="font-mono text-[16px] text-warning min-w-[72px] text-center" aria-live="polite">
              {req.adjust}
            </span>
            <button type="button" aria-label="Crește" onClick={() => onAdjust?.(0.5)} className="w-[44px] min-h-[40px] border border-solid border-[#5a4520] bg-transparent text-warning font-mono text-[16px] cursor-pointer">
              +
            </button>
          </div>
        )}
        <p className="m-0 font-mono text-[12px] text-warning-muted leading-[1.5]">{req.note}</p>
        <div className="flex gap-[10px] mt-[4px]">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-h-[44px] border-0 bg-warning text-warning-on font-display text-[15px] font-semibold cursor-pointer"
          >
            {req.confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] border border-solid border-offline bg-transparent text-text font-display text-[15px] cursor-pointer"
          >
            {req.cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationView({ c, onRetry }: { c: Conversation; onRetry?: () => void }) {
  switch (c.kind) {
    case 'greeting':
      return (
        <div className="text-center flex flex-col gap-[6px] min-h-[72px]">
          <div className="text-[26px] font-medium">{c.title}</div>
          <div className="text-[15px] text-text-secondary">{c.summary}</div>
        </div>
      );
    case 'listening':
      return (
        <div className="text-center flex flex-col gap-[8px] min-h-[72px]">
          <div className="text-[26px] font-medium">
            „{c.partial}
            <span className="caret text-accent">▍</span>”
          </div>
          <div className="font-mono text-[12px] text-text-muted">{c.hint}</div>
        </div>
      );
    case 'processing':
      return (
        <div className="text-center flex flex-col gap-[8px] min-h-[72px]">
          <div className="text-[26px] font-medium text-text-secondary">„{c.text}”</div>
          <div className="font-mono text-[12px] text-text-muted">{c.hint}</div>
        </div>
      );
    case 'responding':
      return (
        <div className="text-center flex flex-col items-center gap-[10px] min-h-[72px]">
          <div className="font-mono text-[12px] text-text-muted">TU: {c.you}</div>
          <div className="text-[26px] font-medium">{c.answer}</div>
          {c.chip && <div className="font-mono text-[11px] text-accent-on bg-accent px-[10px] py-[4px]">{c.chip}</div>}
          {c.via && <div className="font-mono text-[11px] text-text-muted tracking-[0.08em]">via {c.via}</div>}
        </div>
      );
    case 'offline':
      return (
        <div className="text-center flex flex-col items-center gap-[10px] min-h-[72px]">
          <div className="text-[24px] font-medium">{c.title}</div>
          <div className="text-[14px] text-text-secondary">{c.detail}</div>
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[12px] bg-transparent text-danger border border-solid border-danger px-[16px] py-0 min-h-[40px] cursor-pointer"
          >
            {c.retryLabel}
          </button>
        </div>
      );
    case 'none':
      return null;
  }
}

import { useId } from 'react';
import type { Conversation, OrbState } from '../model';
import { Orb } from './Orb';

export interface AssistantProps {
  orb: OrbState;
  stateLabel: string;
  conversation: Conversation;
  micActive: boolean;
  onSubmitText?: (text: string) => void;
  onMicDown?: () => void;
  onMicUp?: () => void;
}

export function Assistant({ orb, stateLabel, conversation, micActive, onSubmitText, onMicDown, onMicUp }: AssistantProps) {
  const inputId = useId();
  return (
    <section aria-label="Asistent" className="flex flex-col items-center justify-center gap-[20px] relative">
      <div className={'font-mono text-[12px] tracking-[0.2em] ' + (orb === 'idle' ? 'text-text-muted' : 'text-accent')} aria-live="polite">
        {stateLabel}
      </div>
      <Orb state={orb} />
      <ConversationView c={conversation} />
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
    </section>
  );
}

function ConversationView({ c }: { c: Conversation }) {
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
        </div>
      );
  }
}

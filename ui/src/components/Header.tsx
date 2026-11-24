import type { StatusItem } from '../model';

export function Header({ location, status }: { location: string; status: StatusItem[] }) {
  return (
    <header className="flex items-center justify-between gap-[16px] flex-wrap [border-bottom:1px_solid_#12303d] pb-[14px]">
      <div className="flex items-center gap-[14px]">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="12" fill="none" stroke="#4fd8ff" strokeWidth="1.5" />
          <circle cx="14" cy="14" r="5" fill="#4fd8ff" />
        </svg>
        <div className="text-[20px] font-semibold tracking-[0.32em]">VENA</div>
        <div className="font-mono text-[12px] text-text-muted tracking-[0.08em]">// {location}</div>
      </div>
      <div className="flex gap-[24px] font-mono text-[12px] text-text-muted flex-wrap">
        {status.map((s) =>
          s.plain ? (
            <span key={s.label} className="text-text">
              {s.label}
            </span>
          ) : (
            <span key={s.label}>
              {s.label} <span className="text-accent">{s.value}</span>
            </span>
          ),
        )}
      </div>
    </header>
  );
}

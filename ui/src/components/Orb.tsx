import { useId } from 'react';
import type { OrbState } from '../model';

// Orb-ul din design/static (SVG 400×400). Fiecare stare schimbă doar clasele de animație,
// culorile, dash-urile și razele, exact ca în referințe.
interface OrbLook {
  outer: { cls: string; stroke: string };
  mid: { cls: string; dash: string };
  inner: { cls: string };
  core: { cls: string; r: number };
  center: { cls: string; fill: string };
}

const LOOKS: Record<'idle' | 'listening' | 'processing' | 'responding', OrbLook> = {
  idle: {
    outer: { cls: 's-slow', stroke: '#1f4a5c' },
    mid: { cls: 'r-slow', dash: '90 40 10 40' },
    inner: { cls: 's-slow' },
    core: { cls: 'c-idle', r: 86 },
    center: { cls: 'c-idle', fill: '#e9fbff' },
  },
  listening: {
    outer: { cls: 's-fast', stroke: '#4fd8ff' },
    mid: { cls: 'r-fast', dash: '90 40 10 40' },
    inner: { cls: 's-fast' },
    core: { cls: 'c-listen', r: 100 },
    center: { cls: 'c-listen', fill: '#ffffff' },
  },
  processing: {
    outer: { cls: 's-slow', stroke: '#1f4a5c' },
    mid: { cls: 'r-proc', dash: '60 860' },
    inner: { cls: 's-none' },
    core: { cls: 'c-none', r: 70 },
    center: { cls: 'c-none', fill: '#bff3ff' },
  },
  responding: {
    outer: { cls: 's-slow', stroke: '#1f4a5c' },
    mid: { cls: 'r-slow', dash: '90 40 10 40' },
    inner: { cls: 's-fast' },
    core: { cls: 'c-talk', r: 96 },
    center: { cls: 'c-talk', fill: '#ffffff' },
  },
};

export function Orb({ state }: { state: OrbState }) {
  const id = useId().replace(/:/g, '');
  // TODO(confirm/offline): se portează din 05-confirmare / 06-offline după validarea stării „pregătit”.
  const look = LOOKS[state === 'confirm' || state === 'offline' ? 'idle' : state];
  const on = `o-on-${id}`;
  const off = `o-off-${id}`;
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[380px] h-auto" aria-hidden="true">
      <defs>
        <radialGradient id={on} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#bff3ff" />
          <stop offset="45%" stopColor="#4fd8ff" />
          <stop offset="100%" stopColor="#4fd8ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={off} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5d6b72" />
          <stop offset="50%" stopColor="#2a3439" />
          <stop offset="100%" stopColor="#2a3439" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className={look.outer.cls}>
        <circle cx="200" cy="200" r="186" fill="none" stroke={look.outer.stroke} strokeWidth="1" strokeDasharray="2 7" />
      </g>
      <circle cx="200" cy="200" r="164" fill="none" stroke="#12303d" strokeWidth="1" />
      <g className={look.mid.cls}>
        <circle cx="200" cy="200" r="146" fill="none" stroke="#4fd8ff" strokeWidth="2" strokeDasharray={look.mid.dash} opacity="0.85" />
      </g>
      <g className={look.inner.cls}>
        <circle cx="200" cy="200" r="122" fill="none" stroke="#4fd8ff" strokeWidth="6" strokeDasharray="2 10" opacity="0.5" />
      </g>
      <circle className={look.core.cls} cx="200" cy="200" r={look.core.r} fill={`url(#${on})`} />
      <circle className={look.center.cls} cx="200" cy="200" r="38" fill={look.center.fill} />
      <line x1="200" y1="6" x2="200" y2="26" stroke="#4fd8ff" strokeWidth="1.5" />
      <line x1="200" y1="374" x2="200" y2="394" stroke="#4fd8ff" strokeWidth="1.5" />
      <line x1="6" y1="200" x2="26" y2="200" stroke="#4fd8ff" strokeWidth="1.5" />
      <line x1="374" y1="200" x2="394" y2="200" stroke="#4fd8ff" strokeWidth="1.5" />
    </svg>
  );
}

import { useId } from 'react';
import type { OrbState } from '../model';

// Orb-ul din design/static (SVG 400×400). Fiecare stare schimbă doar clasele de animație,
// culorile, dash-urile și razele, exact ca în referințe.
interface OrbLook {
  outer: { cls: string; stroke: string };
  mid: { cls: string; dash: string; stroke: string };
  inner: { cls: string; stroke: string };
  core: { cls: string; r: number; off?: boolean };
  center: { cls: string; fill: string };
  ticks: string;
}

const A = '#4fd8ff';
const W = '#e8b25a';
const OFF = '#3a4a52';

const LOOKS: Record<OrbState, OrbLook> = {
  idle: {
    outer: { cls: 's-slow', stroke: '#1f4a5c' },
    mid: { cls: 'r-slow', dash: '90 40 10 40', stroke: A },
    inner: { cls: 's-slow', stroke: A },
    core: { cls: 'c-idle', r: 86 },
    center: { cls: 'c-idle', fill: '#e9fbff' },
    ticks: A,
  },
  listening: {
    outer: { cls: 's-fast', stroke: A },
    mid: { cls: 'r-fast', dash: '90 40 10 40', stroke: A },
    inner: { cls: 's-fast', stroke: A },
    core: { cls: 'c-listen', r: 100 },
    center: { cls: 'c-listen', fill: '#ffffff' },
    ticks: A,
  },
  processing: {
    outer: { cls: 's-slow', stroke: '#1f4a5c' },
    mid: { cls: 'r-proc', dash: '60 860', stroke: A },
    inner: { cls: 's-none', stroke: A },
    core: { cls: 'c-none', r: 70 },
    center: { cls: 'c-none', fill: '#bff3ff' },
    ticks: A,
  },
  responding: {
    outer: { cls: 's-slow', stroke: '#1f4a5c' },
    mid: { cls: 'r-slow', dash: '90 40 10 40', stroke: A },
    inner: { cls: 's-fast', stroke: A },
    core: { cls: 'c-talk', r: 96 },
    center: { cls: 'c-talk', fill: '#ffffff' },
    ticks: A,
  },
  confirm: {
    outer: { cls: 's-none', stroke: '#5a4520' },
    mid: { cls: 's-none', dash: '90 40 10 40', stroke: W },
    inner: { cls: 's-none', stroke: W },
    core: { cls: 'c-idle', r: 80 },
    center: { cls: 'c-idle', fill: '#e9fbff' },
    ticks: W,
  },
  offline: {
    outer: { cls: 's-none', stroke: '#1c262b' },
    mid: { cls: 's-none', dash: '4 14', stroke: OFF },
    inner: { cls: 's-none', stroke: OFF },
    core: { cls: 'c-none', r: 80, off: true },
    center: { cls: 'c-none', fill: OFF },
    ticks: OFF,
  },
};

export function Orb({ state }: { state: OrbState }) {
  const id = useId().replace(/:/g, '');
  const look = LOOKS[state];
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
        <circle cx="200" cy="200" r="146" fill="none" stroke={look.mid.stroke} strokeWidth="2" strokeDasharray={look.mid.dash} opacity="0.85" />
      </g>
      <g className={look.inner.cls}>
        <circle cx="200" cy="200" r="122" fill="none" stroke={look.inner.stroke} strokeWidth="6" strokeDasharray="2 10" opacity="0.5" />
      </g>
      <circle className={look.core.cls} cx="200" cy="200" r={look.core.r} fill={`url(#${look.core.off ? off : on})`} />
      <circle className={look.center.cls} cx="200" cy="200" r="38" fill={look.center.fill} />
      <line x1="200" y1="6" x2="200" y2="26" stroke={look.ticks} strokeWidth="1.5" />
      <line x1="200" y1="374" x2="200" y2="394" stroke={look.ticks} strokeWidth="1.5" />
      <line x1="6" y1="200" x2="26" y2="200" stroke={look.ticks} strokeWidth="1.5" />
      <line x1="374" y1="200" x2="394" y2="200" stroke={look.ticks} strokeWidth="1.5" />
    </svg>
  );
}

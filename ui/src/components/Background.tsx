import { useId } from 'react';
import type { ScreenModel } from '../model';

// Fundalul: glow radial + pattern (hex implicit), mascat radial. Valorile din tokens.json.
export function Background({ pattern, strength }: ScreenModel['background']) {
  const id = useId().replace(/:/g, '');
  const opacity = (Math.max(0, Math.min(100, strength)) / 100) * 0.32;
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 45%, rgba(79,216,255,0.07), rgba(79,216,255,0) 70%)' }}
      />
      {pattern !== 'none' && (
        <svg aria-hidden="true" width="100%" height="100%" className="absolute inset-0 pointer-events-none" style={{ opacity }}>
          <defs>
            {pattern === 'hex' && (
              <pattern id={`p-${id}`} width="20.78" height="36" patternUnits="userSpaceOnUse">
                <path d="M10.39 0L20.78 6V18L10.39 24L0 18V6Z M10.39 24V36" fill="none" stroke="#4fd8ff" strokeWidth="0.8" />
              </pattern>
            )}
            {pattern === 'grid' && (
              <pattern id={`p-${id}`} width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M24 0H0V24" fill="none" stroke="#4fd8ff" strokeWidth="0.8" />
              </pattern>
            )}
            {pattern === 'dots' && (
              <pattern id={`p-${id}`} width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="9" cy="9" r="1" fill="#4fd8ff" />
              </pattern>
            )}
            <radialGradient id={`f-${id}`} cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.25" />
            </radialGradient>
            <mask id={`m-${id}`}>
              <rect width="100%" height="100%" fill={`url(#f-${id})`} />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill={`url(#p-${id})`} mask={`url(#m-${id})`} />
        </svg>
      )}
    </>
  );
}

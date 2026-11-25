import { useEffect, useState } from 'react';
import type { Camera, JournalEntry, Tile } from '../model';

/** Pauza dintre două imagini și cea după o eroare. */
const FRAME_MS = 1000;
const RETRY_MS = 5000;

/**
 * Imagine „live” din poze succesive (camera_proxy): următoarea se cere abia după
 * ce s-a încărcat cea curentă, doar cât tab-ul e vizibil. Imaginea nouă se
 * preîncarcă, ca să nu clipească.
 */
function LiveImage({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    let img: HTMLImageElement | undefined;
    let loading = false;
    const next = () => {
      timer = undefined;
      if (stop || document.hidden) return;
      loading = true;
      img = new Image();
      const u = `${url}?t=${Date.now()}`;
      img.onload = () => {
        loading = false;
        if (stop) return;
        setSrc(u);
        setFailed(false);
        timer = window.setTimeout(next, FRAME_MS);
      };
      img.onerror = () => {
        loading = false;
        if (stop) return;
        setFailed(true);
        timer = window.setTimeout(next, RETRY_MS);
      };
      img.src = u;
    };
    const onVisible = () => {
      if (!document.hidden && timer === undefined && !loading && !stop) next();
    };
    setSrc(undefined);
    setFailed(false);
    next();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop = true;
      if (timer !== undefined) clearTimeout(timer);
      if (img) img.src = '';
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url]);
  return (
    <>
      {src && <img src={src} alt={`Cameră ${name}`} className="absolute inset-0 w-full h-full object-cover" />}
      {failed && !src && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-text-muted tracking-[0.16em]">FĂRĂ IMAGINE</div>
      )}
    </>
  );
}

export function Yard({ camera, tiles, journal }: { camera: Camera | null; tiles: Tile[]; journal: JournalEntry[] }) {
  return (
    <section aria-label="Curte și evenimente" className="flex flex-col gap-[16px]">
      <h2 className="m-0 text-[12px] font-medium tracking-[0.24em] text-text-muted">CAMERA CURȚII · LIVE</h2>
      {camera ? (
        <CameraView camera={camera} />
      ) : (
        <div className="relative aspect-[16/10] bg-camera-bg border border-solid border-border-strong flex items-center justify-center font-mono text-[12px] text-text-muted tracking-[0.16em]">
          NICIO CAMERĂ
        </div>
      )}
      {tiles.length > 0 && <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-[10px]">
        {tiles.map((t) => (
          <div key={t.label} className="border border-solid border-border bg-surface p-[12px]">
            <div className="font-mono text-[11px] text-text-muted">{t.label}</div>
            <div className="text-[18px] font-semibold mt-[4px] overflow-hidden text-ellipsis whitespace-nowrap" title={t.value}>{t.value}</div>
          </div>
        ))}
      </div>}
      <h2 className="mt-[4px] mx-0 mb-0 text-[12px] font-medium tracking-[0.24em] text-text-muted">JURNAL</h2>
      {journal.length === 0 && <div className="font-mono text-[12px] text-text-muted">Niciun eveniment recent.</div>}
      <ol className="list-none m-0 p-0 flex flex-col gap-[10px] text-[14px]">
        {journal.map((j) => (
          <li key={j.id} className="flex gap-[12px]">
            <span className={'font-mono text-[12px] min-w-[44px] ' + (j.tone === 'accent' ? 'text-accent' : j.tone === 'danger' ? 'text-danger' : 'text-text-muted')}>{j.time}</span>
            <span>{j.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CameraView({ camera }: { camera: Camera }) {
  const d = camera.detection;
  return (
    <div className="relative aspect-[16/10] bg-camera-bg border border-solid border-border-strong overflow-hidden">
      {camera.streamUrl && <LiveImage url={camera.streamUrl} name={camera.name} />}
      <div
        className="absolute inset-0"
        style={{ background: 'repeating-linear-gradient(0deg, rgba(79,216,255,0.04) 0 1px, transparent 1px 4px)' }}
      />
      {!camera.signalLost && <div className="a-scan absolute left-0 right-0 top-0 h-[1px] bg-accent opacity-40" />}
      {d && !camera.signalLost && (
        <>
          <div className="absolute border-[1.5px] border-solid border-accent" style={{ left: d.left, top: d.top, width: d.width, height: d.height }} />
          <div
            className="absolute font-mono text-[11px] bg-accent text-accent-on px-[6px] py-[3px]"
            style={{ left: d.left, top: `calc(${d.top} - 22px)` }}
          >
            {d.label}
          </div>
        </>
      )}
      {camera.signalLost && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-danger tracking-[0.16em]">SEMNAL PIERDUT</div>
      )}
      {camera.rec && !camera.signalLost && <div className="absolute right-[10px] top-[8px] font-mono text-[11px] text-rec">● REC</div>}
      <div className="absolute left-[10px] bottom-[8px] font-mono text-[11px] text-text-secondary">
        {camera.name} · {camera.time}
      </div>
    </div>
  );
}

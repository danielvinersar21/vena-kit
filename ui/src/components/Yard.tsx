import type { Camera, JournalEntry, Tile } from '../model';

export function Yard({ camera, tiles, journal }: { camera: Camera; tiles: Tile[]; journal: JournalEntry[] }) {
  return (
    <section aria-label="Curte și evenimente" className="flex flex-col gap-[16px]">
      <h2 className="m-0 text-[12px] font-medium tracking-[0.24em] text-text-muted">CAMERA CURȚII · LIVE</h2>
      <CameraView camera={camera} />
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-[10px]">
        {tiles.map((t) => (
          <div key={t.label} className="border border-solid border-border bg-surface p-[12px]">
            <div className="font-mono text-[11px] text-text-muted">{t.label}</div>
            <div className="text-[18px] font-semibold mt-[4px]">{t.value}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-[4px] mx-0 mb-0 text-[12px] font-medium tracking-[0.24em] text-text-muted">JURNAL</h2>
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
      {camera.streamUrl && (
        <img src={camera.streamUrl} alt={`Cameră ${camera.name}, imagine live`} className="absolute inset-0 w-full h-full object-cover" />
      )}
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

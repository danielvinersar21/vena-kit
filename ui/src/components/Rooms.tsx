import type { Room, RoomRow } from '../model';

export interface RoomActions {
  onToggle?: (room: Room, row: Extract<RoomRow, { kind: 'toggle' }>) => void;
  onSetpoint?: (room: Room, row: Extract<RoomRow, { kind: 'setpoint' }>) => void;
}

export function Rooms({ rooms, ...actions }: { rooms: Room[] } & RoomActions) {
  return (
    <section aria-label="Camere" className="flex flex-col gap-[12px]">
      <h2 className="m-0 text-[12px] font-medium tracking-[0.24em] text-text-muted">CAMERE · PREZENȚĂ</h2>
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} {...actions} />
      ))}
    </section>
  );
}

function RoomCard({ room, onToggle, onSetpoint }: { room: Room } & RoomActions) {
  return (
    <div
      className={
        'border border-solid bg-surface px-[16px] py-[14px] flex flex-col gap-[10px] ' +
        (room.highlight ? 'border-accent shadow-[0_0_24px_rgba(79,216,255,0.25)]' : 'border-border')
      }
    >
      <div className="flex justify-between items-center">
        <span className="text-[18px] font-semibold">{room.name}</span>
        <PresenceBadge room={room} />
      </div>
      {room.rows.map((row) => (
        <Row key={row.id} room={room} row={row} onToggle={onToggle} onSetpoint={onSetpoint} />
      ))}
      {room.warnings?.map((w) => (
        <div key={w} className="font-mono text-[11px] text-warning">
          {w}
        </div>
      ))}
    </div>
  );
}

function PresenceBadge({ room }: { room: Room }) {
  if (room.protectedBadge) return <span className="font-mono text-[11px] text-warning">PROTEJAT</span>;
  if (room.presence === 'occupied') return <span className="font-mono text-[11px] text-accent">● OCUPAT</span>;
  if (room.presence === 'free') return <span className="font-mono text-[11px] text-text-muted">○ LIBER</span>;
  return null;
}

function Row({ room, row, onToggle, onSetpoint }: { room: Room; row: RoomRow } & RoomActions) {
  if (row.kind === 'toggle') {
    return (
      <div className="flex justify-between items-center text-[14px]">
        <span>{row.label}</span>
        {row.readOnly ? (
          <span className="font-mono text-text-muted">{row.on ? 'ON' : 'OFF'}</span>
        ) : (
          <button
            type="button"
            aria-pressed={row.on}
            aria-label={`${row.label}, ${room.name}`}
            onClick={() => onToggle?.(room, row)}
            className={
              'font-mono text-[12px] px-[12px] py-[6px] min-h-[32px] min-w-[52px] cursor-pointer border border-solid ' +
              (row.on ? 'bg-accent text-accent-on border-accent' : 'bg-transparent text-text-muted border-border-strong')
            }
          >
            {row.on ? 'ON' : 'OFF'}
          </button>
        )}
      </div>
    );
  }
  if (row.kind === 'setpoint') {
    return (
      <div className="flex justify-between items-center text-[14px]">
        <span>{row.label}</span>
        <button
          type="button"
          aria-label={`${row.label}: setează ${row.value} (cere confirmare)`}
          onClick={() => onSetpoint?.(room, row)}
          className="font-mono text-[12px] bg-transparent text-warning border border-solid border-[#5a4520] px-[12px] py-[6px] min-h-[32px] cursor-pointer"
        >
          {row.value}
        </button>
      </div>
    );
  }
  return (
    <div className="flex justify-between text-[14px]">
      <span>{row.label}</span>
      <span className="font-mono text-text-muted">{row.value}</span>
    </div>
  );
}

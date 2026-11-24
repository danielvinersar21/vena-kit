// Construiește view-model-ul ecranului din datele HA: zone → camere, entități → rânduri,
// plus tile-uri, cameră, jurnal și bara de stare. Funcții pure, fără apeluri de rețea.
import type { Camera, JournalEntry, Room, RoomRow, StatusItem, Tile } from '../model';

export interface HassState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
}
export interface AreaEntry {
  area_id: string;
  name: string;
}
export interface DeviceEntry {
  id: string;
  area_id: string | null;
  name_by_user?: string | null;
  name?: string | null;
}
export interface EntityEntry {
  entity_id: string;
  area_id: string | null;
  device_id: string | null;
  platform: string;
  hidden_by?: string | null;
  disabled_by?: string | null;
  entity_category?: string | null;
}
export interface LogbookEvent {
  when: number;
  name?: string;
  message?: string;
  entity_id?: string;
  state?: string;
}

export interface VenaOptions {
  assistant_name: string;
  user_name: string;
  background_pattern: 'hex' | 'grid' | 'dots' | 'none';
  background_strength: number;
  protected_entities: string[];
  read_only_entities: string[];
}

export interface Registry {
  areas: AreaEntry[];
  devices: Map<string, DeviceEntry>;
  entities: Map<string, EntityEntry>;
}

export const PROTECTED_DOMAINS = ['climate', 'lock', 'cover'];
const PRESENCE_CLASSES = ['occupancy', 'presence', 'motion'];
const TOGGLE_DOMAINS = ['switch', 'fan', 'input_boolean'];

const domainOf = (id: string) => id.slice(0, id.indexOf('.'));
const nameOf = (s: HassState) => String(s.attributes.friendly_name ?? s.entity_id);

/** Entitate pe care UI-ul nu o controlează niciodată: lista din opțiuni + porțile/garajele (cover). */
export function isReadOnly(s: HassState | undefined, id: string, opts: VenaOptions): boolean {
  if (opts.read_only_entities.includes(id)) return true;
  return domainOf(id) === 'cover' && ['gate', 'garage'].includes(s?.attributes.device_class);
}

export function isProtected(id: string, opts: VenaOptions): boolean {
  return PROTECTED_DOMAINS.includes(domainOf(id)) || opts.protected_entities.includes(id);
}

function areaOf(id: string, reg: Registry): string | null {
  const e = reg.entities.get(id);
  if (!e) return null;
  return e.area_id ?? (e.device_id ? (reg.devices.get(e.device_id)?.area_id ?? null) : null);
}

function visible(id: string, reg: Registry): boolean {
  const e = reg.entities.get(id);
  return !e || (!e.hidden_by && !e.disabled_by && !e.entity_category);
}

/** „Bucătărie Lumină plafon” → „Lumină plafon” când numele începe cu numele zonei. */
function shortName(name: string, area: string): string {
  if (name.toLowerCase().startsWith(area.toLowerCase() + ' ')) {
    const rest = name.slice(area.length + 1);
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return name;
}

const fmtTemp = (v: unknown) => (typeof v === 'number' ? `${Number.isInteger(v) ? v : v.toFixed(1)}°C` : '—');

export function buildRooms(states: Map<string, HassState>, reg: Registry, opts: VenaOptions): Room[] {
  const byArea = new Map<string, HassState[]>();
  for (const s of states.values()) {
    if (!visible(s.entity_id, reg)) continue;
    const a = areaOf(s.entity_id, reg);
    if (!a) continue;
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a)!.push(s);
  }
  const rooms: Room[] = [];
  for (const area of reg.areas) {
    const list = (byArea.get(area.area_id) ?? []).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ro'));
    const rows: RoomRow[] = [];
    const warnings: string[] = [];
    const unavailable = (s: HassState) => s.state === 'unavailable' || s.state === 'unknown';

    const lights = list.filter((s) => domainOf(s.entity_id) === 'light');
    const lightGroups: HassState[][] = [];
    // Luminile protejate rămân rânduri separate (cer confirmare); restul se grupează.
    const plain = lights.filter((s) => !isProtected(s.entity_id, opts));
    for (const s of lights.filter((s) => isProtected(s.entity_id, opts))) lightGroups.push([s]);
    if (plain.length) lightGroups.unshift(plain);
    for (const g of lightGroups) {
      const prot = g.length === 1 && isProtected(g[0].entity_id, opts);
      const label = g.length > 1 ? `Lumini (${g.length})` : shortName(nameOf(g[0]), area.name);
      rows.push({
        kind: 'toggle',
        id: g.map((s) => s.entity_id).join(','),
        label,
        on: g.some((s) => s.state === 'on'),
        entityIds: g.map((s) => s.entity_id),
        protected: prot,
        readOnly: g.every(unavailable) || g.some((s) => isReadOnly(s, s.entity_id, opts)),
      });
      if (prot) warnings.push(`⚠ ${label.toLowerCase()} protejat · comandă cu confirmare`);
    }
    for (const s of list.filter((s) => TOGGLE_DOMAINS.includes(domainOf(s.entity_id)))) {
      const prot = isProtected(s.entity_id, opts);
      const label = shortName(nameOf(s), area.name);
      rows.push({
        kind: 'toggle',
        id: s.entity_id,
        label,
        on: s.state === 'on',
        entityIds: [s.entity_id],
        protected: prot,
        readOnly: unavailable(s) || isReadOnly(s, s.entity_id, opts),
      });
      if (prot) warnings.push(`⚠ ${label.toLowerCase()} protejat · comandă cu confirmare`);
    }
    for (const s of list.filter((s) => domainOf(s.entity_id) === 'climate')) {
      const label = shortName(nameOf(s), area.name);
      const target = s.attributes.temperature;
      if (typeof target === 'number' && !isReadOnly(s, s.entity_id, opts) && !unavailable(s)) {
        rows.push({ kind: 'setpoint', id: s.entity_id, label: `${label} · ${fmtTemp(s.attributes.current_temperature)}`, value: fmtTemp(target), entityId: s.entity_id });
      } else {
        rows.push({ kind: 'value', id: s.entity_id, label, value: stateText(s) });
      }
    }
    for (const s of list.filter((s) => ['cover', 'lock'].includes(domainOf(s.entity_id)))) {
      rows.push({ kind: 'value', id: s.entity_id, label: shortName(nameOf(s), area.name), value: stateText(s) });
    }
    if (!rows.length) continue;

    const presence = list.filter((s) => domainOf(s.entity_id) === 'binary_sensor' && PRESENCE_CLASSES.includes(s.attributes.device_class));
    const anyProtected = rows.some((r) => (r.kind === 'toggle' && r.protected) || r.kind === 'setpoint' || (r.kind === 'value' && isProtected(r.id, opts)));
    rows.length && rooms.push({
      id: area.area_id,
      name: area.name,
      presence: presence.length ? (presence.some((s) => s.state === 'on') ? 'occupied' : 'free') : null,
      protectedBadge: !presence.length && anyProtected,
      rows,
      warnings: warnings.length ? warnings : undefined,
    });
  }
  return rooms;
}

/** Starea în română, scurt, pentru rânduri de tip valoare și tile-uri. */
export function stateText(s: HassState): string {
  const d = domainOf(s.entity_id);
  const st = s.state;
  if (st === 'unavailable') return 'INDISPONIBIL';
  if (st === 'unknown') return '—';
  if (d === 'cover') return ({ closed: 'Închisă', open: 'Deschisă', opening: 'Se deschide', closing: 'Se închide' } as Record<string, string>)[st] ?? st;
  if (d === 'lock') return ({ locked: 'Încuiată', unlocked: 'Descuiată', locking: 'Se încuie', unlocking: 'Se descuie', jammed: 'Blocată' } as Record<string, string>)[st] ?? st;
  if (d === 'climate')
    return ({ off: 'OPRIT', heat: 'ÎNCĂLZIRE', cool: 'RĂCIRE', heat_cool: 'AUTO', auto: 'AUTO', dry: 'DEZUMIDIFICARE', fan_only: 'VENTILAȚIE' } as Record<string, string>)[st] ?? st.toUpperCase();
  if (d === 'media_player') {
    const vol = typeof s.attributes.volume_level === 'number' ? ` · ${Math.round(s.attributes.volume_level * 100)}%` : '';
    if (st === 'playing') return `${s.attributes.source ?? s.attributes.media_title ?? 'Redă'}${vol}`;
    return (({ paused: 'Pauză', idle: 'Inactiv', off: 'Oprit', on: 'Pornit', standby: 'Standby' } as Record<string, string>)[st] ?? st) + (st === 'paused' ? vol : '');
  }
  if (st === 'on') return 'ON';
  if (st === 'off') return 'OFF';
  return st;
}

/** Tile-urile de sub cameră: entitățile read-only (poarta), apoi primul media player. */
export function buildTiles(states: Map<string, HassState>, reg: Registry, opts: VenaOptions): Tile[] {
  const tiles: Tile[] = [];
  const ro = new Set(opts.read_only_entities);
  for (const s of states.values()) if (visible(s.entity_id, reg) && isReadOnly(s, s.entity_id, opts)) ro.add(s.entity_id);
  for (const id of ro) {
    const s = states.get(id);
    if (s) tiles.push({ label: nameOf(s).toUpperCase(), value: stateText(s) });
  }
  const media = [...states.values()].filter((s) => domainOf(s.entity_id) === 'media_player' && visible(s.entity_id, reg));
  const player = media.find((s) => s.state === 'playing') ?? media[0];
  if (player) tiles.push({ label: nameOf(player).toUpperCase(), value: stateText(player) });
  return tiles.slice(0, 4);
}

export function pickCamera(states: Map<string, HassState>, reg: Registry): HassState | undefined {
  const cams = [...states.values()].filter((s) => domainOf(s.entity_id) === 'camera' && visible(s.entity_id, reg));
  return cams.find((s) => /curte|yard|gate|poart/i.test(s.entity_id + nameOf(s))) ?? cams[0];
}

export function buildCamera(cam: HassState | undefined, now: Date): Camera | null {
  if (!cam) return null;
  return {
    name: cam.entity_id.slice('camera.'.length).toUpperCase(),
    time: now.toLocaleTimeString('ro-RO', { hour12: false }),
    rec: cam.state === 'recording',
    streamUrl: cam.state === 'unavailable' ? undefined : `./camera/${cam.entity_id}`,
    signalLost: cam.state === 'unavailable',
  };
}

const hhmm = (d: Date) => d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false });

export function buildJournal(events: LogbookEvent[], states: Map<string, HassState>, opts: VenaOptions, now: number): JournalEntry[] {
  // Evenimentele de stare ale senzorilor (valori, timestamp-uri) sunt zgomot pentru jurnal.
  // Entitățile al căror „state” e un timestamp (conversation, button, scene…) la fel.
  const ISO = /^\d{4}-\d{2}-\d{2}T/;
  const useful = (e: LogbookEvent) =>
    !!e.message ||
    (!!e.entity_id &&
      !['sensor', 'camera', 'weather', 'sun', 'update', 'event', 'conversation', 'button', 'input_button', 'scene', 'stt', 'tts'].includes(domainOf(e.entity_id)) &&
      !ISO.test(e.state ?? ''));
  return events
    .filter(useful)
    .sort((a, b) => b.when - a.when)
    .slice(0, 8)
    .map((e, i) => {
      const s = e.entity_id ? states.get(e.entity_id) : undefined;
      // logbook/event_stream nu trimite numele pentru schimbările de stare; îl luăm din stări.
      const name = e.name ?? (s ? nameOf(s) : e.entity_id);
      const what = e.message ?? (e.state !== undefined && s ? stateText({ ...s, state: e.state }) : e.state ?? '');
      const important = (e.entity_id && isReadOnly(s, e.entity_id, opts)) || now - e.when * 1000 < 15 * 60_000;
      return {
        id: `${e.when}-${e.entity_id ?? ''}-${i}`,
        time: hhmm(new Date(e.when * 1000)),
        text: [name, what].filter(Boolean).join(' · '),
        tone: important ? ('accent' as const) : undefined,
      };
    });
}

const DAYS = ['DUM', 'LUN', 'MAR', 'MIE', 'JOI', 'VIN', 'SÂM'];

export function buildStatus(online: boolean, states: Map<string, HassState>, reg: Registry, now: Date): StatusItem[] {
  const items: StatusItem[] = [online ? { label: 'HA', value: 'ONLINE' } : { label: 'HA', value: 'DECONECTAT', danger: true }];
  const frigate = [...reg.entities.values()].filter((e) => e.platform === 'frigate');
  if (frigate.length) {
    const up = frigate.some((e) => domainOf(e.entity_id) === 'camera' && states.get(e.entity_id) && states.get(e.entity_id)!.state !== 'unavailable');
    items.push(up ? { label: 'FRIGATE', value: 'ACTIV' } : { label: 'FRIGATE', value: 'INACTIV', danger: true });
  }
  const backup = states.get('sensor.backup_last_successful_automatic_backup');
  if (backup && backup.state && !['unknown', 'unavailable'].includes(backup.state)) {
    const t = new Date(backup.state);
    const fresh = now.getTime() - t.getTime() < 48 * 3600_000;
    items.push({ label: `BACKUP ${hhmm(t)}`, value: fresh ? 'OK' : 'VECHI', danger: !fresh });
  }
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  items.push({ label: `${DAYS[now.getDay()]} ${dd}.${mm} · ${hhmm(now)}`, plain: true });
  return items;
}

export function greeting(now: Date, user: string): string {
  const h = now.getHours();
  const g = h < 11 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : 'Bună seara';
  return user ? `${g}, ${user}.` : `${g}.`;
}

export function summary(rooms: Room[], journal: JournalEntry[], events: LogbookEvent[], now: number): string {
  const latest = events.reduce<LogbookEvent | null>((m, e) => (!m || e.when > m.when ? e : m), null);
  if (latest && now - latest.when * 1000 < 60 * 60_000 && journal[0]) {
    const min = Math.max(1, Math.round((now - latest.when * 1000) / 60_000));
    return `${journal[0].text} · acum ${min} ${min === 1 ? 'minut' : 'minute'}.`;
  }
  const lightsOn = rooms.flatMap((r) => r.rows).filter((r) => r.kind === 'toggle' && r.on && r.entityIds[0].startsWith('light.')).reduce((n, r) => n + (r.kind === 'toggle' ? r.entityIds.length : 0), 0);
  const occupied = rooms.filter((r) => r.presence === 'occupied').length;
  const parts = [lightsOn ? `${lightsOn} ${lightsOn === 1 ? 'lumină aprinsă' : 'lumini aprinse'}` : 'Toate luminile stinse'];
  if (occupied) parts.push(`${occupied} ${occupied === 1 ? 'zonă ocupată' : 'zone ocupate'}`);
  return parts.join(' · ') + '.';
}

export function areaNameOf(id: string, reg: Registry): string | undefined {
  const a = areaOf(id, reg);
  return a ? reg.areas.find((x) => x.area_id === a)?.name : undefined;
}

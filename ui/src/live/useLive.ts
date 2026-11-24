// Ecranul live: conexiunea la HA (prin proxy), structura casei, stările, jurnalul,
// asistentul (text + voce) și confirmările. Produce același ScreenModel ca mock-ul.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConfirmRequest, Conversation, OrbState, Room, RoomRow, ScreenModel } from '../model';
import type { ScreenActions } from '../components/Screen';
import { AssistantEngine, type AssistantState } from './assistant';
import { HaConnection, type ConnState } from './connection';
import {
  areaNameOf,
  buildCamera,
  buildJournal,
  buildRooms,
  buildStatus,
  buildTiles,
  greeting,
  isProtected,
  isReadOnly,
  pickCamera,
  summary,
  type AreaEntry,
  type DeviceEntry,
  type EntityEntry,
  type HassState,
  type LogbookEvent,
  type Registry,
  type VenaOptions,
} from './home';

const DEFAULT_OPTIONS: VenaOptions = {
  assistant_name: 'Vena',
  user_name: '',
  background_pattern: 'hex',
  background_strength: 45,
  protected_entities: [],
  read_only_entities: [],
};
const EMPTY_REGISTRY: Registry = { areas: [], devices: new Map(), entities: new Map() };
/** Cât rămâne afișat ultimul răspuns sub orb (și camera evidențiată). */
const SHOW_REPLY_MS = 20_000;

interface PendingConfirm {
  req: ConfirmRequest;
  run: () => Promise<unknown>;
  /** Pentru termostat: valoarea curentă din dialog și cum se reconstruiește cererea. */
  adjust?: { value: number; min: number; max: number; build: (v: number) => PendingConfirm };
}

export function useLive(): { model: ScreenModel | null; actions: ScreenActions; onSpace: (down: boolean) => void } {
  const [opts, setOpts] = useState<VenaOptions>(DEFAULT_OPTIONS);
  const [conn, setConn] = useState<{ state: ConnState; retryAt: number | null }>({ state: 'connecting', retryAt: null });
  const [reg, setReg] = useState<Registry | null>(null);
  const [states, setStates] = useState<Map<string, HassState>>(new Map());
  const [events, setEvents] = useState<LogbookEvent[]>([]);
  const [asst, setAsst] = useState<AssistantState | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const connRef = useRef<HaConnection | null>(null);
  const engineRef = useRef<AssistantEngine | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Ceasul (bara de stare, ora camerei, numărătoarea până la reconectare).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Opțiunile add-on-ului (./config). Fără ele rămân valorile implicite.
  useEffect(() => {
    fetch('./config')
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setOpts({ ...DEFAULT_OPTIONS, ...o }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const loadRegistry = async (c: HaConnection) => {
      const [areas, devices, entities] = await Promise.all([
        c.send<AreaEntry[]>('config/area_registry/list'),
        c.send<DeviceEntry[]>('config/device_registry/list'),
        c.send<EntityEntry[]>('config/entity_registry/list'),
      ]);
      setReg({ areas, devices: new Map(devices.map((d) => [d.id, d])), entities: new Map(entities.map((e) => [e.entity_id, e])) });
    };

    const onReady = async () => {
      const c = connRef.current!;
      try {
        await loadRegistry(c);
        const cfg = await c.send<{ location_name?: string }>('get_config');
        setLocation(cfg.location_name ?? '');
        const list = await c.send<HassState[]>('get_states');
        setStates(new Map(list.map((s) => [s.entity_id, s])));
        setLastSeen(new Date());
        c.call('subscribe_events', { event_type: 'state_changed' }, (ev) => {
          const { entity_id, new_state } = ev.data;
          setStates((prev) => {
            const next = new Map(prev);
            if (new_state) next.set(entity_id, new_state);
            else next.delete(entity_id);
            return next;
          });
          setLastSeen(new Date());
        });
        let regTimer: ReturnType<typeof setTimeout> | undefined;
        for (const t of ['area_registry_updated', 'device_registry_updated', 'entity_registry_updated']) {
          c.call('subscribe_events', { event_type: t }, () => {
            clearTimeout(regTimer);
            regTimer = setTimeout(() => void loadRegistry(c).catch(() => {}), 500);
          });
        }
        setEvents([]);
        c.call('logbook/event_stream', { start_time: new Date(Date.now() - 12 * 3600_000).toISOString() }, (ev) => {
          const batch: LogbookEvent[] = ev.events ?? [];
          if (!batch.length) return;
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => `${e.when}|${e.entity_id}|${e.message}|${e.state}`));
            const add = batch.filter((e) => !seen.has(`${e.when}|${e.entity_id}|${e.message}|${e.state}`));
            return [...prev, ...add].sort((a, b) => b.when - a.when).slice(0, 40);
          });
        });
        await engineRef.current?.loadPipeline();
      } catch {
        /* conexiunea a căzut în timpul încărcării; onclose reîncearcă */
      }
    };

    const c = new HaConnection((cc) => setConn({ state: cc.state, retryAt: cc.retryAt }), () => void onReady());
    connRef.current = c;
    const engine = new AssistantEngine(c, setAsst);
    engineRef.current = engine;
    setAsst(engine.state);
    c.connect();
    return () => {
      engine.dispose();
      c.dispose();
    };
  }, []);

  // ---------- comenzi (doar la cererea explicită a utilizatorului) ----------
  const callService = useCallback(
    (domain: string, service: string, entityIds: string[], data: Record<string, unknown> = {}) => {
      // Gardă finală: niciun apel pe entitățile read-only (poarta), indiferent de UI.
      if (entityIds.some((id) => isReadOnly(states.get(id), id, optsRef.current))) return Promise.reject(new Error('read-only'));
      return connRef.current!.send('call_service', { domain, service, service_data: data, target: { entity_id: entityIds } });
    },
    [states],
  );

  const onToggle = useCallback(
    (room: Room, row: Extract<RoomRow, { kind: 'toggle' }>) => {
      if (row.readOnly) return;
      const service = row.on ? 'turn_off' : 'turn_on';
      const run = () => callService('homeassistant', service, row.entityIds);
      if (!row.protected && !row.entityIds.some((id) => isProtected(id, optsRef.current))) return void run().catch(() => {});
      setPending({
        req: {
          kicker: 'CONFIRMARE NECESARĂ · APARAT PROTEJAT',
          title: `${row.label} → ${row.on ? 'OFF' : 'ON'}`,
          body: `${row.on ? 'Sting' : 'Aprind'} „${row.label}” din ${room.name}? Acum e ${row.on ? 'aprins' : 'stins'}.`,
          note: 'Aparatul e protejat: fiecare comandă cere OK-ul tău.',
          confirmLabel: row.on ? 'Stinge' : 'Aprinde',
          cancelLabel: 'Anulează',
        },
        run,
      });
    },
    [callService],
  );

  const onSetpoint = useCallback(
    (_room: Room, row: Extract<RoomRow, { kind: 'setpoint' }>) => {
      const s = states.get(row.entityId);
      if (!s) return;
      const cur = s.attributes.current_temperature;
      const min = Number(s.attributes.min_temp ?? 7);
      const max = Number(s.attributes.max_temp ?? 35);
      const name = String(s.attributes.friendly_name ?? row.entityId);
      const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}°C`;
      const build = (v: number): PendingConfirm => ({
        req: {
          kicker: 'CONFIRMARE NECESARĂ · APARAT PROTEJAT',
          title: `${name} → ${fmt(v)}`,
          body: `Setez ${name.toLowerCase()} la ${fmt(v)}?${typeof cur === 'number' ? ` Acum e ${fmt(cur)}.` : ''}`,
          note: 'Climatizarea e protejată: fiecare comandă cere OK-ul tău.',
          confirmLabel: `Setează ${fmt(v)}`,
          cancelLabel: 'Anulează',
          adjust: fmt(v),
        },
        run: () => callService('climate', 'set_temperature', [row.entityId], { temperature: v }),
        adjust: { value: v, min, max, build },
      });
      setPending(build(Number(s.attributes.temperature)));
    },
    [states, callService],
  );

  const actions: ScreenActions = useMemo(
    () => ({
      onToggle,
      onSetpoint,
      onConfirm: () => {
        const p = pending;
        setPending(null);
        p?.run().catch(() => {});
      },
      onCancelConfirm: () => setPending(null),
      onAdjust: (d: number) =>
        setPending((p) => {
          if (!p?.adjust) return p;
          const v = Math.min(p.adjust.max, Math.max(p.adjust.min, Math.round((p.adjust.value + d) * 2) / 2));
          return p.adjust.build(v);
        }),
      onRetry: () => connRef.current?.retryNow(),
      onSubmitText: (t: string) => engineRef.current?.sendText(t),
      onMicDown: () => void engineRef.current?.micDown(),
      onMicUp: () => engineRef.current?.micUp(),
    }),
    [onToggle, onSetpoint, pending],
  );

  const onSpace = useCallback((down: boolean) => {
    if (down) void engineRef.current?.micDown();
    else engineRef.current?.micUp();
  }, []);

  // Offline: confirmările nu mai au sens (apelul n-ar ajunge la HA); ținem minte de când.
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  useEffect(() => {
    if (conn.state === 'offline') {
      setPending(null);
      setOfflineSince((d) => d ?? new Date());
    } else if (conn.state === 'online') setOfflineSince(null);
  }, [conn.state]);

  const model = useMemo<ScreenModel | null>(() => {
    if (!asst || (!reg && conn.state === 'connecting')) return null;
    const reg_ = reg ?? EMPTY_REGISTRY;
    const online = conn.state === 'online';
    const t = now.getTime();
    const name = opts.assistant_name.toUpperCase();
    const recent = asst.last && t - asst.last.at < SHOW_REPLY_MS ? asst.last : null;
    let rooms = buildRooms(states, reg_, opts);
    if (recent?.targets.length) {
      const hit = new Set(recent.targets.map((x) => areaNameOf(x.id, reg_)));
      rooms = rooms.map((r) => (hit.has(r.name) ? { ...r, highlight: true } : r));
    }
    let journal = buildJournal(events, states, opts, t);
    if (!online && offlineSince) {
      const hm = offlineSince.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false });
      journal = [{ id: 'offline', time: hm, text: 'Conexiunea cu Home Assistant s-a pierdut', tone: 'danger' as const }, ...journal];
    }

    let orb: OrbState = asst.phase === 'idle' ? 'idle' : asst.phase;
    let stateLabel = { idle: 'SISTEM PREGĂTIT', listening: `${name} ASCULTĂ`, processing: 'PROCESEZ…', responding: `${name} RĂSPUNDE` }[asst.phase];
    let conversation: Conversation;
    if (asst.phase === 'listening') conversation = { kind: 'listening', partial: '', hint: 'eliberează ca să trimiți' };
    else if (asst.phase === 'processing') conversation = { kind: 'processing', text: asst.heard || '…', hint: asst.pipelineHint };
    else if (recent) {
      const chip = recent.targets.length && !recent.error ? `${recent.targets.map((x) => x.name).join(', ').toUpperCase()} · ACUM` : undefined;
      // Cine a procesat cererea: comenzile locale din HA sau agentul (Haiku la Ionuț).
      let via: string | undefined;
      if (recent.processedLocally === true) via = 'local';
      else if (recent.processedLocally === false) {
        const agent = recent.agentId ? String(states.get(recent.agentId)?.attributes.friendly_name ?? recent.agentId) : 'agent';
        via = /haiku/i.test(agent) ? 'Haiku' : agent;
      }
      conversation = { kind: 'responding', you: recent.you || '—', answer: recent.answer || '(fără răspuns)', chip, via };
    } else conversation = { kind: 'greeting', title: greeting(now, opts.user_name), summary: summary(rooms, journal, events, t) };

    if (pending) {
      orb = 'confirm';
      stateLabel = 'AȘTEPT CONFIRMAREA TA';
      conversation = { kind: 'none' };
    }
    if (!online) {
      orb = 'offline';
      stateLabel = 'CONEXIUNE PIERDUTĂ';
      const secs = conn.retryAt ? Math.max(0, Math.ceil((conn.retryAt - t) / 1000)) : 0;
      const seen = lastSeen ? lastSeen.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
      conversation = {
        kind: 'offline',
        title: 'Nu ajung la Home Assistant.',
        detail: conn.state === 'connecting' ? `Arăt ultima stare cunoscută (${seen}). Mă reconectez…` : `Arăt ultima stare cunoscută (${seen}). Reîncerc automat în ${secs} s.`,
        retryLabel: 'REÎNCEARCĂ ACUM',
      };
    }
    const camera = buildCamera(pickCamera(states, reg_), now);
    return {
      location: (location || 'ACASĂ').toUpperCase(),
      connection: online ? 'online' : 'offline',
      status: buildStatus(online, states, reg_, now),
      orb,
      stateLabel,
      conversation,
      micActive: asst.micActive,
      micOpen: asst.micOpen,
      micMessage: asst.micMessage ?? undefined,
      confirm: pending?.req,
      rooms,
      camera: camera && !online ? { ...camera, signalLost: true, streamUrl: undefined } : camera,
      tiles: buildTiles(states, reg_, opts),
      journal,
      background: { pattern: opts.background_pattern, strength: opts.background_strength },
    };
  }, [reg, asst, conn, now, states, events, opts, pending, lastSeen, location, offlineSince]);

  return { model, actions, onSpace };
}

// Date mock identice cu design/static/*.html, pentru ruta /preview?state=<stare>.
import type { Room, ScreenModel } from '../model';

export type PreviewState = 'pregatit' | 'asculta' | 'proceseaza' | 'raspunde' | 'confirmare' | 'offline';

const base: ScreenModel = {
  location: 'ATELIER PRINTBOX',
  connection: 'online',
  status: [
    { label: 'HA', value: 'ONLINE' },
    { label: 'FRIGATE', value: 'ACTIV' },
    { label: 'BACKUP 03:00', value: 'OK' },
    { label: 'MAR 24.11 · 17:32', plain: true },
  ],
  orb: 'idle',
  stateLabel: 'SISTEM PREGĂTIT',
  conversation: {
    kind: 'greeting',
    title: 'Bună seara, Ionuț.',
    summary: 'Curierul GLS a venit acum 4 minute. Poarta e închisă.',
  },
  micActive: false,
  rooms: [
    {
      id: 'birou',
      name: 'Birou',
      presence: 'occupied',
      rows: [{ kind: 'toggle', id: 'birou-plafon', label: 'Lumină plafon', on: true, entityIds: ['light.birou_plafon'], protected: true }],
      warnings: ['⚠ releu sensibil · stingere cu confirmare'],
    },
    {
      id: 'atelier',
      name: 'Atelier',
      presence: 'occupied',
      rows: [{ kind: 'toggle', id: 'atelier-lumini', label: 'Lumini (3)', on: true, entityIds: ['light.a1', 'light.a2', 'light.a3'] }],
    },
    {
      id: 'depozit',
      name: 'Depozit',
      presence: 'free',
      rows: [{ kind: 'toggle', id: 'depozit-lumini', label: 'Lumini (2)', on: false, entityIds: ['light.d1', 'light.d2'] }],
    },
    {
      id: 'clima',
      name: 'Climă',
      presence: null,
      protectedBadge: true,
      rows: [
        { kind: 'setpoint', id: 'termostat', label: 'Termostat · 21.5°C', value: '23°C', entityId: 'climate.termostat' },
        { kind: 'value', id: 'ac', label: 'Aer condiționat', value: 'OPRIT' },
      ],
    },
  ],
  camera: {
    name: 'CAM_CURTE',
    time: '17:28:04',
    rec: true,
    detection: { label: 'VEHICUL · GLS', left: '38%', top: '34%', width: '34%', height: '42%' },
  },
  tiles: [
    { label: 'POARTA', value: 'Închisă' },
    { label: 'BOXE', value: 'Radio · 30%' },
  ],
  journal: [
    { id: 'j1', time: '17:28', text: 'Curierul GLS a venit · anunțat pe boxe', tone: 'accent' },
    { id: 'j2', time: '17:26', text: 'Poarta s-a deschis' },
    { id: 'j3', time: '16:02', text: 'Depozit · lumini stinse, fără prezență' },
    { id: 'j4', time: '03:00', text: 'Backup de noapte reușit' },
  ],
  background: { pattern: 'hex', strength: 45 },
};

const COMMAND = 'aprinde lumina în depozit';

function setDepozit(rooms: Room[], on: boolean): Room[] {
  return rooms.map((r) =>
    r.id === 'depozit'
      ? { ...r, highlight: true, rows: r.rows.map((row) => (row.kind === 'toggle' ? { ...row, on } : row)) }
      : r,
  );
}

export function mockScreen(state: PreviewState): ScreenModel {
  switch (state) {
    case 'pregatit':
      return base;
    case 'asculta':
      return {
        ...base,
        orb: 'listening',
        stateLabel: 'VENA ASCULTĂ',
        micActive: true,
        conversation: { kind: 'listening', partial: COMMAND, hint: 'eliberează Space ca să trimiți' },
      };
    case 'proceseaza':
      return {
        ...base,
        orb: 'processing',
        stateLabel: 'PROCESEZ…',
        conversation: { kind: 'processing', text: COMMAND, hint: 'comenzi locale → Haiku' },
      };
    case 'raspunde':
      return {
        ...base,
        orb: 'responding',
        stateLabel: 'VENA RĂSPUNDE',
        conversation: { kind: 'responding', you: COMMAND, answer: 'Am aprins lumina în depozit.', chip: 'DEPOZIT · LUMINI ON · ACUM' },
        rooms: setDepozit(base.rooms, true),
        journal: [{ id: 'j5', time: '17:32', text: 'Depozit · lumini aprinse de Vena', tone: 'accent' }, ...base.journal],
      };
    case 'confirmare':
      return {
        ...base,
        orb: 'confirm',
        stateLabel: 'AȘTEPT CONFIRMAREA TA',
        conversation: { kind: 'none' },
        confirm: {
          kicker: 'CONFIRMARE NECESARĂ · APARAT PROTEJAT',
          title: 'Termostat → 23°C',
          body: 'Setez termostatul la 23°C? Acum e 21.5°C.',
          note: 'Termostatul și AC-ul sunt protejate: fiecare comandă cere OK-ul tău.',
          confirmLabel: 'Setează 23°C',
          cancelLabel: 'Anulează',
        },
      };
    case 'offline':
      return {
        ...base,
        connection: 'offline',
        status: base.status.map((st) => (st.label === 'HA' ? { ...st, value: 'DECONECTAT', danger: true } : st)),
        orb: 'offline',
        stateLabel: 'CONEXIUNE PIERDUTĂ',
        conversation: {
          kind: 'offline',
          title: 'Nu ajung la Home Assistant.',
          detail: 'Arăt ultima stare cunoscută (17:31). Reîncerc automat în 8 s.',
          retryLabel: 'REÎNCEARCĂ ACUM',
        },
        camera: { ...base.camera, signalLost: true },
        journal: [{ id: 'j0', time: '17:31', text: 'Conexiunea cu Home Assistant s-a pierdut', tone: 'danger' }, ...base.journal],
      };
  }
}

export const PREVIEW_STATES: PreviewState[] = ['pregatit', 'asculta', 'proceseaza', 'raspunde', 'confirmare', 'offline'];

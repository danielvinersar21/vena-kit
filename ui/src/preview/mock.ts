// Date mock identice cu design/static/*.html, pentru ruta /preview?state=<stare>.
import type { ScreenModel } from '../model';

export type PreviewState = 'pregatit' | 'asculta' | 'proceseaza' | 'raspunde' | 'confirmare' | 'offline';

const base: ScreenModel = {
  location: 'ATELIER PRINTBOX',
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
    { id: 'j1', time: '17:28', text: 'Curierul GLS a venit · anunțat pe boxe', highlight: true },
    { id: 'j2', time: '17:26', text: 'Poarta s-a deschis' },
    { id: 'j3', time: '16:02', text: 'Depozit · lumini stinse, fără prezență' },
    { id: 'j4', time: '03:00', text: 'Backup de noapte reușit' },
  ],
  background: { pattern: 'hex', strength: 45 },
};

export function mockScreen(state: PreviewState): ScreenModel {
  switch (state) {
    case 'pregatit':
      return base;
    default:
      // Celelalte stări se adaugă după validarea stării „pregătit”.
      return base;
  }
}

export const PREVIEW_STATES: PreviewState[] = ['pregatit', 'asculta', 'proceseaza', 'raspunde', 'confirmare', 'offline'];

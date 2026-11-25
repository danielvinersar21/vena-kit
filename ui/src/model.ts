// View-model-ul ecranului: tot ce afișează UI-ul, independent de sursă
// (date mock pentru /preview sau date live din HA).

export type OrbState = 'idle' | 'listening' | 'processing' | 'responding' | 'confirm' | 'offline';

export type Presence = 'occupied' | 'free' | null;

export type RoomRow =
  | { kind: 'toggle'; id: string; label: string; on: boolean; entityIds: string[]; protected?: boolean; readOnly?: boolean }
  | { kind: 'setpoint'; id: string; label: string; value: string; entityId: string }
  | { kind: 'value'; id: string; label: string; value: string };

export interface Room {
  id: string;
  name: string;
  presence: Presence;
  /** Zonă cu aparate protejate (ex. Climă): eticheta PROTEJAT în loc de prezență. */
  protectedBadge?: boolean;
  rows: RoomRow[];
  /** Note de avertizare (releu sensibil etc.), afișate cu culoarea warning. */
  warnings?: string[];
  /** Evidențiată după o comandă (stare „răspunde”). */
  highlight?: boolean;
}

export interface StatusItem {
  label: string;
  value?: string;
  /** Fără valoare: textul e afișat întreg cu culoarea text (ex. ceasul). */
  plain?: boolean;
  /** Valoare în culoarea de eroare (ex. HA DECONECTAT). */
  danger?: boolean;
}

export interface Camera {
  name: string;
  time: string;
  rec: boolean;
  detection?: { label: string; left: string; top: string; width: string; height: string };
  /** URL relativ al unei imagini (./camera/<entity_id>), reîmprospătată periodic; lipsă în mock. */
  streamUrl?: string;
  /** Fără semnal (offline): fără scan, detecție și REC; afișează „SEMNAL PIERDUT”. */
  signalLost?: boolean;
}

export interface Tile {
  label: string;
  value: string;
}

export interface JournalEntry {
  id: string;
  time: string;
  text: string;
  /** Ora colorată: accent (eveniment recent) sau danger (eroare). */
  tone?: 'accent' | 'danger';
}

export type Conversation =
  | { kind: 'greeting'; title: string; summary: string }
  | { kind: 'listening'; partial: string; hint: string }
  | { kind: 'processing'; text: string; hint: string }
  | { kind: 'responding'; you: string; answer: string; chip?: string; /** Cine a procesat cererea: „local” sau agentul (ex. „Haiku”). */ via?: string }
  | { kind: 'offline'; title: string; detail: string; retryLabel: string }
  /** Nimic sub orb (ex. cât e deschis ecranul de confirmare). */
  | { kind: 'none' };

/** Ecranul de confirmare pentru aparatele protejate (05-confirmare). */
export interface ConfirmRequest {
  kicker: string;
  title: string;
  body: string;
  note: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Valoare reglabilă (termostat): afișează −/+ în dialog. */
  adjust?: string;
}

export interface ScreenModel {
  location: string;
  /** offline: logo roșu, camerele estompate, camera fără semnal. */
  connection: 'online' | 'offline';
  status: StatusItem[];
  orb: OrbState;
  stateLabel: string;
  conversation: Conversation;
  micActive: boolean;
  /** Microfonul e deschis (stream activ): indicator vizibil în header. */
  micOpen?: boolean;
  /** Motivul pentru care microfonul nu merge (chatul text rămâne). */
  micMessage?: { text: string; fullscreen: boolean };
  confirm?: ConfirmRequest;
  rooms: Room[];
  camera: Camera | null;
  tiles: Tile[];
  journal: JournalEntry[];
  background: { pattern: 'hex' | 'grid' | 'dots' | 'none'; strength: number };
}

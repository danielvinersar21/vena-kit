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
}

export interface Camera {
  name: string;
  time: string;
  rec: boolean;
  detection?: { label: string; left: string; top: string; width: string; height: string };
  /** URL MJPEG relativ (./camera/<entity_id>); lipsă în mock. */
  streamUrl?: string;
}

export interface Tile {
  label: string;
  value: string;
}

export interface JournalEntry {
  id: string;
  time: string;
  text: string;
  highlight?: boolean;
}

export type Conversation =
  | { kind: 'greeting'; title: string; summary: string }
  | { kind: 'listening'; partial: string; hint: string }
  | { kind: 'processing'; text: string; hint: string }
  | { kind: 'responding'; you: string; answer: string; chip?: string };

export interface ScreenModel {
  location: string;
  status: StatusItem[];
  orb: OrbState;
  stateLabel: string;
  conversation: Conversation;
  micActive: boolean;
  rooms: Room[];
  camera: Camera;
  tiles: Tile[];
  journal: JournalEntry[];
  background: { pattern: 'hex' | 'grid' | 'dots' | 'none'; strength: number };
}

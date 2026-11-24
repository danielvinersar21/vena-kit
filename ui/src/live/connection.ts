// Client WebSocket subțire peste proxy-ul serverului Vena (./ws). Tokenul real e pe server:
// proxy-ul acceptă orice `auth` de la browser și răspunde cu `auth_ok`-ul primit de la HA.
// Reconectare automată cu backoff (1, 2, 4, 8, 15, 30 s).

export type ConnState = 'connecting' | 'online' | 'offline';
type EventFn = (ev: any) => void;

export interface HaError {
  code?: string;
  message?: string;
}

const BACKOFF_S = [1, 2, 4, 8, 15, 30];

export class HaConnection {
  state: ConnState = 'connecting';
  /** Momentul (ms) următoarei reîncercări, cât timp e offline. */
  retryAt: number | null = null;
  haVersion = '';
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: any) => void; reject: (e: HaError) => void }>();
  private listeners = new Map<number, EventFn>();
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    private onStateChange: (c: HaConnection) => void,
    private onReady: () => void,
  ) {}

  connect() {
    clearTimeout(this.retryTimer);
    this.retryAt = null;
    const url = new URL('./ws', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      const msg = JSON.parse(e.data);
      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: 'vena-proxy' }));
      } else if (msg.type === 'auth_ok') {
        this.attempt = 0;
        this.haVersion = msg.ha_version ?? '';
        this.setState('online');
        this.onReady();
      } else if (msg.type === 'auth_invalid') {
        ws.close();
      } else if (msg.type === 'result') {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.success) p.resolve(msg.result);
          else p.reject(msg.error ?? {});
        }
      } else if (msg.type === 'event') {
        this.listeners.get(msg.id)?.(msg.event);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      for (const p of this.pending.values()) p.reject({ code: 'disconnected', message: 'deconectat' });
      this.pending.clear();
      this.listeners.clear();
      if (this.closed) return;
      const delay = BACKOFF_S[Math.min(this.attempt++, BACKOFF_S.length - 1)] * 1000;
      this.retryAt = Date.now() + delay;
      this.retryTimer = setTimeout(() => this.connect(), delay);
      this.setState('offline');
    };
  }

  retryNow() {
    if (this.state === 'online' || this.ws) return;
    this.attempt = 0;
    this.setState('connecting');
    this.connect();
  }

  dispose() {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  /** Trimite o comandă; `onEvent` primește evenimentele cu același id (subscripții, pipeline). */
  call<T = any>(type: string, payload: Record<string, unknown> = {}, onEvent?: EventFn): { id: number; promise: Promise<T> } {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.state !== 'online') {
        return reject({ code: 'disconnected', message: 'deconectat' });
      }
      this.pending.set(id, { resolve, reject });
      if (onEvent) this.listeners.set(id, onEvent);
      this.ws.send(JSON.stringify({ id, type, ...payload }));
    });
    return { id, promise };
  }

  send<T = any>(type: string, payload?: Record<string, unknown>): Promise<T> {
    return this.call<T>(type, payload).promise;
  }

  sendBinary(bytes: Uint8Array<ArrayBuffer>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(bytes);
  }

  private setState(s: ConnState) {
    this.state = s;
    this.onStateChange(this);
  }
}

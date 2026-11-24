// Chat text și voce prin pipeline-ul Assist al lui Ionuț (assist_pipeline/run), portat din spike.
//
// Politica microfonului (confidențialitate, în atelier sunt angajați):
// - se deschide DOAR la o apăsare și nu se redeschide singur;
// - rămâne deschis cât tab-ul e vizibil și are focus, max 30 s după ultima eliberare
//   (deschiderea durează 0,5–1 s și ar tăia începutul comenzii următoare);
// - pre-roll: buffer circular LOCAL de ~500 ms, trimis doar la apăsare. Fără apăsare
//   nu pleacă niciun byte din browser;
// - cât e deschis, UI-ul arată un indicator (micOpen).
import type { HaConnection, HaError } from './connection';

export type Phase = 'idle' | 'listening' | 'processing' | 'responding';

export interface Exchange {
  you: string;
  answer: string;
  /** Entitățile atinse de comandă (din intent-end), pentru evidențiere și chip. */
  targets: { id: string; name: string }[];
  error?: boolean;
  /** Din intent-end: true = comenzile locale din HA; false = agentul de conversație. Lipsă la HA vechi. */
  processedLocally?: boolean;
  /** Numele agentului de conversație din pipeline, așa cum îl întoarce HA (conversation/agent/list). */
  agentName?: string;
  at: number;
}

export interface AssistantState {
  phase: Phase;
  /** Textul comenzii curente (STT sau tastat), cât timp e în lucru. */
  heard: string;
  last: Exchange | null;
  micOpen: boolean;
  micActive: boolean;
  micMessage: { text: string; fullscreen: boolean } | null;
  pipelineHint: string;
}

interface Pipeline {
  id: string;
  name: string;
  tts_engine?: string | null;
  conversation_engine?: string;
}

const PREROLL_CHUNKS = 5; // 5 × 100 ms
const MIC_IDLE_CLOSE_MS = 30_000;
const MAX_HOLD_MS = 30_000; // tasta blocată nu ține microfonul la nesfârșit

export function ttsSrc(url: string): string {
  // tts_output.url e relativ la HA (/api/tts_proxy/<fișier>); trece prin serverul Vena.
  const m = String(url).match(/\/api\/tts_proxy\/([^/?#]+)/);
  return m ? `./tts/${m[1]}` : url;
}

export class AssistantEngine {
  state: AssistantState = { phase: 'idle', heard: '', last: null, micOpen: false, micActive: false, micMessage: null, pipelineHint: '' };
  private pipeline: Pipeline | undefined;
  private conversationId: string | null = null;
  private agentName: string | undefined;
  private audio = new Audio();
  private runEnded = true;
  // voce
  private audioCtx: AudioContext | null = null;
  private workletReady: Promise<void> | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private micOpening: Promise<void> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private pressed = false;
  private recording = false;
  private stopping = false;
  private handlerId: number | null = null;
  private preBuffer: ArrayBuffer[] = [];
  private preroll: ArrayBuffer[] = [];
  private endPending = false;
  private noVadSupported = true;
  private readonly inIframe = window.self !== window.top;
  private cleanup: (() => void)[] = [];

  constructor(
    private conn: HaConnection,
    private emit: (s: AssistantState) => void,
  ) {
    const onHidden = () => document.hidden && this.closeMic(true);
    const onBlur = () => this.closeMic(true);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onBlur);
    this.audio.onended = () => this.maybeIdle();
    this.audio.onerror = () => this.maybeIdle();
    this.cleanup.push(() => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onBlur);
    });
  }

  dispose() {
    this.cleanup.forEach((f) => f());
    this.closeMic(true);
    this.audio.pause();
    void this.audioCtx?.close();
  }

  async loadPipeline() {
    try {
      const res = await this.conn.send<{ pipelines: Pipeline[]; preferred_pipeline: string }>('assist_pipeline/pipeline/list');
      this.pipeline = res.pipelines.find((p) => p.id === res.preferred_pipeline) ?? res.pipelines[0];
      this.set({ pipelineHint: this.pipeline ? `pipeline ${this.pipeline.name}` : '' });
      const agents = await this.conn.send<{ agents: { id: string; name?: string }[] }>('conversation/agent/list').catch(() => null);
      const name = agents?.agents.find((a) => a.id === this.pipeline?.conversation_engine)?.name;
      this.agentName = name?.trim() || undefined;
    } catch {
      this.pipeline = undefined;
    }
  }

  private set(patch: Partial<AssistantState>) {
    this.state = { ...this.state, ...patch };
    this.emit(this.state);
  }

  // ---------- pipeline (comun text/voce) ----------
  private run(startStage: 'intent' | 'stt', input: Record<string, unknown>, onEvent?: (ev: any) => void, onRejected?: (e: HaError) => boolean) {
    const endStage = this.pipeline?.tts_engine ? 'tts' : 'intent';
    this.runEnded = false;
    const { promise } = this.conn.call(
      'assist_pipeline/run',
      { start_stage: startStage, end_stage: endStage, input, pipeline: this.pipeline?.id, conversation_id: this.conversationId },
      (ev) => {
        const d = ev.data ?? {};
        onEvent?.(ev);
        switch (ev.type) {
          case 'stt-end':
            this.set({ heard: d.stt_output?.text ?? '' });
            break;
          case 'intent-start':
            this.set({ phase: 'processing' });
            break;
          case 'intent-end': {
            const out = d.intent_output ?? {};
            this.conversationId = out.conversation_id ?? this.conversationId;
            const resp = out.response ?? {};
            const targets = (resp.data?.success ?? []).filter((t: any) => t.type === 'entity').map((t: any) => ({ id: t.id, name: t.name }));
            this.set({
              phase: 'responding',
              last: {
                you: this.state.heard,
                answer: resp.speech?.plain?.speech ?? '',
                targets,
                error: resp.response_type === 'error',
                processedLocally: typeof d.processed_locally === 'boolean' ? d.processed_locally : undefined,
                agentName: this.agentName,
                at: Date.now(),
              },
            });
            break;
          }
          case 'tts-end':
            if (d.tts_output?.url) {
              this.audio.src = ttsSrc(d.tts_output.url);
              this.audio.play().catch(() => this.maybeIdle());
            }
            break;
          case 'error':
            this.fail(d.code === 'stt-no-text-recognized' ? 'N-am auzit nimic. Ține apăsat cât vorbești.' : `N-am reușit: ${d.message ?? d.code}`);
            break;
          case 'run-end':
            this.runEnded = true;
            this.maybeIdle();
            break;
        }
      },
    );
    promise.catch((e: HaError) => {
      if (onRejected?.(e)) {
        const { no_vad: _drop, ...rest } = input;
        return this.run(startStage, rest, onEvent, onRejected);
      }
      this.runEnded = true;
      this.fail(e.code === 'disconnected' ? 'Nu sunt conectată la Home Assistant.' : `N-am reușit: ${e.message ?? e.code}`);
    });
  }

  private fail(msg: string) {
    this.stopVoice();
    this.set({ phase: 'idle', last: { you: this.state.heard, answer: msg, targets: [], error: true, at: Date.now() } });
  }

  /** Orb-ul revine la idle după run-end și după ce s-a terminat audio-ul. */
  private maybeIdle() {
    if (this.runEnded && (this.audio.paused || this.audio.ended) && this.state.phase !== 'listening') this.set({ phase: 'idle', heard: '' });
  }

  sendText(text: string) {
    this.audio.pause();
    this.set({ phase: 'processing', heard: text });
    this.run('intent', { text });
  }

  // ---------- voce ----------
  private sendChunk(buf: ArrayBuffer) {
    const pcm = new Uint8Array(buf);
    const msg = new Uint8Array(pcm.length + 1);
    msg[0] = this.handlerId!;
    msg.set(pcm, 1);
    this.conn.sendBinary(msg);
  }

  private onPcm(buf: ArrayBuffer) {
    if (!this.recording) {
      this.preroll.push(buf);
      if (this.preroll.length > PREROLL_CHUNKS) this.preroll.shift();
      return;
    }
    if (this.handlerId === null) this.preBuffer.push(buf);
    else this.sendChunk(buf);
  }

  private async openMic() {
    if (this.micStream) return;
    if (this.micOpening) return this.micOpening;
    this.micOpening = (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
      }
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
        this.workletReady = this.audioCtx.audioWorklet.addModule(new URL('./pcm-worklet.js', location.href).href);
      }
      await this.workletReady;
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.micStream = stream;
      this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-encoder');
      this.workletNode.port.onmessage = (e) => this.onPcm(e.data);
      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.sourceNode.connect(this.workletNode);
      this.set({ micOpen: true });
    })();
    try {
      await this.micOpening;
    } finally {
      this.micOpening = null;
    }
  }

  private closeMic(force = false) {
    clearTimeout(this.idleTimer);
    if (!this.micStream) return;
    if (this.recording) {
      if (!force) return;
      this.stopVoice();
      setTimeout(() => this.closeMic(true), 80);
      return;
    }
    this.sourceNode?.disconnect();
    this.workletNode?.disconnect();
    this.micStream.getTracks().forEach((t) => t.stop());
    this.micStream = this.sourceNode = this.workletNode = null;
    this.preroll = [];
    this.set({ micOpen: false });
  }

  async micDown() {
    if (this.recording || this.pressed) return;
    this.pressed = true;
    clearTimeout(this.idleTimer);
    this.audio.pause();
    this.handlerId = null;
    this.endPending = false;
    const warm = Boolean(this.micStream);
    this.set({ micActive: true, micMessage: null, phase: 'listening', heard: '' });
    try {
      await this.openMic();
    } catch (err) {
      this.pressed = false;
      this.set({ micActive: false, phase: 'idle' });
      return this.micError(err as Error);
    }
    if (!this.pressed || !document.hasFocus()) {
      // eliberat (sau focus pierdut) înainte să se deschidă microfonul
      this.set({ micActive: false, phase: 'idle' });
      this.idleTimer = setTimeout(() => this.closeMic(), MIC_IDLE_CLOSE_MS);
      return;
    }
    this.recording = true;
    this.holdTimer = setTimeout(() => this.micUp(), MAX_HOLD_MS);
    this.preBuffer = warm ? this.preroll.splice(0) : [];

    // Push-to-talk: sfârșitul îl dă eliberarea, nu VAD-ul din HA. `no_vad` e documentat doar
    // pentru wake_word, dar HA îl aplică și la stt (2026.9.3, 2026.11.3); dacă e respins, renunțăm.
    this.run(
      'stt',
      { sample_rate: 16000, ...(this.noVadSupported ? { no_vad: true } : {}) },
      (ev) => {
        if (ev.type === 'run-start') {
          this.handlerId = ev.data.runner_data.stt_binary_handler_id;
          for (const b of this.preBuffer.splice(0)) this.sendChunk(b);
          if (this.endPending) this.sendEnd();
        }
        if (ev.type === 'stt-end') this.stopVoice();
      },
      (e) => {
        if (this.noVadSupported && e?.code === 'invalid_format') {
          this.noVadSupported = false;
          return true;
        }
        return false;
      },
    );
  }

  micUp() {
    this.pressed = false;
    this.stopVoice();
  }

  private sendEnd() {
    this.conn.sendBinary(new Uint8Array([this.handlerId!]));
  }

  private stopVoice() {
    if (this.state.micActive) this.set({ micActive: false });
    if (!this.recording || this.stopping) return;
    this.stopping = true;
    clearTimeout(this.holdTimer);
    // Golește ultimul chunk parțial, apoi trimite marcajul de sfârșit.
    this.workletNode?.port.postMessage('flush');
    setTimeout(() => {
      this.recording = false;
      this.stopping = false;
      if (this.handlerId === null) this.endPending = true;
      else this.sendEnd();
      if (this.state.phase === 'listening') this.set({ phase: 'processing' });
      this.idleTimer = setTimeout(() => this.closeMic(), MIC_IDLE_CLOSE_MS);
    }, 50);
  }

  private micError(err: Error) {
    let text = 'Microfonul nu e disponibil. Chatul text funcționează.';
    if (err.name === 'InsecureContext') text = 'Microfonul merge doar pe HTTPS. Chatul text funcționează.';
    else if (err.name === 'NotAllowedError') text = 'Accesul la microfon e blocat. Chatul text funcționează.';
    else if (err.name === 'NotFoundError') text = 'Nu găsesc niciun microfon. Chatul text funcționează.';
    this.set({ micMessage: { text, fullscreen: err.name === 'NotAllowedError' && this.inIframe } });
  }
}

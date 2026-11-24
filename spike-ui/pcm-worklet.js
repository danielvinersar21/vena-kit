// AudioWorklet: mono float (rata contextului, de obicei 48 kHz) -> PCM16 LE, 16 kHz.
// Resample prin mediere pe ferestre (filtru box, anti-aliasing simplu pentru voce).
const TARGET_RATE = 16000;
const CHUNK = 1600; // 100 ms la 16 kHz

class PcmEncoder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE; // sampleRate e global în AudioWorkletGlobalScope
    this.acc = 0;
    this.count = 0;
    this.t = 0;
    this.out = new Int16Array(CHUNK);
    this.n = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'flush') this.flush();
    };
  }

  push(v) {
    const s = Math.max(-1, Math.min(1, v));
    this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.n === CHUNK) this.flush();
  }

  flush() {
    if (this.n === 0) return;
    const buf = this.out.slice(0, this.n).buffer;
    this.port.postMessage(buf, [buf]);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0];
    if (!ch || ch.length === 0) return true;
    const nch = ch.length;
    const len = ch[0].length;
    for (let i = 0; i < len; i++) {
      let v = 0;
      for (let c = 0; c < nch; c++) v += ch[c][i];
      this.acc += v / nch;
      this.count++;
      this.t += 1;
      if (this.t >= this.ratio) {
        this.t -= this.ratio;
        this.push(this.acc / this.count);
        this.acc = 0;
        this.count = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-encoder', PcmEncoder);

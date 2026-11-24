// Vena spike: client WS subțire peste proxy-ul serverului (./ws).
const $ = (id) => document.getElementById(id);
const logEl = $('log');
function log(...parts) {
  const line = `${new Date().toLocaleTimeString()}  ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
  logEl.textContent = line + logEl.textContent.slice(0, 20000);
}
function setStatus(text, cls) {
  $('status').textContent = text;
  $('status').className = cls || '';
}

// ---------- conexiune ----------
let ws;
let nextId = 1;
const pending = new Map(); // id -> {resolve, reject}
const listeners = new Map(); // id -> fn(eventMsg)

function connect() {
  const url = new URL('./ws', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return log('frame binar primit', e.data.byteLength);
    const msg = JSON.parse(e.data);
    if (msg.type === 'auth_required') {
      // Proxy-ul acceptă orice token; cel real e pe server.
      ws.send(JSON.stringify({ type: 'auth', access_token: 'vena-proxy' }));
    } else if (msg.type === 'auth_ok') {
      setStatus(`conectat (HA ${msg.ha_version})`, 'ok');
      onReady();
    } else if (msg.type === 'result') {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        msg.success ? p.resolve(msg.result) : p.reject(msg.error);
      }
    } else if (msg.type === 'event') {
      listeners.get(msg.id)?.(msg.event);
    }
  };
  ws.onclose = (e) => {
    setStatus(`deconectat (${e.code}), reîncerc în 3 s`, 'err');
    for (const p of pending.values()) p.reject({ message: 'deconectat' });
    pending.clear();
    listeners.clear();
    setTimeout(connect, 3000);
  };
}

function call(type, payload = {}, onEvent) {
  const id = nextId++;
  if (onEvent) listeners.set(id, onEvent);
  ws.send(JSON.stringify({ id, type, ...payload }));
  const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  return { id, promise };
}
const send = (type, payload) => call(type, payload).promise;

// ---------- lumini ----------
const lights = new Map();
function renderLights() {
  const box = $('lights');
  box.textContent = '';
  if (!lights.size) return (box.textContent = 'nicio lumină găsită');
  for (const st of lights.values()) {
    const on = st.state === 'on';
    const row = document.createElement('div');
    row.className = 'row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'ON' : 'OFF';
    btn.disabled = st.state === 'unavailable';
    btn.onclick = () =>
      send('call_service', { domain: 'light', service: 'toggle', target: { entity_id: st.entity_id } })
        .then(() => log('call_service light.toggle', st.entity_id))
        .catch((e) => log('EROARE call_service', e));
    const label = document.createElement('span');
    label.textContent = `${st.attributes.friendly_name || st.entity_id}  (${st.entity_id}: ${st.state})`;
    row.append(btn, label);
    box.append(row);
  }
}

async function onReady() {
  const states = await send('get_states');
  lights.clear();
  for (const s of states) if (s.entity_id.startsWith('light.')) lights.set(s.entity_id, s);
  renderLights();
  call('subscribe_events', { event_type: 'state_changed' }, (ev) => {
    const ns = ev.data.new_state;
    if (ev.data.entity_id.startsWith('light.') && ns) {
      lights.set(ns.entity_id, ns);
      renderLights();
      log('state_changed', ns.entity_id, ns.state);
    }
  });
  await loadPipelines();
}

// ---------- pipeline-uri ----------
let pipelines = [];
async function loadPipelines() {
  const res = await send('assist_pipeline/pipeline/list');
  pipelines = res.pipelines;
  const sel = $('pipeline');
  sel.textContent = '';
  for (const p of pipelines) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.name}${p.id === res.preferred_pipeline ? ' (preferat)' : ''}`;
    if (p.id === res.preferred_pipeline) o.selected = true;
    sel.append(o);
  }
  showPipelineInfo();
}
const currentPipeline = () => pipelines.find((p) => p.id === $('pipeline').value);
function showPipelineInfo() {
  const p = currentPipeline();
  if (p) $('pipeline-info').textContent = `stt=${p.stt_engine || '—'} (${p.stt_language || '—'}) · agent=${p.conversation_engine} (${p.conversation_language}) · tts=${p.tts_engine || '—'}`;
}
$('pipeline').onchange = showPipelineInfo;

// ---------- rulare pipeline (comun text/voce) ----------
let conversationId = null;
function ttsSrc(url) {
  // tts_output.url e relativ la HA (/api/tts_proxy/<fișier>); îl trecem prin serverul Vena.
  const m = String(url).match(/\/api\/tts_proxy\/([^/?#]+)/);
  return m ? `./tts/${m[1]}` : url;
}

function runPipeline(startStage, input, hooks = {}) {
  const p = currentPipeline();
  const endStage = p?.tts_engine ? 'tts' : 'intent';
  $('reply').textContent = '…';
  const { promise } = call(
    'assist_pipeline/run',
    { start_stage: startStage, end_stage: endStage, input, pipeline: p?.id, conversation_id: conversationId },
    (ev) => {
      const d = ev.data || {};
      log('pipeline', ev.type, ev.type === 'run-start' ? d.runner_data : ev.type.endsWith('-end') || ev.type === 'error' ? d : '');
      hooks.onEvent?.(ev);
      if (ev.type === 'stt-end') $('stt-text').textContent = d.stt_output?.text ?? '—';
      if (ev.type === 'intent-end') {
        const out = d.intent_output || {};
        conversationId = out.conversation_id ?? conversationId;
        $('reply').textContent = out.response?.speech?.plain?.speech ?? '(fără text)';
      }
      if (ev.type === 'tts-end' && d.tts_output?.url) {
        const pl = $('player');
        pl.src = ttsSrc(d.tts_output.url);
        pl.play().catch((e) => log('redare audio blocată:', e.message));
      }
      if (ev.type === 'error') $('reply').textContent = `EROARE ${d.code}: ${d.message}`;
    },
  );
  promise.catch((e) => {
    log('EROARE assist_pipeline/run', e);
    $('reply').textContent = `EROARE: ${e.message || e.code}`;
    hooks.onEvent?.({ type: 'run-end' });
  });
}

$('chat').onsubmit = (e) => {
  e.preventDefault();
  const text = $('chat-text').value.trim();
  if (!text) return;
  $('stt-text').textContent = '(text)';
  runPipeline('intent', { text });
  $('chat-text').value = '';
};

// ---------- voce ----------
const inIframe = window.self !== window.top;
// Microfonul rămâne deschis între apăsări: deschiderea lui durează 0,5–1 s și
// tăia începutul comenzii. Păstrăm și un pre-roll scurt, atașat la fiecare comandă.
const PREROLL_CHUNKS = 3; // 3 × 100 ms
const MIC_IDLE_CLOSE_MS = 120_000;
let audioCtx, workletReady, micStream, sourceNode, workletNode, micOpening, idleTimer;
let recording = false;
let handlerId = null;
let preBuffer = [];
let preroll = [];
let endPending = false;
let sentChunks = [];
let gotAudio = false;
let stopping = false; // stopVoice poate veni și de la VAD, și de la eliberarea butonului

function voiceState(text) {
  $('voice-state').textContent = text;
}

function sendBinary(bytes) {
  if (ws.readyState === WebSocket.OPEN) ws.send(bytes);
}
function sendChunk(int16buf) {
  const pcm = new Uint8Array(int16buf);
  const msg = new Uint8Array(pcm.length + 1);
  msg[0] = handlerId;
  msg.set(pcm, 1);
  sendBinary(msg);
}

function onPcm(buf) {
  if (!recording) {
    preroll.push(buf);
    if (preroll.length > PREROLL_CHUNKS) preroll.shift();
    return;
  }
  if (!gotAudio) {
    gotAudio = true;
    voiceState('VORBEȘTE');
  }
  sentChunks.push(buf.slice(0));
  if (handlerId === null) preBuffer.push(buf);
  else sendChunk(buf);
}

async function openMic() {
  if (micStream) return;
  if (micOpening) return micOpening;
  micOpening = (async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('Microfonul cere HTTPS sau localhost.'), { name: 'InsecureContext' });
    }
    if (!audioCtx) {
      audioCtx = new AudioContext();
      workletReady = audioCtx.audioWorklet.addModule('./pcm-worklet.js');
    }
    await workletReady;
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    workletNode = new AudioWorkletNode(audioCtx, 'pcm-encoder');
    workletNode.port.onmessage = (e) => onPcm(e.data);
    sourceNode = audioCtx.createMediaStreamSource(micStream);
    sourceNode.connect(workletNode);
    log(`microfon deschis: ${audioCtx.sampleRate} Hz -> 16000 Hz PCM16 mono`);
  })();
  try {
    await micOpening;
  } finally {
    micOpening = null;
  }
}

function closeMic() {
  clearTimeout(idleTimer);
  if (recording || !micStream) return;
  sourceNode?.disconnect();
  workletNode?.disconnect();
  micStream.getTracks().forEach((t) => t.stop());
  micStream = sourceNode = workletNode = null;
  preroll = [];
  log('microfon închis');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) closeMic(); });

async function startVoice() {
  if (recording) return;
  clearTimeout(idleTimer);
  $('mic').classList.add('rec');
  $('mic').setAttribute('aria-pressed', 'true');
  $('mic-msg').textContent = '';
  handlerId = null;
  sentChunks = [];
  endPending = false;
  gotAudio = false;
  const warm = Boolean(micStream);
  voiceState(warm ? 'VORBEȘTE' : 'deschid microfonul…');
  try {
    await openMic();
  } catch (err) {
    $('mic').classList.remove('rec');
    $('mic').setAttribute('aria-pressed', 'false');
    voiceState('pregătit');
    return micError(err);
  }
  if (!$('mic').classList.contains('rec')) return; // eliberat în timpul deschiderii
  recording = true;
  // Pre-roll: ultimele ~300 ms dinaintea apăsării (doar dacă microfonul era deja deschis).
  preBuffer = warm ? preroll.splice(0) : [];
  sentChunks = preBuffer.map((b) => b.slice(0));
  if (warm) gotAudio = true;

  runPipeline('stt', { sample_rate: 16000 }, {
    onEvent(ev) {
      if (ev.type === 'run-start') {
        handlerId = ev.data.runner_data.stt_binary_handler_id;
        for (const b of preBuffer.splice(0)) sendChunk(b);
        if (endPending) sendEnd();
      }
      if (ev.type === 'stt-vad-end' || ev.type === 'stt-end') stopVoice();
      if (ev.type === 'intent-start') voiceState('PROCESEAZĂ');
      if (ev.type === 'tts-start') voiceState('RĂSPUNDE');
      if (ev.type === 'run-end') voiceState('pregătit');
      if (ev.type === 'error') voiceState('eroare');
    },
  });
}

function sendEnd() {
  sendBinary(new Uint8Array([handlerId]));
  log(`sfârșit audio trimis (handler ${handlerId}), ${sentChunks.reduce((n, b) => n + b.byteLength, 0)} bytes PCM`);
  $('wav').disabled = sentChunks.length === 0;
}

function stopVoice() {
  $('mic').classList.remove('rec');
  $('mic').setAttribute('aria-pressed', 'false');
  if (!recording || stopping) return;
  stopping = true;
  // Golește ultimul chunk parțial, apoi trimite marcajul de sfârșit.
  workletNode?.port.postMessage('flush');
  setTimeout(() => {
    recording = false;
    stopping = false;
    if (handlerId === null) endPending = true;
    else sendEnd();
    if ($('voice-state').textContent === 'VORBEȘTE') voiceState('PROCESEAZĂ');
    idleTimer = setTimeout(closeMic, MIC_IDLE_CLOSE_MS);
  }, 50);
}

function micError(err) {
  log('EROARE microfon', err.name, err.message);
  let msg = `Microfonul nu e disponibil (${err.name}). Chatul text funcționează.`;
  if (err.name === 'InsecureContext') msg = 'Microfonul merge doar pe HTTPS sau localhost. Chatul text funcționează.';
  $('mic-msg').textContent = msg;
  if (err.name === 'NotAllowedError' && inIframe) {
    const a = document.createElement('a');
    a.href = location.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = ' Deschide Vena pe tot ecranul';
    $('mic-msg').append(a);
  }
}

// WAV pentru verificarea PCM-ului trimis (ascultă exact ce a primit HA).
$('wav').onclick = () => {
  const len = sentChunks.reduce((n, b) => n + b.byteLength, 0);
  const buf = new ArrayBuffer(44 + len);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + len, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, len, true);
  let o = 44;
  for (const b of sentChunks) { new Uint8Array(buf, o, b.byteLength).set(new Uint8Array(b)); o += b.byteLength; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  a.download = 'vena-trimis.wav';
  a.click();
};

const mic = $('mic');
mic.addEventListener('pointerdown', (e) => { e.preventDefault(); startVoice(); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) mic.addEventListener(ev, stopVoice);
mic.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); startVoice(); } });
mic.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') stopVoice(); });

const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && !typing(document.activeElement) && document.activeElement !== mic) { e.preventDefault(); startVoice(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && !typing(document.activeElement) && document.activeElement !== mic) stopVoice();
});

if (inIframe) log('rulez într-un iframe (ingress)');
connect();

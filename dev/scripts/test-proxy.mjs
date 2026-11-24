import { WebSocket } from 'ws';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:8099';
const wav = fs.readFileSync(process.argv[2] || new URL('./phrase.wav', import.meta.url));
const dataIdx = wav.indexOf(Buffer.from('data')); const pcm = Buffer.concat([wav.subarray(dataIdx + 8), Buffer.alloc(16000)]); // +0.5 s liniște
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => console.log(c ? 'OK  ' : 'FAIL', m);

// 1. securitate: Origin străin și Host străin
await new Promise((res) => { const w = new WebSocket(BASE.replace('http', 'ws') + '/ws', { origin: 'http://evil.example' }); w.on('unexpected-response', (_, r) => { ok(r.statusCode === 403, `WS cu Origin străin -> ${r.statusCode}`); res(); }); w.on('open', () => { ok(false, 'WS cu Origin străin acceptat'); w.close(); res(); }); });
{ const r = await fetch(BASE + '/config', { headers: { host: 'evil.example:8099' } }).catch(e => ({ status: e.message })); ok(r.status === 403, `HTTP cu Host străin -> ${r.status}`); }
{ const r = await fetch(BASE + '/config'); ok(r.status === 200, `/config -> ${JSON.stringify(await r.json())}`); }

const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws', { origin: BASE });
let id = 1; const pend = new Map(), lis = new Map(); const states = {};
const call = (type, p = {}, on) => { const i = id++; if (on) lis.set(i, on); ws.send(JSON.stringify({ id: i, type, ...p })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
await new Promise((res) => ws.on('message', function h(d, bin) {
  const m = JSON.parse(d);
  if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: 'orice-token-fals' }));
  else if (m.type === 'auth_ok') { ok(true, `auth_ok prin proxy cu token fals (HA ${m.ha_version})`); res(); }
  else if (m.type === 'result') { const p = pend.get(m.id); m.success ? p.res(m.result) : p.rej(m.error); }
  else if (m.type === 'event') lis.get(m.id)?.(m.event);
}));
await call('subscribe_events', { event_type: 'state_changed' }, (e) => { if (e.data.new_state) states[e.data.entity_id] = e.data.new_state.state; });
const L = 'light.kitchen_lights';
const waitState = async (want, ms = 5000) => { for (let t = 0; t < ms; t += 100) { if (states[L] === want) return true; await sleep(100); } return false; };

await call('call_service', { domain: 'light', service: 'turn_off', target: { entity_id: L } });
ok(await waitState('off') || (await call('get_states')).find(s => s.entity_id === L).state === 'off', 'call_service turn_off');
await call('call_service', { domain: 'light', service: 'toggle', target: { entity_id: L } });
ok(await waitState('on'), 'call_service toggle -> on (state_changed primit)');
await call('call_service', { domain: 'light', service: 'turn_off', target: { entity_id: L } }); await waitState('off');

const run = (start, input, onRunStart) => new Promise((res) => { const ev = []; const t0 = Date.now();
  call('assist_pipeline/run', { start_stage: start, end_stage: 'tts', input }, (e) => { ev.push([e.type, Date.now() - t0]); if (e.type === 'run-start') onRunStart?.(e.data.runner_data); if (e.type === 'run-end' || e.type === 'error') res({ ev, last: e }); res.ev = ev; ev.data = ev.data || {}; ev.data[e.type] = e.data; }).catch(err => res({ err })); });

// 2. chat text
let r = await run('intent', { text: 'aprinde lumina din bucătărie' });
const tx = r.ev.data; console.log('     evenimente:', r.ev.map(([t, ms]) => `${t}@${ms}`).join(' '));
ok(!!tx['intent-end'], `text -> răspuns: "${tx['intent-end']?.intent_output?.response?.speech?.plain?.speech}"`);
ok(await waitState('on'), 'text -> lumina s-a aprins');
const ttsUrl = tx['tts-end']?.tts_output?.url; console.log('     tts url:', ttsUrl);
if (ttsUrl) { const f = ttsUrl.match(/\/api\/tts_proxy\/([^/?#]+)/)[1]; const a = await fetch(`${BASE}/tts/${f}`); const b = await a.arrayBuffer(); ok(a.status === 200 && b.byteLength > 1000, `TTS prin proxy /tts -> ${a.status} ${a.headers.get('content-type')} ${b.byteLength} B`); }
await call('call_service', { domain: 'light', service: 'turn_off', target: { entity_id: L } }); await waitState('off');

// 3. voce: PCM binar prin proxy, prefixat cu handler id
let sent = 0;
r = await run('stt', { sample_rate: 16000 }, async (rd) => {
  const h = rd.stt_binary_handler_id; console.log('     stt_binary_handler_id =', h);
  for (let o = 0; o < pcm.length; o += 3200) { ws.send(Buffer.concat([Buffer.from([h]), pcm.subarray(o, o + 3200)])); sent++; await sleep(20); }
  ws.send(Buffer.from([h])); console.log(`     trimise ${sent} chunk-uri binare + marcaj de sfârșit`);
});
const vx = r.ev.data; console.log('     evenimente:', r.ev.map(([t, ms]) => `${t}@${ms}`).join(' '));
if (r.last?.type === 'error') console.log('     eroare:', r.last.data);
ok(!!vx['stt-end'], `voce -> transcriere: "${vx['stt-end']?.stt_output?.text}"`);
ok(!!vx['intent-end'], `voce -> răspuns: "${vx['intent-end']?.intent_output?.response?.speech?.plain?.speech}"`);
ok(await waitState('on'), 'voce -> lumina s-a aprins');
ws.close();

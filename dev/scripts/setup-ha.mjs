import { WebSocket } from 'ws';
const ws = new WebSocket('ws://127.0.0.1:8123/api/websocket');
let id = 1; const pend = new Map();
const call = (type, p = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, type, ...p })); });
ws.on('message', async (d) => {
  const m = JSON.parse(d);
  if (m.type === 'auth_required') return ws.send(JSON.stringify({ type: 'auth', access_token: process.env.HA_TOKEN }));
  if (m.type === 'result') { const p = pend.get(m.id); m.success ? p.res(m.result) : p.rej(m.error); return; }
  if (m.type !== 'auth_ok') return;
  try {
    const states = await call('get_states');
    console.log('stt:', states.filter(s => s.entity_id.startsWith('stt.')).map(s => s.entity_id));
    console.log('tts:', states.filter(s => s.entity_id.startsWith('tts.')).map(s => s.entity_id));
    console.log('lights:', states.filter(s => s.entity_id.startsWith('light.')).map(s => `${s.entity_id}=${s.attributes.friendly_name}`));
    const areas = await call('config/area_registry/list');
    console.log('areas:', areas.map(a => a.name));
    let area = areas.find(a => a.name === 'Bucătărie');
    if (!area) area = await call('config/area_registry/create', { name: 'Bucătărie' });
    const ent = await call('config/entity_registry/get', { entity_id: 'light.kitchen_lights' });
    await call('config/device_registry/update', { device_id: ent.device_id, area_id: area.area_id });
    console.log('kitchen device -> area', area.area_id);
    const stt = states.find(s => s.entity_id.startsWith('stt.') && /whisper/.test(s.entity_id))?.entity_id;
    const ttsList = await call('tts/engine/list', { language: 'ro' });
    console.log('tts ro:', JSON.stringify(ttsList.providers.map(p => [p.engine_id, p.supported_languages?.length])));
    const tts = ttsList.providers.find(p => p.supported_languages?.length)?.engine_id ?? null;
    const pl = await call('assist_pipeline/pipeline/list');
    let vena = pl.pipelines.find(p => p.name === 'Vena RO');
    const body = { name: 'Vena RO', language: 'ro', conversation_engine: 'conversation.home_assistant', conversation_language: 'ro',
      stt_engine: stt, stt_language: 'ro', tts_engine: tts, tts_language: tts ? 'ro' : null, tts_voice: null, wake_word_entity: null, wake_word_id: null };
    vena = vena ? await call('assist_pipeline/pipeline/update', { pipeline_id: vena.id, ...body }) : await call('assist_pipeline/pipeline/create', body);
    await call('assist_pipeline/pipeline/set_preferred', { pipeline_id: vena.id });
    console.log('pipeline:', JSON.stringify(vena));
  } catch (e) { console.error('EROARE', e); }
  ws.close();
});

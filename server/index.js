// Vena: server. Servește UI-ul static (build-ul Vite din ui/dist), face proxy WebSocket către HA
// (inclusiv frame-uri binare), proxy pentru camere și TTS și expune /config.
// Fără dependențe în afară de `ws`. Compatibil Node >= 20.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Pagina de test din spike rămâne disponibilă cu VENA_UI_DIR=spike-ui.
const UI_DIR = path.resolve(ROOT, process.env.VENA_UI_DIR || 'ui/dist');
const INGRESS_GATEWAY = '172.30.32.2';

// ---------- configurare ----------
function loadDotEnv(file) {
  // Parser minimal pentru .env (fără dotenv, fără process.loadEnvFile care e Node >= 20.12).
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

const ADDON = Boolean(process.env.SUPERVISOR_TOKEN);
if (!ADDON) loadDotEnv(path.join(ROOT, '.env'));

const HA_HTTP = ADDON ? 'http://supervisor/core' : (process.env.HA_URL || '').replace(/\/+$/, '');
const HA_WS = ADDON ? 'ws://supervisor/core/websocket' : HA_HTTP.replace(/^http/, 'ws') + '/api/websocket';
const TOKEN = ADDON ? process.env.SUPERVISOR_TOKEN : process.env.HA_TOKEN;
const PORT = Number(process.env.PORT) || 8099;
// Add-on: ascultăm pe toate interfețele, dar acceptăm doar gateway-ul de ingress.
// Dev: doar loopback.
const HOST = ADDON ? '0.0.0.0' : '127.0.0.1';

if (!HA_HTTP || !TOKEN) {
  console.error('[vena] Lipsește configurarea: setează HA_URL și HA_TOKEN în .env (mod dev).');
  process.exit(1);
}

const DEFAULT_OPTIONS = {
  assistant_name: 'Vena',
  user_name: '',
  background_pattern: 'hex',
  background_strength: 45,
  protected_entities: [],
  read_only_entities: [],
};
function readOptions() {
  try {
    return { ...DEFAULT_OPTIONS, ...JSON.parse(fs.readFileSync('/data/options.json', 'utf8')) };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}
const OPTIONS = readOptions();

const log = (...a) => console.log(new Date().toISOString(), '[vena]', ...a);

// ---------- controlul accesului ----------
function normalizeIp(addr = '') {
  return addr.startsWith('::ffff:') ? addr.slice(7) : addr;
}
function isAllowed(req) {
  const ip = normalizeIp(req.socket.remoteAddress);
  if (ADDON) return ip === INGRESS_GATEWAY;
  // Dev: loopback + protecție la DNS rebinding (Host trebuie să fie local).
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  return (ip === '127.0.0.1' || ip === '::1') && ['localhost', '127.0.0.1', '[::1]'].includes(host);
}
function isAllowedWsOrigin(req) {
  if (ADDON) return true; // sursa e deja gateway-ul de ingress
  // Dev: browserul nu aplică CORS pe WebSocket, deci verificăm Origin explicit,
  // altfel orice site deschis în browser ar putea folosi proxy-ul autentificat.
  const origin = req.headers.origin;
  return origin === `http://${req.headers.host}`;
}

// ---------- HTTP spre HA ----------
function haRequest(pathname, { method = 'GET', headers = {} } = {}) {
  const url = new URL(HA_HTTP + pathname);
  const mod = url.protocol === 'https:' ? https : http;
  return mod.request(url, { method, headers: { ...headers, Authorization: `Bearer ${TOKEN}` } });
}

function pipeFromHa(res, haPath, passHeaders = ['content-type', 'content-length', 'cache-control']) {
  const up = haRequest(haPath);
  up.on('response', (r) => {
    const headers = {};
    for (const h of passHeaders) if (r.headers[h]) headers[h] = r.headers[h];
    res.writeHead(r.statusCode || 502, headers);
    r.pipe(res);
  });
  up.on('error', (e) => {
    log('eroare proxy HTTP', haPath, e.message);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  res.on('close', () => up.destroy());
  up.end();
}

// ---------- fișiere statice ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(UI_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(UI_DIR + path.sep)) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'content-length': st.size,
      // Fișierele din assets/ au hash în nume: se pot păstra în cache; restul se revalidează.
      'cache-control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}
function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
}

// ---------- server HTTP ----------
const server = http.createServer((req, res) => {
  if (!isAllowed(req)) {
    log('respins HTTP de la', normalizeIp(req.socket.remoteAddress), req.headers.host);
    res.writeHead(403);
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  const { pathname } = new URL(req.url, 'http://x');

  if (pathname === '/config') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    return res.end(JSON.stringify(OPTIONS));
  }
  let m;
  if ((m = pathname.match(/^\/camera\/(camera\.[a-z0-9_]+)$/))) {
    return pipeFromHa(res, `/api/camera_proxy_stream/${m[1]}`, ['content-type']);
  }
  if ((m = pathname.match(/^\/tts\/([A-Za-z0-9_\-]+\.[a-z0-9]+)$/))) {
    return pipeFromHa(res, `/api/tts_proxy/${m[1]}`);
  }
  return serveStatic(req, res, pathname);
});

// ---------- proxy WebSocket ----------
// Pentru browser, serverul se comportă ca HA: trimite auth_required, acceptă
// orice mesaj `auth` și răspunde cu auth_ok-ul real primit de la HA. Tokenul
// adevărat rămâne pe server. După autentificare mesajele trec 1:1, cu tipul de
// frame păstrat (text sau binar).
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname !== '/ws' || !isAllowed(req) || !isAllowedWsOrigin(req)) {
    log('respins WS', pathname, normalizeIp(req.socket.remoteAddress), req.headers.origin);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (client) => bridge(client));
});

let connSeq = 0;
function bridge(client) {
  const cid = ++connSeq;
  const upstream = new WebSocket(HA_WS, { perMessageDeflate: false });
  let upstreamReady = false; // HA a trimis auth_ok
  let clientAuthed = false; // browserul a trimis auth
  let authOkMsg = null;
  const queue = []; // mesaje de la browser înainte ca HA să fie gata
  const stats = { up: 0, down: 0, binUp: 0 };

  const closeBoth = (code = 1000, reason = '') => {
    if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
  };

  upstream.on('message', (data, isBinary) => {
    if (!upstreamReady) {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return closeBoth(1011, 'bad upstream'); }
      if (msg.type === 'auth_required') {
        upstream.send(JSON.stringify({ type: 'auth', access_token: TOKEN }));
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'auth_required', ha_version: msg.ha_version }));
      } else if (msg.type === 'auth_ok') {
        upstreamReady = true;
        authOkMsg = JSON.stringify(msg);
        log(`#${cid} conectat la HA ${msg.ha_version}`);
        if (clientAuthed) flush();
      } else if (msg.type === 'auth_invalid') {
        log(`#${cid} HA a respins tokenul serverului:`, msg.message);
        closeBoth(1011, 'upstream auth failed');
      }
      return;
    }
    stats.down++;
    if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
  });

  function flush() {
    client.send(authOkMsg);
    for (const [data, isBinary] of queue.splice(0)) upstream.send(data, { binary: isBinary });
  }

  client.on('message', (data, isBinary) => {
    if (!clientAuthed) {
      // Primul mesaj trebuie să fie `auth` (ca la HA). Tokenul primit e ignorat.
      let msg = null;
      if (!isBinary) try { msg = JSON.parse(data.toString()); } catch {}
      if (msg?.type !== 'auth') return closeBoth(1008, 'auth expected');
      clientAuthed = true;
      if (upstreamReady) flush();
      return;
    }
    stats.up++;
    if (isBinary) stats.binUp++;
    if (!upstreamReady) queue.push([data, isBinary]);
    else if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
  });

  upstream.on('error', (e) => log(`#${cid} eroare HA:`, e.message));
  client.on('error', (e) => log(`#${cid} eroare browser:`, e.message));
  upstream.on('close', (code) => {
    log(`#${cid} HA a închis (${code})`);
    closeBoth(1012, 'upstream closed');
  });
  client.on('close', () => {
    log(`#${cid} browser închis; mesaje sus=${stats.up} (binare=${stats.binUp}) jos=${stats.down}`);
    closeBoth();
  });
}

server.listen(PORT, HOST, () => {
  log(`mod ${ADDON ? 'add-on' : 'dev'}; ascult pe ${HOST}:${PORT}; HA = ${HA_HTTP}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log('oprire');
    for (const c of wss.clients) c.close(1001);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

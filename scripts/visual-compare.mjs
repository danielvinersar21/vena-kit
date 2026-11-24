// Bucla de verificare vizuală: randează referința statică și ruta /preview la 1440×900,
// apoi produce, pentru fiecare stare: captura noastră, captura referinței, diff-ul și
// o imagine side-by-side. Compară și cu design/screenshots/<stare>.png.
//
// Folosire: npm run visual -- [stare ...]   (implicit: pregatit)
// Necesită Vite pornit (npm run dev:ui) și Google Chrome instalat.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'visual');
const BASE = process.env.VENA_UI_URL || 'http://127.0.0.1:5173/';
const FILES = {
  pregatit: '01-pregatit', asculta: '02-asculta', proceseaza: '03-proceseaza',
  raspunde: '04-raspunde', confirmare: '05-confirmare', offline: '06-offline',
};
const states = process.argv.slice(2).filter((a) => FILES[a]);
if (!states.length) states.push('pregatit');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });

async function shoot(url, file) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  // animations: 'disabled' readuce animațiile infinite la starea inițială, deci capturile sunt deterministe.
  await page.screenshot({ path: file, animations: 'disabled' });
  await page.close();
}

// Diff în browser (canvas), fără dependențe: pixeli cu diferență > prag pe orice canal.
async function diff(a, b, outDiff, outSide) {
  const page = await ctx.newPage();
  const toUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const res = await page.evaluate(async ([ua, ub]) => {
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(ua), load(ub)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const ca = new OffscreenCanvas(w, h).getContext('2d'); ca.drawImage(ia, 0, 0);
    const cb = new OffscreenCanvas(w, h).getContext('2d'); cb.drawImage(ib, 0, 0);
    const da = ca.getImageData(0, 0, w, h).data, db = cb.getImageData(0, 0, w, h).data;
    const dc = new OffscreenCanvas(w, h); const dctx = dc.getContext('2d'); const out = dctx.createImageData(w, h);
    let bad = 0; const TH = 24;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      const g = (da[i] + da[i + 1] + da[i + 2]) / 12;
      if (d > TH) {
        bad++; out.data[i] = 255; out.data[i + 1] = 40; out.data[i + 2] = 90; out.data[i + 3] = 255;
        const p = i / 4, x = p % w, y = (p / w) | 0;
        if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      } else { out.data[i] = out.data[i + 1] = out.data[i + 2] = g; out.data[i + 3] = 255; }
    }
    dctx.putImageData(out, 0, 0);
    const side = new OffscreenCanvas(w * 2 + 8, h); const sctx = side.getContext('2d');
    sctx.fillStyle = '#ff2a5a'; sctx.fillRect(0, 0, w * 2 + 8, h); sctx.drawImage(ia, 0, 0); sctx.drawImage(ib, w + 8, 0);
    const b64 = async (c) => { const blob = await c.convertToBlob({ type: 'image/png' }); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); };
    return { bad, total: w * h, bbox: maxX < 0 ? null : [minX, minY, maxX, maxY], diff: await b64(dc), side: await b64(side) };
  }, [toUrl(a), toUrl(b)]);
  fs.writeFileSync(outDiff, Buffer.from(res.diff, 'base64'));
  fs.writeFileSync(outSide, Buffer.from(res.side, 'base64'));
  await page.close();
  return res;
}

for (const s of states) {
  const f = FILES[s];
  const ours = path.join(OUT, `${f}.vena.png`);
  const ref = path.join(OUT, `${f}.ref.png`);
  await shoot(new URL(`preview?state=${s}`, BASE).href, ours);
  await shoot('file://' + path.join(ROOT, 'design/static', `${f}.html`), ref);
  const r1 = await diff(ours, ref, path.join(OUT, `${f}.diff-static.png`), path.join(OUT, `${f}.side-static.png`));
  const approved = path.join(ROOT, 'design/screenshots', `${f}.png`);
  const r2 = await diff(ours, approved, path.join(OUT, `${f}.diff-png.png`), path.join(OUT, `${f}.side-png.png`));
  const pct = (r) => ((100 * r.bad) / r.total).toFixed(3) + '%';
  console.log(`${s}: vs static ${r1.bad} px (${pct(r1)}) bbox=${JSON.stringify(r1.bbox)} | vs screenshot ${r2.bad} px (${pct(r2)}) bbox=${JSON.stringify(r2.bbox)}`);
}
await browser.close();

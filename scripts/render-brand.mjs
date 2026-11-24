// Randează vena/icon.png (128×128) și vena/logo.png (250×100) din elementele de design
// (orb-ul și marca din header), cu fonturile locale. Folosire: node scripts/render-brand.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const font = (pkg, file) =>
  'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64');

const css = `
@font-face { font-family: 'Chakra Petch'; font-weight: 600; src: url(${font('chakra-petch', 'chakra-petch-latin-600-normal.woff2')}) format('woff2'); }
html, body { margin: 0; background: transparent; }
`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 400 400">
  <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bff3ff"/><stop offset="45%" stop-color="#4fd8ff"/><stop offset="100%" stop-color="#4fd8ff" stop-opacity="0"/></radialGradient></defs>
  <rect width="400" height="400" fill="#04070b"/>
  <circle cx="200" cy="200" r="186" fill="none" stroke="#1f4a5c" stroke-width="6" stroke-dasharray="6 18"/>
  <circle cx="200" cy="200" r="146" fill="none" stroke="#4fd8ff" stroke-width="10" stroke-dasharray="90 40 10 40" opacity="0.85"/>
  <circle cx="200" cy="200" r="122" fill="none" stroke="#4fd8ff" stroke-width="14" stroke-dasharray="4 14" opacity="0.5"/>
  <circle cx="200" cy="200" r="100" fill="url(#g)"/>
  <circle cx="200" cy="200" r="44" fill="#e9fbff"/>
</svg>`;

const logo = `<div style="width:250px;height:100px;background:#04070b;display:flex;align-items:center;justify-content:center;gap:16px;box-sizing:border-box">
  <svg width="44" height="44" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="none" stroke="#4fd8ff" stroke-width="1.5"/><circle cx="14" cy="14" r="5" fill="#4fd8ff"/></svg>
  <div style="font-family:'Chakra Petch';font-weight:600;font-size:34px;letter-spacing:0.32em;color:#cdeefc;margin-right:-0.32em">VENA</div>
</div>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, html, w, h] of [['icon.png', icon, 128, 128], ['logo.png', logo, 250, 100]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>${css}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, 'vena', name), clip: { x: 0, y: 0, width: w, height: h }, omitBackground: true });
  console.log('scris vena/' + name);
}
await browser.close();

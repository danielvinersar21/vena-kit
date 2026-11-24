# Vena: interfață HUD pentru Home Assistant

Vena e o interfață web HUD pentru casa și atelierul lui Ionuț, livrată ca **app (add-on) Home Assistant cu ingress**. Nu are backend propriu: vorbește cu HA prin WebSocket, printr-un server Node subțire din container. Brief-ul complet (mediul lui Ionuț, arhitectura, datele din HA, vocea, designul, ordinea de lucru, ce am învățat) e în **[docs/brief.md](docs/brief.md)**. Citește-l înainte de orice lucru nou.

## Stack

- UI: Vite, React, TypeScript, Tailwind, Framer Motion. Fonturile Chakra Petch și JetBrains Mono se împachetează local (fără CDN). Build cu `base: './'` și doar URL-uri relative (ingress).
- Server: Node ≥ 20 (în imagine: Node 24), `ws` + `node:http`. Fără framework-uri grele, fără API-uri mai noi decât Node 20.
- Container: `ghcr.io/home-assistant/base:3.24` + `nodejs`; **fără `build.yaml`** (deprecated). `CMD` trece prin `/command/with-contenv`, altfel S6 ascunde `SUPERVISOR_TOKEN`.
- Distribuție: imagine multi-arch pe GHCR, construită de `.github/workflows/release.yaml` la tag `vX.Y.Z` (= `version` din `vena/config.yaml`). Repo-ul public se generează cu `scripts/export-public-repo.sh`.
- Documentația oficială pentru apps e pe **contributors.home-assistant.io**. Verifică acolo, nu din memorie.

## Fidelitatea vizuală (obligatorie)

- Referința e `design/static/*.html` (6 stări) + `design/screenshots/*.png` (1440×900) + `design/tokens.json`; `design/reference/*.dc.html` pentru ecranele aprobate.
- **Portezi, nu reinterpretezi.** Valorile (culori, mărimi, spațieri, dash-uri, durate, keyframe-uri) se copiază exact. Unde Tailwind nu are clasa identică, folosești valori arbitrare sau variabile CSS din tokeni.
- Bucla: ruta `/preview?state=<stare>` cu date mock identice → screenshot Playwright 1440×900 al referinței și al rutei → comparare → corectare până nu mai există diferențe vizibile.
- Accesibilitate: butoane reale, `aria-pressed` pe toggle-uri, `aria-label` pe butoanele doar cu icon, focus vizibil, contrast ≥ 4.5:1, `prefers-reduced-motion` respectat.

## Securitate

- Ca add-on, serverul acceptă conexiuni (HTTP și WS) **doar de la 172.30.32.2** (gateway-ul de ingress). În dev ascultă doar pe 127.0.0.1 și verifică `Host` și `Origin`.
- Browserul nu vede niciodată tokenul: proxy-ul WS face autentificarea la HA pe server și răspunde browserului cu `auth_ok`.
- Tokenurile nu se scriu pe disc și nu ajung în git (`.env` e ignorat; `.env.example` rămâne fără valori).
- Microfonul: se deschide doar la apăsare, rămâne deschis doar cât tab-ul e vizibil și are focus (max 30 s după ultima eliberare), cu indicator vizibil; pre-roll-ul de ~500 ms stă local și pleacă doar la apăsare.

## Ce nu facem

- Nu modificăm configurarea HTTP a HA, Tailscale-ul sau automatizările lui Ionuț.
- Nu expunem porturi și nu stocăm tokenuri pe disc.
- Nu deschidem poarta, nu comutăm entitățile protejate fără ecranul de confirmare și nu facem niciun apel pe entitățile read-only. Nu scriem nimic în HA în afară de apelurile cerute explicit de utilizator.
- Nu adăugăm dependențe grele (fără Next.js, fără baze de date, fără procesare audio pe server). Buget: sub 50 MB RAM în idle, CPU neglijabil.

## Comenzi de dezvoltare

- `docker compose -f dev/ha/docker-compose.yml up -d`: HA local (demo) pe 127.0.0.1:8123 + Whisper (ro).
- `.env` (din `.env.example`): `HA_URL`, `HA_TOKEN` (long-lived token din HA-ul local).
- `npm run dev`: serverul Vena (proxy către HA, :8099) + Vite (UI, http://127.0.0.1:5173). Previzualizare: `/preview?state=pregatit|asculta|proceseaza|raspunde|confirmare|offline`.
- `npm run visual -- <stare>`: capturi 1440×900 ale referinței și ale `/preview`, plus diff și side-by-side, în `visual/` (necesită Vite pornit și Google Chrome).
- `npm run typecheck`, `npm run build` (UI în `ui/dist`, cu URL-uri relative).
- `node scripts/render-brand.mjs`: regenerează `vena/icon.png` și `vena/logo.png`.
- `node dev/scripts/setup-ha.mjs`: configurează HA-ul local (Wyoming, pipeline „Vena RO”, zona Bucătărie).
- `node dev/scripts/test-proxy.mjs <frază.wav>`: test cap-coadă prin proxy (lumină, chat, voce).
- `./scripts/sync-addon.sh`, apoi `docker buildx build --platform linux/amd64 vena/`: verifică imaginea local.

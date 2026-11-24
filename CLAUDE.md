# Vena: interfață HUD pentru Home Assistant (add-on / app)

## Ce construim

**Vena** este o interfață web în stil HUD futurist pentru casa și atelierul lui Ionuț. Vena **nu** are backend propriu. Se conectează la Home Assistant (HA) pe aceeași cale ca orice client: API-ul WebSocket, cu token. Rolul ei e să schimbe experiența, nu logica.

Se livrează ca **add-on Home Assistant** (în documentația nouă se numește „app”), cu **ingress**. Ionuț adaugă repo-ul, apasă Install, iar Vena apare în bara laterală din HA. Nu configurează token și nu deschide porturi.

Faza 1 (proiectul ăsta) acoperă doar Home Assistant: stare live, control, camere, jurnal, chat text și voce prin pipeline-ul Assist existent. Faza 2 (agent peste Claude Code) **nu** intră aici.

## Mediul lui Ionuț (confirmat, noiembrie 2026)

- Home Assistant OS 18.3, Core 2026.9.3, ca VM în Virtual Machine Manager pe Synology (**amd64**, 2 nuclee, 4 GB RAM).
- Add-on-uri care rulează deja: Frigate 0.18, Mosquitto, Matter Server, Tailscale 0.30.1, File editor. Are și HACS (Tuya Local, Frigate și altele).
- **HTTPS** există doar prin Tailscale (`share_homeassistant = serve`, port 443): `https://homeassistant.<tailnet>.ts.net`. În LAN, HA e pe HTTP simplu, portul 8123.
- Pipeline-ul Assist: Google Cloud STT în română → comenzile locale din HA → Claude Haiku (agent de conversație) → Google Cloud TTS cu voce românească.
- Reguli de-ale lui pe care UI-ul **nu are voie** să le ocolească:
  - termostatul și AC-ul se comută doar cu confirmare, la fiecare comandă;
  - releul becului din birou e sensibil: stingerea cere confirmare;
  - deschiderea porții **nu** se face din Vena (doar se citește starea).
- Resursele sunt limitate (Frigate rulează pe același VM). **Buget pentru add-on: sub 50 MB RAM în idle și CPU neglijabil.** Fără procesare grea pe server.

## Arhitectura

```
Browser (Vena UI, React)
   │  WebSocket pe ./ws (relativ la calea de ingress)
   ▼
Server Vena (Node, în containerul add-on-ului, port 8099, ingress)
   │  ws://supervisor/core/websocket, autentificat cu SUPERVISOR_TOKEN
   │  http://supervisor/core/api/... (proxy pentru camere)
   ▼
Home Assistant Core
```

- `config.yaml` din add-on: `ingress: true`, `ingress_port: 8099`, `homeassistant_api: true`, `panel_icon`, `panel_title: Vena`, `arch: [amd64, aarch64]`, **fără** `ports` expuse.
- **Serverul** face trei lucruri:
  1. Servește build-ul static al UI-ului și respectă calea de ingress (header-ul `X-Ingress-Path`). Build-ul Vite folosește `base: './'` și doar URL-uri relative.
  2. **Proxy de WebSocket.** Deschide o conexiune la `ws://supervisor/core/websocket`, face handshake-ul de autentificare cu `SUPERVISOR_TOKEN`, apoi transmite mesajele în ambele direcții, **inclusiv frame-urile binare** (audio pentru STT). Browserul nu vede niciodată tokenul. Pe partea de browser, conexiunea trebuie să arate pentru client ca una deja autentificată. Alege o soluție curată (de exemplu un `createSocket` propriu pentru `home-assistant-js-websocket`, sau un client WS subțire scris de tine).
  3. **Proxy pentru camere:** `GET ./camera/:entity_id` → `http://supervisor/core/api/camera_proxy_stream/<entity_id>` (MJPEG), cu header-ul de autorizare pus de server.
- **Mod de dezvoltare.** Dacă `SUPERVISOR_TOKEN` lipsește, serverul folosește `HA_URL` + `HA_TOKEN` (long-lived token) din `.env`. Același cod rulează local și în add-on.
- Opțiunile add-on-ului (`options` / `schema` în `config.yaml`), citite din `/data/options.json`:
  - `assistant_name` (implicit `Vena`), `user_name` (implicit gol, adică fără nume în salut);
  - `background_pattern`: `hex` | `grid` | `dots` | `none`; `background_strength`: 0–100, implicit 45;
  - `protected_entities`: listă de entity_id-uri care cer confirmare. Implicit se protejează automat domeniile `climate`, `lock` și `cover`, iar entitățile din listă se adaugă peste;
  - `read_only_entities`: entități care doar se afișează, fără control (aici intră poarta).
  Serverul expune opțiunile UI-ului prin `GET ./config`.

## Stack

- UI: Vite, React, TypeScript, Tailwind, Framer Motion. Fonturile Chakra Petch și JetBrains Mono se **împachetează local** (fără CDN).
- Server: Node 20+ cu `ws` și un server HTTP minimal (Fastify sau `node:http`). Fără framework-uri grele.
- Containerul: imaginea de bază oficială HA pentru add-on-uri (Alpine) plus `nodejs`. **Verifică în documentația actuală** (developers.home-assistant.io, secțiunea Apps) forma curentă pentru `build.yaml` / `BUILD_FROM`, pentru că s-a schimbat recent.

## Date din HA (prin WebSocket)

- Stare live: `subscribe_entities` (sau `get_states` plus `subscribe_events` pe `state_changed`).
- Structura casei: `config/area_registry/list`, `config/device_registry/list`, `config/entity_registry/list`. Camerele din UI se construiesc **automat din zone** (areas), fără nume hardcodate.
- Prezența vine de la `binary_sensor` cu `device_class` `occupancy`/`presence`/`motion` din fiecare zonă.
- Jurnalul: subscription la `logbook/event_stream` (ultimele ~20 de evenimente). Evenimentele care contează (poarta, curierul GLS anunțat de automatizarea lui, aparate ieșite din rețea, backup) le scoatem în evidență cu culoarea accent.
- Comenzi: `call_service` (`light.turn_on` / `turn_off`, `media_player` etc.). Înainte de orice apel pe o entitate protejată, se afișează **ecranul de confirmare**. Pe entitățile read-only nu se face niciun apel.

## Voce și chat (pipeline-ul Assist existent, nu altul)

- **Chat text:** `assist_pipeline/run` cu `start_stage: "intent"`, `end_stage: "tts"`, `input: { text }`. Răspunsul text vine din `intent-end`, iar audio-ul din `tts-end` (`tts_output.url`). Se folosește pipeline-ul implicit al lui Ionuț (sau cel ales cu `assist_pipeline/pipeline/list`).
- **Voce:** `assist_pipeline/run` cu `start_stage: "stt"`, `end_stage: "tts"`, `input: { sample_rate: 16000 }`.
  - Din evenimentul `run-start` iei `runner_data.stt_binary_handler_id`.
  - Audio-ul se trimite ca mesaje binare, fiecare chunk **prefixat cu un byte** egal cu handler ID-ul.
  - Formatul cerut e **PCM brut, 16 kHz, 16-bit, mono**. Browserul dă 48 kHz float, deci faci resample și conversie într-un AudioWorklet.
  - **Sfârșitul audio-ului** îl marchezi cu un mesaj binar care conține doar byte-ul de handler ID.
  - Stările orb-ului sunt legate de evenimente: `stt-start`/`stt-end` = ascultă, `intent-start`/`intent-end` = procesează, `tts-start` până la `run-end` = răspunde.
  - Răspunsul audio se redă în browser (`tts_output.url`, relativ la HA, prin proxy-ul serverului dacă e nevoie).
- **Push-to-talk:** ții **Space** apăsat (doar când focusul nu e într-un input) sau ții apăsat butonul de microfon / orb-ul.
- **Microfonul are două condiții cunoscute:**
  1. Funcționează doar pe **HTTPS** (sau `localhost`). Pe `http://<ip>:8123` nu merge, oricât de bine e scris codul.
  2. **Iframe-ul de ingress din bara laterală a HA nu are `allow="microphone"`** (există un PR deschis în frontend-ul HA), așa că `getUserMedia` dă `NotAllowedError`. Soluția: dacă detectezi că rulezi în iframe și microfonul e blocat, afișezi butonul **„Deschide Vena pe tot ecranul”**, care deschide aceeași adresă de ingress ca pagină de sine stătătoare. **Validează asta în spike-ul de mai jos.** Dacă sesiunea de ingress nu ține în tab separat, oprește-te și raportează înainte să alegi altă soluție.
- Dacă microfonul nu e disponibil, UI-ul rămâne complet funcțional prin chat text, cu un mesaj clar despre motiv.

## Design: sursa de adevăr

**Fidelitatea vizuală e obligatorie: portezi, nu reinterpretezi.**
- `design/static/*.html`: cele 6 stări ale ecranului (pregătit, ascultă, procesează, răspunde, confirmare, offline) ca **HTML simplu care se deschide direct în browser**. Asta e referința principală. Markup-ul, stilurile inline, SVG-ul orb-ului, keyframe-urile CSS și pattern-ul hex se transpun **1:1** în componente React. Valorile (culori, mărimi, spațieri, dash-uri, durate) se copiază exact. Nu le aproximezi cu clase Tailwind apropiate: unde nu există o clasă identică, folosești valori arbitrare (`text-[#7ea9bb]`) sau variabile CSS din tokeni.
- `design/screenshots/*.png`: cum trebuie să arate fiecare stare la 1440×900.
- **Bucla de verificare:** construiește o rută `/preview?state=<stare>` care afișează UI-ul cu date mock identice cu referința. Pentru fiecare stare, randează referința statică și ruta ta la 1440×900 cu Playwright, compară cele două screenshot-uri unul lângă altul și corectează până nu mai există diferențe vizibile. Abia apoi treci la date reale. Raportează screenshot-urile finale.
- `design/tokens.json`: culori, fonturi, spațiere, controale, fundal (pattern hex), orb și stările lui, motion.
- `design/reference/*.dc.html`: ecranele aprobate (format HTML de canvas; ignoră `support.js` și sintaxa `{{ }}` / `<sc-if>` și folosește markup-ul și stilurile ca referință vizuală exactă):
  - `Main`: ecranul principal (coloane: camere / orb / camera curții și jurnal);
  - `A-Raspunde`: Vena răspunde;
  - `A-Confirmare`: confirmarea pentru aparat protejat (dialog modal cu `role="dialog"`);
  - `A-Offline`: HA deconectat (ultima stare cunoscută, reconectare automată cu backoff, buton „Reîncearcă acum”);
  - `Orb-States`: cele 4 stări ale orb-ului.
- Unde datele reale diferă de mock (numărul de zone, entitățile), layout-ul se adaptează, dar look-ul rămâne cel din referințe.
- Accesibilitate: butoane reale, `aria-pressed` pe toggle-uri, `aria-label` pe butoanele care au doar icon, focus vizibil, contrast de cel puțin 4.5:1, `prefers-reduced-motion` respectat.

## Ordinea de lucru

1. **Spike (înainte de UI, 1–2 ore):** un add-on minim care:
   - se conectează prin proxy și afișează o lumină din HA demo pe care o poate comuta;
   - rulează un chat text prin `assist_pipeline/run`;
   - încearcă microfonul în iframe (să confirmi că e blocat) și în tab separat (să confirmi că merge).
   Raportează rezultatul înainte de pasul 2.
2. Mediul de dezvoltare: HA în Docker (`homeassistant/home-assistant:stable`) cu integrarea `demo:` în `configuration.yaml` (oferă lumini, senzori, camere, media players) și un pipeline Assist (merge și cel implicit, doar text). Script `npm run dev` pentru UI și server, cu `.env` (HA_URL, HA_TOKEN). Pe `localhost` microfonul funcționează.
3. Serverul: proxy WS, proxy pentru camere, `/config`, ingress.
4. UI-ul: layout, stare live, toggle-uri, confirmări, jurnal, cameră, apoi chat și voce cu orb-ul.
5. Starea offline și reconectarea.
6. Împachetarea add-on-ului: `repository.yaml` la rădăcina repo-ului, folderul `vena/` cu `config.yaml`, `Dockerfile`, `build.yaml` (dacă e cazul), `DOCS.md`, `icon.png`, `logo.png`, `translations/ro.yaml` și `en.yaml`.
7. Testul final pe HA demo, rulat ca add-on local (folderul `/addons` într-un HAOS de test, dacă există) sau cât mai aproape de asta.

## Ce nu facem

- Nu modificăm configurarea HTTP a HA, Tailscale-ul sau automatizările lui Ionuț.
- Nu expunem porturi și nu stocăm tokenuri pe disc.
- Nu deschidem poarta, nu comutăm entitățile protejate fără confirmare și nu scriem nimic în HA în afară de apelurile de serviciu cerute explicit de utilizator.
- Nu adăugăm dependențe grele (fără Next.js, fără baze de date, fără procesare audio pe server).

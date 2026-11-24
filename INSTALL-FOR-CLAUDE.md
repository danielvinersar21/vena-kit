# Instalarea Vena: instrucțiuni pentru Claude-ul lui Ionuț

Pentru Claude-ul care lucrează cu Ionuț în „atelier”. Ionuț decide și aprobă, tu execuți. Respectă regulile din CLAUDE.md-urile lui: nu atinge setările HTTP din HA, Tailscale-ul și automatizările existente.

## Ce este

Vena e un add-on (app) de Home Assistant cu ingress: o interfață HUD peste HA. Se conectează prin proxy-ul intern al Supervisor-ului, deci **nu are nevoie de token și nu deschide porturi**. Folosește pipeline-ul Assist existent (Google STT → comenzi locale → Haiku → TTS românesc), fără să-l modifice.

## Pași

1. **Adaugă repo-ul în HA.** Mergi la Settings → Apps (Add-ons) → Store → meniul ⋮ → Repositories și adaugă URL-ul repo-ului Vena: `<URL-REPO>`.
   Dacă repo-ul e privat: copiază folderul `vena/` în `/addons/vena` (din File editor sau Samba), apoi apasă Check for updates în Store. Apare la „Local add-ons”.
2. **Instalează Vena**, apoi pornește-o și activează „Show in sidebar”. Lasă „Start on boot” pornit.
3. **Opțiuni** (fila Configuration), cu OK de la Ionuț pentru fiecare:
   - `assistant_name: Vena` (sau alt nume ales de el), `user_name: Ionuț`;
   - `protected_entities`: entity_id-ul becului din birou (releul sensibil). Termostatul și AC-ul sunt protejate automat (domeniul `climate`);
   - `read_only_entities`: entitatea porții (Vena doar afișează starea, nu deschide poarta).
4. **Verifică conexiunea.** Deschide Vena din bara laterală. Trebuie să apară zonele, luminile, prezența, camera curții și jurnalul. Comută o lumină obișnuită (nu cea din birou) și confirmă starea recitind-o din HA.
5. **Microfonul:**
   - laptopul lui Ionuț trebuie să fie în același cont Tailscale. Dacă nu e, adaugă-l (cu OK-ul lui), ca să ajungă la `https://homeassistant.<tailnet>.ts.net`;
   - deschide HA pe adresa `ts.net` (HTTPS), apoi Vena. În bara laterală microfonul e blocat de iframe-ul HA, așa că folosește butonul „Deschide Vena pe tot ecranul” și testează: ține Space, spune „aprinde lumina în depozit”, verifică răspunsul și starea;
   - pe `http://<ip>:8123` din LAN microfonul nu poate merge (browserul cere HTTPS). Chatul text merge oriunde.
6. **Numele la voce (opțional):** dacă Ionuț vrea ca asistentul să se numească „Vena” și pe telefon, schimbă numele asistentului în Settings → Voice assistants. Nu modifica piesele pipeline-ului.
7. **Raportează-i lui Ionuț** pe scurt ce s-a instalat și ce a mers. Notează în STARE.md / CLAUDE.md că Vena există și ce opțiuni are.

## Dacă ceva nu merge

- „Nu se conectează”: verifică în log-ul add-on-ului că `homeassistant_api` e activ și că proxy-ul `ws://supervisor/core/websocket` răspunde.
- „Nu apar camerele”: verifică entitățile `camera.*` de la Frigate și log-ul pentru `camera_proxy_stream`.
- Probleme de resurse (VM-ul are 4 GB, cu Frigate pornit): Vena ar trebui să folosească sub 50 MB RAM. Dacă folosește mult mai mult, oprește add-on-ul și anunță.

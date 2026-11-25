# Instalarea Vena: instrucțiuni pentru Claude-ul lui Ionuț

Pentru Claude-ul care lucrează cu Ionuț în „atelier”. Ionuț decide și aprobă, tu execuți. Respectă regulile din CLAUDE.md-urile lui: nu atinge setările HTTP din HA, Tailscale-ul și automatizările existente.

## Ce este

Vena e un add-on (app) de Home Assistant cu ingress: o interfață HUD peste HA. Folosește pipeline-ul Assist existent (Google STT → comenzi locale → Haiku → TTS românesc), fără să-l modifice.

**Ce acces are.** Prin `homeassistant_api: true`, Supervisor-ul îi dă containerului un token (`SUPERVISOR_TOKEN`) cu acces la tot API-ul HA: lumini, camere, poartă, climă. Nu trebuie creat sau introdus niciun token de mână, dar accesul e complet. Protecțiile (confirmarea pentru entitățile protejate, refuzul oricărui apel pe entitățile read-only) sunt în codul Venei, nu în HA. Tokenul stă doar în memoria serverului din container și nu ajunge în browser. Vena nu deschide porturi: acceptă conexiuni doar de la gateway-ul de ingress (172.30.32.2).

**Codul sursă** e public: https://github.com/danielvinersar21/vena-kit. Imaginea de pe GHCR e construită de workflow-ul `.github/workflows/release.yaml` din acel repo, la tag-ul `vX.Y.Z`; rularea din GitHub Actions arată commit-ul exact. Locuri de citit înainte de instalare:
- `server/index.js`: filtrul de IP, proxy-ul WS către HA, camera și TTS;
- `ui/src/live/useLive.ts` și `ui/src/live/home.ts`: apelurile de servicii, garda pentru read-only și confirmările;
- `ui/src/live/assistant.ts`: microfonul (deschis doar la apăsare, închis la blur/ascundere și după 30 s);
- `vena/config.yaml` și `vena/Dockerfile`: permisiunile add-on-ului și imaginea.

## Cum înțelege Vena comenzile

- Vena **nu are logică proprie de înțelegere**. Trimite textul și vocea în pipeline-ul Assist implicit din HA, iar HA decide: întâi comenzile locale, apoi Claude Haiku pentru restul. Configurația existentă la Ionuț rămâne neschimbată.
- Haiku poate controla doar entitățile expuse în **Settings → Voice assistants → Expose**. Ce nu e expus (termostatul, AC-ul, poarta) nu se poate comanda vocal, nici din Vena. E intenționat, nu e o eroare.
- Dacă Ionuț vrea ca Vena să înțeleagă la voce o entitate nouă, o expune acolo, cu OK-ul lui.
- Sub răspuns, Vena afișează discret „via local” sau „via <numele agentului>” (numele agentului de conversație din pipeline, exact cum îl dă HA; „via AI” dacă HA nu dă un nume), ca să se vadă cine a procesat cererea. Informația vine de la HA (`processed_locally` din evenimentul `intent-end`).

## Pași

1. **Adaugă repo-ul în HA.** Mergi la Settings → Apps (Add-ons) → Store → meniul ⋮ → Repositories și adaugă URL-ul repo-ului Vena: `https://github.com/danielvinersar21/vena-assistant`.
   Imaginea e gata construită (GHCR), deci instalarea doar o descarcă; nu se construiește nimic pe NAS.
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

## Cum raportezi o problemă

Orice problemă merge ca issue pe GitHub, cu template-ul „Problemă Vena”: https://github.com/danielvinersar21/vena-assistant/issues/new?template=problema-vena.yml

Dacă ai `gh` și Ionuț îți dă OK, îl poți deschide direct, cu aceleași secțiuni ca template-ul:

```sh
gh issue create --repo danielvinersar21/vena-assistant --label bug --title "[Problemă] <pe scurt>" --body "### Ce s-a întâmplat
...
### Pașii care au dus la eroare
1. ...
### Versiunea Vena
0.0.1
### Versiunea Home Assistant
...
### Log-ul add-on-ului
(Settings → Apps → Vena → Log, ultimele linii din jurul erorii)
### Browserul folosit
..."
```

Înainte să trimiți, scoate din log și din text tokenurile, parolele și adresa `ts.net`: repo-ul e public.

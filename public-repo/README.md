# Vena: repository de app-uri pentru Home Assistant

Interfață HUD pentru Home Assistant, livrată ca app (add-on) cu ingress.

Adaugă repo-ul în Home Assistant: **Settings → Apps → Store → ⋮ → Repositories** și lipește URL-ul acestui repo. Apoi instalează **Vena**.

Repo-ul conține doar configurarea app-ului. Imaginea e construită și publicată pe GHCR (`amd64`, `aarch64`), deci Home Assistant nu construiește nimic local. Codul sursă și workflow-ul care construiește imaginea sunt în [danielvinersar21/vena-kit](https://github.com/danielvinersar21/vena-kit).

**Versiune beta.** Pentru instalare cu Claude: [INSTALL-FOR-CLAUDE.md](INSTALL-FOR-CLAUDE.md). Problemele se raportează ca [issue](https://github.com/danielvinersar21/vena-assistant/issues/new?template=problema-vena.yml), cu template-ul „Problemă Vena”.

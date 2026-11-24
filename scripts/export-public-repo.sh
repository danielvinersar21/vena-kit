#!/bin/sh
# Generează conținutul repo-ului public (doar configurarea app-ului, fără sursă).
# Folosire: scripts/export-public-repo.sh <director-țintă>   (ex.: clona lui vena-assistant)
set -e
DEST="${1:?director țintă lipsă}"
mkdir -p "$DEST" && DEST="$(cd "$DEST" && pwd)"
cd "$(dirname "$0")/.."
[ "$DEST" != "$(pwd)" ] || { echo "Ținta nu poate fi chiar repo-ul sursă."; exit 1; }
mkdir -p "$DEST/vena"
cp public-repo/repository.yaml public-repo/README.md INSTALL-FOR-CLAUDE.md "$DEST/"
rm -rf "$DEST/.github" && cp -R public-repo/.github "$DEST/.github"
for f in config.yaml DOCS.md README.md CHANGELOG.md icon.png logo.png; do
  [ -f "vena/$f" ] && cp "vena/$f" "$DEST/vena/"
done
rm -rf "$DEST/vena/translations" && cp -R vena/translations "$DEST/vena/"
grep -q '^image:' "$DEST/vena/config.yaml" || { echo "config.yaml nu are image:"; exit 1; }
echo "Exportat în $DEST:"; (cd "$DEST" && find . -path ./.git -prune -o -type f -print | sort)

#!/bin/sh
# Copiază codul aplicației în contextul de build al add-on-ului (vena/app).
set -e
cd "$(dirname "$0")/.."
rm -rf vena/app && mkdir -p vena/app
# UI-ul se construiește aici (în CI sau local), nu în imagine: imaginea primește doar ui/dist.
[ "${SKIP_UI_BUILD:-}" = 1 ] || npm run build
cp -R package.json package-lock.json server vena/app/
mkdir -p vena/app/ui && cp -R ui/dist vena/app/ui/dist

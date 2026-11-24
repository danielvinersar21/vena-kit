#!/bin/sh
# Copiază codul aplicației în contextul de build al add-on-ului (vena/app).
set -e
cd "$(dirname "$0")/.."
rm -rf vena/app && mkdir -p vena/app
cp -R package.json package-lock.json server spike-ui vena/app/

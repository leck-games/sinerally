#!/bin/sh
# Re-vendor the terrain module into js/terrain/ (contract: MODULE_API.md of sinerally-terrain). Do not edit js/terrain/ by hand.
# usage: tools/sync-terrain.sh [path-to-sinerally-terrain checkout]   (default ../sinerally-terrain)
set -e
SRC=${1:-../sinerally-terrain}; cd "$(dirname "$0")/.."
rm -rf js/terrain && mkdir -p js/terrain && cp "$SRC"/terrain/*.js js/terrain/
cp "$SRC"/MODULE_API.md js/terrain/MODULE_API.md
REV=$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unknown)
echo "vendored from sinerally-terrain@$REV on $(date +%F)" > js/terrain/VERSION
echo "terrain synced @$REV"

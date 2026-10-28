#!/bin/sh
# Re-vendor the physics / vehicles / attachments modules into js/phys/ (contract: MODULE_API.md of sinerally-physics).
# Do not edit js/phys/ by hand. usage: tools/sync-physics.sh [path-to-sinerally-physics checkout]   (default ../sinerally-physics)
set -e
SRC=${1:-../sinerally-physics}; cd "$(dirname "$0")/.."
rm -rf js/phys && mkdir -p js/phys/host
cp -r "$SRC"/physics "$SRC"/vehicles "$SRC"/attachments js/phys/
cp "$SRC"/host/rig.js "$SRC"/host/bus.js js/phys/host/
cp "$SRC"/MODULE_API.md js/phys/MODULE_API.md
REV=$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unknown)
echo "vendored from sinerally-physics@$REV on $(date +%F)" > js/phys/VERSION
echo "physics synced @$REV"

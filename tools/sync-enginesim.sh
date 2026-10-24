#!/bin/sh
# Vendor the Engine Sim sound plugin from the leck-games/sinerally-enginesim repo (its single source of truth).
# usage: tools/sync-enginesim.sh [path-to-engine-sim-checkout]   (default ../engine-sim)
set -e
SRC=${1:-../engine-sim}; DST=$(dirname "$0")/../plugins/enginesim
for f in plugin.js engine-sim.js engine-dsp.js engine-config.js motor.js; do cp "$SRC/js/$f" "$DST/$f"; done
echo "vendored from leck-games/sinerally-enginesim@$(git -C "$SRC" rev-parse --short HEAD) on $(date -u +%F)" > "$DST/VERSION"
cat "$DST/VERSION"

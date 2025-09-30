#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export STATLITE_DATA="${STATLITE_DATA:-$DIR/data}"
PORT_ARG=""
if [[ -n "${PORT:-}" ]]; then PORT_ARG="--port=$PORT"; fi
if [[ -n "${STATLITE_PORT:-}" ]]; then PORT_ARG="--port=$STATLITE_PORT"; fi
node "$DIR/server/index.js" $PORT_ARG "$@"

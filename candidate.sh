#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -eq 1 && ( "$1" == "--help" || "$1" == "-h" ) ]]; then
  echo "Usage: ./candidate.sh [CANDIDATE]"
  exit 0
fi

if [[ $# -gt 1 || $# -eq 1 && "$1" != "CANDIDATE" ]]; then
  echo "Usage: ./candidate.sh [CANDIDATE]" >&2
  exit 2
fi

exec bash "$SCRIPT_DIR/cfd-xau_update.sh" CANDIDATE

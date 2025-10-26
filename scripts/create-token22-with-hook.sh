#!/usr/bin/env bash
set -euo pipefail
if [ -z "${HOOK_PROGRAM_ID:-}" ]; then echo "Set HOOK_PROGRAM_ID to your deployed program id"; exit 1; fi
TOKEN22_ID=TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
MINT=$(spl-token --program-id $TOKEN22_ID create-token --transfer-hook $HOOK_PROGRAM_ID | awk '/Creating token/ {print $3}')
echo "Mint: $MINT"
echo "REMEMBER: Register Transfer Hook Extra Metas for this mint:"
echo "  - config PDA (seed 'config')"
echo "  - auth PDA   (seed 'auth')"

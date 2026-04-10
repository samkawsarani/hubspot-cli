#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

rm -rf dist
mkdir -p dist

echo "Compiling library to dist/lib …"
bun x tsc -p tsconfig.build.json

mkdir -p dist/skills/hubspot
cp skills/hubspot/SKILL.md dist/skills/hubspot/SKILL.md

echo "Bundling CLI to dist/hubspot.js …"
bun build src/cli.ts --outfile dist/hubspot.js --target node

# Bun may inject its own shebang; strip it so we don't end up with two (Node ESM only strips the first line).
if [[ "$(head -c2 dist/hubspot.js 2>/dev/null)" == '#!' ]]; then
  tail -n +2 dist/hubspot.js > dist/hubspot.body
  mv dist/hubspot.body dist/hubspot.js
fi

# Single shebang for direct execution
printf '#!/usr/bin/env node\n' | cat - dist/hubspot.js > dist/hubspot.tmp
mv dist/hubspot.tmp dist/hubspot.js
chmod +x dist/hubspot.js

echo "Built dist/lib and dist/hubspot.js"

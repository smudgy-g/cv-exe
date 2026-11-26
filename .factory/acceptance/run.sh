#!/usr/bin/env bash
# Acceptance for cv-exe: the pushed commit must produce a working production build, from nothing but the commit
# itself and pre-staged dependencies. No network, no database, no secrets — so this proves the thing unit tests
# cannot: that the app as a whole still builds and the client bundle and server routes are emitted.
#
# $PROJECT_ARCHIVE is the exact pushed commit; $ASSETS holds Node and a pnpm store (.factory/build-assets.sh).
set -euo pipefail

work=$(mktemp -d "${TMPDIR:-/tmp}/acceptance-XXXXXX")
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/node" "$work/deps" "$work/project"

tar -xzf "$ASSETS/node-linux-x64.tar.gz" -C "$work/node" --strip-components=1
tar -xzf "$ASSETS/pnpm-store.tar.gz" -C "$work/deps"
tar -xf "$PROJECT_ARCHIVE" -C "$work/project"
export PATH="$work/node/bin:$PATH"
cd "$work/project"

verdict() { # pass detail
  node -e 'process.stdout.write(JSON.stringify({commit:process.env.COMMIT,pass:process.argv[1]==="true",detail:process.argv[2].slice(-400)})+"\n")' "$1" "$2"
  exit 0
}

pnpm() { "$ASSETS/pnpm/pnpm" --store-dir "$work/deps/store" --cache-dir "$work/deps/cache" "$@"; }
echo "node $(node -v), pnpm $(pnpm --version), commit $COMMIT on $REF" >&2

if ! out=$(pnpm install --frozen-lockfile --offline 2>&1); then
  echo "$out" >&2
  verdict false "Dependencies would not install offline: $(echo "$out" | tail -3 | tr '\n' ' ')"
fi

# SvelteKit validates its server environment at build time. These are obvious non-secrets: the build only checks
# their shape, and nothing here connects to anything (the sandbox has no network).
export DATABASE_URL="postgres://acceptance:acceptance@127.0.0.1:5432/acceptance"
export NEON_AUTH_BASE_URL="http://127.0.0.1:9999"
export OPENROUTER_API_KEY="acceptance-not-a-real-key"
export NEON_AUTH_COOKIE_SECRET="acceptance-only-placeholder-secret-0000"

if ! out=$(pnpm run build 2>&1); then
  echo "$out" >&2
  verdict false "Production build failed: $(echo "$out" | tail -5 | tr '\n' ' ')"
fi
echo "$out" >&2

# A build that emits nothing is not a build: insist on the server entry and at least one client asset.
built=$(find .svelte-kit/output -type f \( -name '*.js' -o -name '*.css' \) 2>/dev/null | wc -l)
[ -f .svelte-kit/output/server/index.js ] && [ "$built" -gt 10 ] ||
  verdict false "The build produced no usable output ($built files, server entry $([ -f .svelte-kit/output/server/index.js ] && echo present || echo missing))"

verdict true "Production build succeeded from the pushed commit: $built files emitted, server entry present"

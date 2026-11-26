#!/usr/bin/env bash
# Stages what the offline acceptance sandbox needs: it has no network, so Node and every dependency must be
# pre-fetched. Run this when the lockfile or the Node version changes. Output is gitignored.
set -euo pipefail
cd "$(dirname "$0")/.."
assets=.factory/assets
mkdir -p "$assets"

node_version=$(sed -n 's/^ *node *= *"\([0-9][^"]*\)".*/\1/p' mise.toml 2>/dev/null | head -1)
[ -n "$node_version" ] || node_version=24.21.0
[ -f "$assets/node-linux-x64.tar.gz" ] ||
  curl -fsSL "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.gz" -o "$assets/node-linux-x64.tar.gz"

# pnpm itself has to be staged too: the sandbox has no registry to install it from.
pnpm_version=$(node -p "require('./package.json').packageManager.split('@').pop()")
# The native executable, not the npm wrapper: the wrapper downloads it on first use, and there is no registry.
if [ "$(node -p "try{require('./$assets/pnpm/package.json').name}catch{''}" )" != "@pnpm/exe.linux-x64" ]; then
  rm -rf "$assets/pnpm"
  mkdir -p "$assets/pnpm"
  tarball=$(cd "$assets" && npm pack --silent "@pnpm/exe.linux-x64@$pnpm_version")
  tar -xzf "$assets/$tarball" -C "$assets/pnpm" --strip-components=1
  rm -f "$assets/$tarball"
  chmod +x "$assets/pnpm/pnpm"
fi

# `pnpm fetch` reads only the lockfile, so the store holds exactly what this commit installs. The metadata cache
# travels with it: offline installs still resolve against it, and it lives outside the store.
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
"$assets/pnpm/pnpm" --store-dir "$work/store" --cache-dir "$work/cache" fetch >/dev/null
tar -czf "$assets/pnpm-store.tar.gz" -C "$work" store cache
ls -la "$assets"

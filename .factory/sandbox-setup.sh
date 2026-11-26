#!/usr/bin/env bash
# Puts this project's toolchain in the sandbox: the kit image carries no Node. Factory-owned (`.factory` is
# protected), so a task cannot change how its own checks are run.
#
# Versions come from the repository, never from here: pnpm from package.json's packageManager, Node from
# mise.toml, .nvmrc or engines.node. The fallback is only used when the repo pins nothing.
set -euo pipefail

node_version=$(
  sed -n 's/^ *node *= *"\([0-9][^"]*\)".*/\1/p' mise.toml 2>/dev/null | head -1
)
[ -n "$node_version" ] || node_version=$(tr -d 'v \n' < .nvmrc 2>/dev/null || true)
[ -n "$node_version" ] || node_version=$(node -p "(require('./package.json').engines?.node||'').match(/[0-9]+(\.[0-9]+){2}/)?.[0]||''" 2>/dev/null || true)
# Node 26 needs libatomic, which this kit image does not have; 24 runs as shipped.
[ -n "$node_version" ] || node_version=24.21.0

if [ "$("$HOME/node/bin/node" -v 2>/dev/null)" != "v$node_version" ]; then
  curl -fsSL "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.gz" -o /tmp/node.tgz
  rm -rf "$HOME/node" && mkdir -p "$HOME/node"
  tar -xzf /tmp/node.tgz -C "$HOME/node" --strip-components=1
fi
export PATH="$HOME/node/bin:$PATH"

# Corepack is gone in current Node, so install the pinned pnpm with npm.
pnpm_version=$(node -p "(require('./package.json').packageManager||'pnpm@latest').split('@').pop()")
# --prefix keeps pnpm beside node, so one PATH entry covers the whole toolchain.
[ "$("$HOME/node/bin/pnpm" --version 2>/dev/null)" = "$pnpm_version" ] || npm install -g --silent --prefix "$HOME/node" "pnpm@$pnpm_version"

pnpm install --frozen-lockfile

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUN_VERSION="${BUN_VERSION:-1.3.14}"
BUN_INSTALL="${ROOT}/.tools/bun"
BUN_BIN="${BUN_INSTALL}/bin/bun"

usage() {
  cat <<'EOF'
Bootstrap Mneme's repository-local build toolchain.

Usage:
  bash script/bootstrap.sh          Install Bun and workspace dependencies.
  bash script/bootstrap.sh --check  Verify that the local Bun is available.
EOF
}

case "${1:-}" in
  "") ;;
  --check)
    if [[ ! -x "$BUN_BIN" ]]; then
      echo "Mneme's repository-local Bun is not installed: $BUN_BIN" >&2
      exit 1
    fi
    exec "$BUN_BIN" --version
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown option: $1" >&2
    usage >&2
    exit 2
    ;;
esac

if [[ ! -x "$BUN_BIN" ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install the repository-local Bun toolchain" >&2
    exit 1
  fi

  mkdir -p "$BUN_INSTALL"
  echo "Installing Bun ${BUN_VERSION} into ${BUN_INSTALL}"
  curl -fsSL https://bun.com/install | BUN_INSTALL="$BUN_INSTALL" bash -s -- "bun-v${BUN_VERSION}" --skip-rc
fi

"$BUN_BIN" install --frozen-lockfile

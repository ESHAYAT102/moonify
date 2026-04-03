#!/usr/bin/env bash

set -euo pipefail

PACKAGE_NAME="${PACKAGE_NAME:-@esyt/moonify}"
BUN_DIR="${BUN_INSTALL:-$HOME/.bun}"

log() {
  printf '%s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

ensure_supported_platform() {
  case "$(uname -s)" in
    Linux|Darwin) ;;
    *)
      fail "this installer currently supports Linux and macOS only."
      ;;
  esac
}

install_bun() {
  ensure_supported_platform

  log "Bun was not found. Installing Bun first..."

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://bun.sh/install | bash
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://bun.sh/install | bash
  else
    fail "neither curl nor wget is available, so Bun cannot be installed automatically."
  fi

  export BUN_INSTALL="$BUN_DIR"
  export PATH="$BUN_DIR/bin:$PATH"

  if ! command -v bun >/dev/null 2>&1; then
    fail "Bun installation completed, but 'bun' is still not on PATH. Restart your shell or add $BUN_DIR/bin to PATH and rerun this script."
  fi
}

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    return
  fi

  install_bun
}

main() {
  ensure_bun

  log "Installing ${PACKAGE_NAME} globally..."
  bun install -g "$PACKAGE_NAME"

  log ""
  log "Moonify is installed."
  log "Run it with: moonify"
}

main "$@"

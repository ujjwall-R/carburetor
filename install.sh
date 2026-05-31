#!/usr/bin/env sh
# Install script for megalodon.
# Upload this file as a GitHub Release asset alongside the binaries so users can run:
#   curl -fsSL https://github.com/ujjwall-R/megalodon/releases/latest/download/install.sh | sh
set -e

REPO="ujjwall-R/megalodon"
BINARY="meg"
INSTALL_DIR="/usr/local/bin"

# ── Colour helpers ─────────────────────────────────────────────────────────────
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n'  "$*"; }
bold()  { printf '\033[1m%s\033[0m\n'  "$*"; }

# ── Detect OS ──────────────────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)
      red "Unsupported OS: $(uname -s)"
      exit 1
      ;;
  esac
}

# ── Detect architecture ────────────────────────────────────────────────────────
detect_arch() {
  case "$(uname -m)" in
    arm64|aarch64) echo "arm64" ;;
    x86_64|amd64)  echo "x64"   ;;
    *)
      red "Unsupported architecture: $(uname -m)"
      exit 1
      ;;
  esac
}

# ── Resolve latest release tag from GitHub ────────────────────────────────────
latest_version() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed 's/.*"tag_name": *"\(.*\)".*/\1/'
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  bold ""
  bold "  meg installer"
  dim  "  https://github.com/${REPO}"
  bold ""

  OS="$(detect_os)"
  ARCH="$(detect_arch)"
  VERSION="${VERSION:-$(latest_version)}"

  if [ -z "$VERSION" ]; then
    red "Could not resolve latest release. Set VERSION manually:"
    red "  VERSION=v1.0.0 sh install.sh"
    exit 1
  fi

  ASSET="${BINARY}-${OS}-${ARCH}"
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"

  dim "  OS      : ${OS}"
  dim "  Arch    : ${ARCH}"
  dim "  Version : ${VERSION}"
  dim "  Binary  : ${ASSET}"
  printf "\n"

  # ── Download ────────────────────────────────────────────────────────────────
  TMP="$(mktemp)"
  printf "  Downloading... "

  if ! curl -fsSL "$URL" -o "$TMP"; then
    printf "\n"
    red "Download failed. Check that release ${VERSION} exists:"
    red "  https://github.com/${REPO}/releases"
    rm -f "$TMP"
    exit 1
  fi

  printf "done\n"
  chmod +x "$TMP"

  # ── Install ─────────────────────────────────────────────────────────────────
  TARGET="${INSTALL_DIR}/${BINARY}"

  if [ ! -w "$INSTALL_DIR" ]; then
    printf "  Installing to %s (sudo required)... " "$INSTALL_DIR"
    sudo mv "$TMP" "$TARGET"
  else
    printf "  Installing to %s... " "$INSTALL_DIR"
    mv "$TMP" "$TARGET"
  fi

  printf "done\n\n"

  # ── Verify ──────────────────────────────────────────────────────────────────
  if ! command -v "$BINARY" > /dev/null 2>&1; then
    red "Installed but '${BINARY}' not found in PATH."
    red "Add ${INSTALL_DIR} to your PATH and try again."
    exit 1
  fi

  green "  meg ${VERSION} installed successfully."
  printf "\n"
  dim  "  Run the interactive wizard:"
  bold "    meg deploy --interactive"
  printf "\n"
  dim  "  Or use directly in CI/scripts:"
  bold "    meg deploy"
  printf "\n"
}

main "$@"

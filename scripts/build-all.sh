#!/usr/bin/env bash
<<<<<<< HEAD
# Build carburetor binaries for all platforms from any host OS.
=======
# Build carborator binaries for all platforms from any host OS.
>>>>>>> main
set -euo pipefail

sign_macos() {
  local OUTFILE="$1"
  local ENTITLEMENTS
<<<<<<< HEAD
  ENTITLEMENTS="$(mktemp /tmp/carburetor-entitlements.XXXX.plist)"
=======
  ENTITLEMENTS="$(mktemp /tmp/carborator-entitlements.XXXX.plist)"
>>>>>>> main

  cat > "$ENTITLEMENTS" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
EOF

  codesign --remove-signature "$OUTFILE" 2>/dev/null || true
  codesign --force -s - --entitlements "$ENTITLEMENTS" "$OUTFILE"
  rm -f "$ENTITLEMENTS"
}

build() {
  local TARGET="$1"
  local FOLDER="$2"
  local NAME="$3"
  local SIGN="${4:-false}"
  local OUTFILE="dist/$FOLDER/$NAME"

  mkdir -p "dist/$FOLDER"
  echo "  → building $OUTFILE..."
  bun build --compile --minify --target="$TARGET" --outfile "$OUTFILE" src/index.ts

  if [[ "$SIGN" == "true" ]] && command -v codesign &>/dev/null; then
    sign_macos "$OUTFILE"
    echo "  ✓ built + signed $OUTFILE"
  else
    echo "  ✓ built $OUTFILE"
  fi
}

<<<<<<< HEAD
build bun-darwin-arm64  macos-arm64  carburetor      true
build bun-darwin-x64    macos-x64    carburetor      true
build bun-linux-arm64   linux-arm64  carburetor      false
build bun-linux-x64     linux-x64    carburetor      false
build bun-windows-x64   windows-x64  carburetor.exe  false
=======
build bun-darwin-arm64  macos-arm64  carborator      true
build bun-darwin-x64    macos-x64    carborator      true
build bun-linux-arm64   linux-arm64  carborator      false
build bun-linux-x64     linux-x64    carborator      false
build bun-windows-x64   windows-x64  carborator.exe  false
>>>>>>> main

echo ""
echo "Binaries written to dist/:"
ls -lh dist/*/

#!/usr/bin/env bash
# Ad-hoc sign a Bun compiled binary on macOS so Gatekeeper doesn't kill it.
# On Linux this is a no-op — no signing required.
set -euo pipefail

BINARY="${1:?Usage: sign.sh <binary>}"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "  ✓ sign: skipped (non-macOS)"
  exit 0
fi

ENTITLEMENTS="$(mktemp /tmp/megalodon-entitlements.XXXX.plist)"
trap 'rm -f "$ENTITLEMENTS"' EXIT

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

codesign --remove-signature "$BINARY" 2>/dev/null || true
codesign --force -s - --entitlements "$ENTITLEMENTS" "$BINARY"
echo "  ✓ sign: ad-hoc signed $BINARY"

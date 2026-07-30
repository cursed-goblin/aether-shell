#!/usr/bin/env bash
# Verify build + runtime dependencies before bundling or installing.
set -euo pipefail

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

missing=0

require() {
  if command -v "$1" >/dev/null 2>&1; then
    green "  ok      $1"
  else
    red   "  MISSING $1  - $2"
    missing=1
  fi
}

optional() {
  if command -v "$1" >/dev/null 2>&1; then
    green "  ok      $1"
  else
    yellow "  skip    $1  - $2"
  fi
}

require_lib() {
  if pkg-config --exists "$1" 2>/dev/null; then
    green "  ok      $1"
  else
    red   "  MISSING $1  - $2"
    missing=1
  fi
}

echo "Required"
require gjs               "GNOME JavaScript runtime"
require ags               "Astal/AGS CLI (aylurs-gtk-shell)"
require astal             "Astal IPC client"
require curl              "HTTP transport for the AI backend"

echo "Required libraries"
require_lib gtk4                    "GTK 4"
require_lib gtk4-layer-shell-0      "panels/overlays on Wayland"
require_lib astal-io-0.1            "astal core"

echo "Optional (features degrade gracefully)"
optional jq            "CLI config editing in 'aether-shell setup'"
optional secret-tool   "store API keys in the system keyring"
optional wl-paste      "{{clipboard}} prompt token"
optional brightnessctl "brightness slider + OSD"
optional wlsunset      "night light toggle"
optional hyprctl       "workspaces module + blur check"

echo
if [ "$missing" -ne 0 ]; then
  red "Missing required dependencies."
  cat <<'EOF'

Arch / CachyOS:
  sudo pacman -S gjs gtk4 gtk4-layer-shell curl jq libsecret
  # Astal + AGS from the AUR:
  paru -S aylurs-gtk-shell-git libastal-meta

Fedora:
  sudo dnf install gjs gtk4-devel gtk4-layer-shell-devel curl jq libsecret
  # then build Astal from source: https://aylur.github.io/astal

NixOS:
  nix run .#  (the flake pulls everything in)
EOF
  exit 1
fi

green "All required dependencies present."

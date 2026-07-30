# Maintainer: your name <you@example.com>
pkgname=aether-shell
pkgver=0.1.0
pkgrel=1
pkgdesc="Glassmorphic GTK4/Wayland desktop shell with an API-key driven AI agent (Grok, GPT, Claude, local)"
arch=('any')
url="https://github.com/cursed-goblin/aether-shell"
license=('MIT')
depends=(
  'gjs'
  'gtk4'
  'gtk4-layer-shell'
  'libastal-meta'
  'aylurs-gtk-shell-git'
  'curl'
  'libsecret'
)
optdepends=(
  'jq: CLI config editing via `aether-shell setup`'
  'brightnessctl: brightness slider and OSD'
  'wl-clipboard: {{clipboard}} prompt token'
  'wlsunset: night light toggle'
  'hyprland: workspace module, blur layer rules'
  'inter-font: default UI font'
  'ttf-jetbrains-mono: default mono font'
)
makedepends=('npm' 'dart-sass')
source=("$pkgname-$pkgver.tar.gz::$url/archive/refs/tags/v$pkgver.tar.gz")
sha256sums=('SKIP')

build() {
  cd "$srcdir/$pkgname-$pkgver"
  npm install --no-audit --no-fund
  ags bundle app.ts dist/aether-shell --gtk4
}

package() {
  cd "$srcdir/$pkgname-$pkgver"
  make DESTDIR="$pkgdir" PREFIX=/usr install
}

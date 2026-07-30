# Installation

## Requirements

**A Wayland compositor that supports layer-shell.** Hyprland is the reference target.
Sway, river, niri and Wayfire all work; on non-Hyprland compositors the workspaces
module falls back to a static indicator and blur depends on what your compositor offers.

GNOME (Mutter) and KDE (KWin) do **not** allow layer-shell surfaces from third parties.
This shell will not run there.

| Package | Why |
|---|---|
| `gjs` | JS runtime |
| `gtk4` | toolkit |
| `gtk4-layer-shell` | anchors panels to screen edges |
| Astal + AGS | widget framework and CLI |
| `curl` | AI transport |
| `libsecret` | keyring for API keys |

Optional: `jq`, `brightnessctl`, `wl-clipboard`, `wlsunset`, Inter and JetBrains Mono fonts.

Run `./scripts/check-deps.sh` at any point \u2014 it prints exactly what is missing and the
command to install it.

---

## Arch / CachyOS / EndeavourOS

```bash
sudo pacman -S gjs gtk4 gtk4-layer-shell curl jq libsecret \\
               brightnessctl wl-clipboard inter-font ttf-jetbrains-mono
paru -S aylurs-gtk-shell-git libastal-meta

git clone https://github.com/cursed-goblin/aether-shell
cd aether-shell
chmod +x bin/aether-shell scripts/check-deps.sh
npm install
sudo make install
```

Or build the package: `makepkg -si`.

## Fedora

```bash
sudo dnf install gjs gtk4-devel gtk4-layer-shell-devel curl jq libsecret \\
                 brightnessctl wl-clipboard meson ninja-build vala
```

Astal has no Fedora package yet \u2014 build it from source
(<https://aylur.github.io/astal/guide/getting-started/installation>), then
`npm install && sudo make install` here.

## Nix / NixOS

```bash
nix run github:cursed-goblin/aether-shell
```

Home Manager:

```nix
{
  inputs.aether.url = "github:cursed-goblin/aether-shell";

  # in your home config
  imports = [ inputs.aether.homeManagerModules.default ];
  programs.aether-shell = {
    enable = true;
    settings.ai.provider = "xai";
  };
}
```

## Debian / Ubuntu

`gtk4-layer-shell` and Astal both need building on anything older than 24.04. Doable,
but budget an evening. `apt install gjs libgtk-4-dev curl jq libsecret-1-0` first.

---

## After installing

```bash
aether-shell setup     # store your API key
aether-shell doctor    # verify everything, including compositor blur
```

Add to `~/.config/hypr/hyprland.conf`:

```conf
source = /usr/share/aether-shell/config/hyprland/blur.conf
source = /usr/share/aether-shell/config/hyprland/keybinds.conf
```

`blur.conf` is not optional if you want the glass to look like glass \u2014 GTK cannot blur
its own background.

Start it:

```bash
systemctl --user enable --now aether-shell
```

Or, if you would rather the compositor own the process, drop the systemd unit and keep
the `exec-once = aether-shell` line from `keybinds.conf`.

---

## Running from source

```bash
git clone https://github.com/cursed-goblin/aether-shell
cd aether-shell
chmod +x bin/aether-shell scripts/check-deps.sh
npm install
export XAI_API_KEY=xai-...
ags run . --gtk4
```

Nothing is installed system-wide, and it reads `./config/default.json` instead of the
installed copy. `Super+Shift+R` reloads config and stylesheet in place.

---

## Uninstall

```bash
sudo make uninstall
```

Removes every installed file and disables the service. Your config and keys in
`~/.config/aether` are deliberately left behind \u2014 delete that directory yourself if you
want them gone.

---

## When it doesn't start

| Symptom | Fix |
|---|---|
| `namespace not found: Astal` | Astal libraries not installed or not in `GI_TYPELIB_PATH` |
| Nothing appears, no error | not a layer-shell compositor \u2014 GNOME/KDE will not work |
| Panels are flat grey | compositor blur off; source `blur.conf` |
| Fonts look wrong | install Inter and JetBrains Mono, or change them in `config.json` |
| Icons missing | install a symbolic icon theme, e.g. `papirus-icon-theme` |

Logs: `journalctl --user -u aether-shell -f`

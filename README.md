<div align="center">

# Aether Shell

**A glassmorphic desktop shell for Wayland, with a bring-your-own-key AI agent built in.**

GTK4 \u00b7 gtk4-layer-shell \u00b7 Astal/AGS \u00b7 TypeScript \u00b7 SCSS

<img src="assets/screenshots/overview.png" width="860">

</div>

---

Aether is a full desktop shell \u2014 top bar, dock, app launcher, control center, notifications,
volume/brightness OSD \u2014 plus an AI panel that talks to whichever provider you have a key
for. Nothing is hardcoded to a vendor: xAI (Grok), OpenAI, Anthropic, Gemini, Groq,
OpenRouter, DeepSeek, Mistral, or a local Ollama / llama.cpp server. Default is `grok-4`.

It is a *shell*, not a theme. It replaces your panel and launcher; it does not replace your
compositor. Hyprland is the reference target.

---

## What's in it

| Surface | What it does |
|---|---|
| **Bar** | logo, Hyprland workspaces, active window, clock, system tray, network/bluetooth/volume indicators, battery, power menu |
| **Dock** | pinned + running apps, autohide, running-app underline |
| **Launcher** | fuzzy app search; prefix a query with `?` to send it to the agent instead |
| **Aether AI** | streaming chat panel, model switcher, quick actions, cancellable requests |
| **Control Center** | Wi-Fi / Bluetooth / Night Light / DND tiles, brightness + volume sliders, live CPU / memory / disk / network monitor |
| **Notifications** | glass popups with actions, urgency styling, auto-dismiss |
| **OSD** | volume and brightness overlay |

Every surface is one folder under `widget/`, one partial under `style/`, and one entry in
`app.ts`. Delete a folder and only that surface disappears.

---

## Requirements

A Wayland compositor that supports **layer-shell**. Hyprland is the reference; Sway, river,
niri and Wayfire work. **GNOME and KDE do not** \u2014 Mutter and KWin refuse third-party
layer-shell surfaces, and no amount of configuration changes that.

`gjs`, `gtk4`, `gtk4-layer-shell`, Astal + AGS, `curl`, `libsecret`.
Optional: `jq`, `brightnessctl`, `wl-clipboard`, `wlsunset`, Inter, JetBrains Mono.

`./scripts/check-deps.sh` tells you exactly what is missing.

---

## Install

```bash
git clone https://github.com/cursed-goblin/aether-shell
cd aether-shell
chmod +x bin/aether-shell scripts/check-deps.sh   # the API upload drops the +x bit
npm install
sudo make install
```

Arch users can `makepkg -si` instead. Nix users: `nix run github:cursed-goblin/aether-shell`.

Full per-distro instructions: **[docs/INSTALL.md](docs/INSTALL.md)**

---

## Set up (do these three things)

### 1. Give it a key

```bash
aether-shell setup
```

Stores the key in your keyring via `secret-tool`, falling back to
`~/.config/aether/secrets.json` with mode `600`. You can also just export an env var:

```bash
export XAI_API_KEY=xai-...        # or OPENAI_API_KEY, ANTHROPIC_API_KEY, ...
```

Keys are never written to `config.json`, never passed on the command line, and never
logged unmasked.

### 2. Turn on compositor blur \u2014 this is not optional

```conf
# ~/.config/hypr/hyprland.conf
source = /usr/share/aether-shell/config/hyprland/blur.conf
source = /usr/share/aether-shell/config/hyprland/keybinds.conf
```

> **GTK4 CSS has no `backdrop-filter`.** The glass effect is a translucent fill plus a lit
> 1px lip; the actual blur comes from the compositor. Skip `blur.conf` and every panel
> renders as a flat grey box. This is the single most common "it looks broken" report.

### 3. Start it

```bash
systemctl --user enable --now aether-shell
aether-shell doctor    # verifies deps, keys (masked), and whether blur is actually on
```

---

## Keybinds

| Key | Action |
|---|---|
| `Super + Space` | app launcher |
| `Super + A` | Aether AI panel |
| `Super + C` | control center |
| `Super + Q` | explain clipboard contents with the agent |
| `Super + Shift + R` | reload config and stylesheet in place |

From a script or another bind:

```bash
astal -i aether toggle launcher
astal -i aether ai "why is my boot slow?"
aether-shell reload
```

---

## Configure

One file, deep-merged over the defaults, watched and hot-reloaded:

```
~/.config/aether/config.json
```

Accent colour, surface opacity, radius, fonts, bar module order, pinned dock apps,
notification timeouts, AI provider/model/prompt \u2014 all of it.
Malformed JSON keeps the last good config instead of dropping you to a blank desktop.

**[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** \u00b7 **[docs/THEMING.md](docs/THEMING.md)** \u00b7 **[docs/AI.md](docs/AI.md)**

---

## Structure

```
app.ts                  entry point, window registration
service/                state and I/O - AI, config, providers, secrets, system stats
widget/                 one folder per surface, rendering only
style/                  _variables.scss holds every token; nothing else has a hex code
config/                 default.json + hyprland blur and keybind snippets
bin/aether-shell        CLI: run | setup | doctor | ai | toggle | reload | quit
scripts/check-deps.sh   dependency doctor
```

Two rules keep it maintainable: **services own state, widgets only render**, and
**no colour exists outside `style/_variables.scss`**.

---

## Contributing

**[CONTRIBUTING.md](CONTRIBUTING.md)** \u2014 house rules, how to add a surface, how to add an
AI provider (usually one object), and the non-negotiable rules for anything touching keys.

## License

MIT.

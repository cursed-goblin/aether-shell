# Contributing

## Setup

```bash
git clone https://github.com/cursed-goblin/aether-shell
cd aether-shell
chmod +x bin/aether-shell scripts/check-deps.sh
npm install
./scripts/check-deps.sh
export XAI_API_KEY=xai-...        # or any provider key
ags run . --gtk4
```

Running from source reads `./config/default.json` instead of the installed copy, so you
can break things without touching your real setup. `Super+Shift+R` reloads config and CSS
in place.

## Before opening a PR

```bash
make check      # dependency check + typecheck
make fmt        # prettier over ts/tsx/scss/json/md
```

## House rules

These are the four things that keep the codebase from turning into a pile of dotfiles:

1. **One folder per surface.** Deleting `widget/dock/` should remove the dock and break
   nothing else.
2. **Services own state and I/O. Widgets render.** A widget must never poll, shell out on
   a timer, or make a network call. If you need data, add it to `service/`.
3. **No hex codes outside `style/_variables.scss`.** Component partials use tokens and
   mixins only. If you need a new colour, it becomes a token.
4. **No hardcoded paths.** Everything user-facing resolves under `$XDG_CONFIG_HOME/aether/`.

## Adding a new surface

1. `widget/yourthing/YourThing.tsx`, returning a `<window>` with a unique
   `name=` and `namespace="aether-yourthing"`.
2. Register it in `app.ts` under `main()`.
3. `style/_yourthing.scss`, using `@include glass` \u2014 then `@use "yourthing";` in `main.scss`.
4. **Add both layer rules** to `config/hyprland/blur.conf`:
   ```conf
   layerrule = blur, aether-yourthing
   layerrule = ignorealpha 0.2, aether-yourthing
   ```
   Forgetting this is the single most common mistake \u2014 the surface will render as a flat
   grey box and look broken.

## Adding an AI provider

One object in `service/providers.ts`. If it speaks the OpenAI wire format, that is the
whole change \u2014 streaming, cancellation and error handling are already generic. Add the
row to the table in `docs/AI.md` too.

## Security rules for anything touching keys

Non-negotiable, because these are the mistakes that leak people's credentials:

- Never put a key in `argv`. It shows up in `ps aux` for every user on the machine.
  Use the temp-header-file pattern already in `service/ai.ts`.
- Never write a key to `config.json`. That is the file people paste into issues.
- Never log a raw key. Use `maskKey()`.
- Never add a key to the systemd unit. `systemctl --user show` prints `Environment=`.

## Commits

Conventional-ish prefixes: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`.
One logical change per commit.

## Bug reports

Include the output of `aether-shell doctor` and `journalctl --user -u aether-shell -n 50`.
Strip anything that looks like a key before pasting, even though `doctor` already masks them.

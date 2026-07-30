# Configuration

Everything lives in one file:

```
~/.config/aether/config.json
```

It is deep-merged over `config/default.json`, so you only write the keys you want to
change. The file is watched \u2014 save it and the shell reloads. Installing or upgrading
never touches it.

Validate before saving if you like: `jq . ~/.config/aether/config.json`

---

## theme

```jsonc
{
  "theme": {
    "accent": "#7aa8ff",
    "accent2": "#a98bf5",       // second stop of every gradient
    "surfaceOpacity": 0.55,     // 0.35 heavy blur \u2192 0.80 nearly solid
    "radius": 14,
    "font": "Inter",
    "monoFont": "JetBrains Mono"
  }
}
```

These are injected as GTK custom properties at runtime, so they apply without
recompiling SCSS. Anything deeper than these five knobs belongs in
`style/_variables.scss` \u2014 see [THEMING.md](THEMING.md).

---

## bar

```jsonc
{
  "bar": {
    "position": "top",          // top | bottom
    "height": 40,
    "left":   ["logo", "workspaces"],
    "center": ["clock"],
    "right":  ["tray", "indicators", "battery", "power"]
  }
}
```

Available modules: `logo`, `workspaces`, `activeWindow`, `clock`, `tray`, `indicators`,
`battery`, `power`. Order in the array is order on screen. Remove a name and the module
is gone \u2014 nothing else breaks.

---

## dock

```jsonc
{
  "dock": {
    "enabled": true,
    "pinned": ["firefox", "kitty", "code", "nautilus"],
    "iconSize": 26,
    "autohide": true,           // false reserves screen space
    "onlyPrimaryMonitor": true
  }
}
```

`pinned` entries are fuzzy-matched against `.desktop` files, so `code` finds VS Code.
Running apps get an accent underline.

---

## launcher

```jsonc
{
  "launcher": {
    "maxResults": 8,
    "askAiPrefix": "?"          // leading char that routes the query to the agent
  }
}
```

---

## notifications

```jsonc
{
  "notifications": {
    "timeout": 5000,
    "maxPopups": 4,
    "position": "top-right"
  }
}
```

Critical-urgency notifications get a red border and are worth not filtering.

---

## ai

See [AI.md](AI.md) for the full picture. Short version:

```jsonc
{
  "ai": {
    "provider": "xai",
    "model": "grok-4",
    "temperature": 0.7,
    "maxTokens": 2048,
    "streaming": true,
    "historyLimit": 20,
    "systemPrompt": "You are Aether, a concise Linux desktop assistant.",
    "baseUrl": null,            // override the provider endpoint (proxies, local servers)
    "quickActions": [
      {
        "title": "Debug my system",
        "subtitle": "Read recent errors",
        "icon": "dialog-warning-symbolic",
        "prompt": "Here are my recent system errors:\\n{{journal}}\\nWhat is going wrong?"
      }
    ]
  }
}
```

**Never put an API key in this file.** Use `aether-shell setup`. Keys go to the keyring
or to `secrets.json` with mode `600`, both of which stay out of the file you are most
likely to share.

Prompt tokens usable anywhere in a prompt: `{{clipboard}}`, `{{selection}}`,
`{{journal}}`, `{{hostinfo}}`.

---

## Applying changes

| | |
|---|---|
| Save the file | auto-reload |
| `Super + Shift + R` | manual reload |
| `aether-shell reload` | same, from a script |
| `systemctl --user restart aether-shell` | full restart, rarely needed |

If the JSON is malformed the shell keeps the last good config, logs the parse error, and
keeps running. It will not leave you staring at a blank desktop.

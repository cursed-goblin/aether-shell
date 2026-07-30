# Theming

Two levels. Pick the shallow one first.

---

## Level 1 \u2014 config.json (no rebuild)

```jsonc
{
  "theme": {
    "accent": "#7aa8ff",
    "accent2": "#a98bf5",
    "surfaceOpacity": 0.55,
    "radius": 14,
    "font": "Inter",
    "monoFont": "JetBrains Mono"
  }
}
```

Injected as GTK custom properties at runtime. Save, and the shell restyles itself.
This covers 90% of what people actually want to change.

---

## Level 2 \u2014 style/_variables.scss (fork territory)

Every colour, radius, shadow and type size in the shell resolves from this one file.
No component file contains a hex code. Change a token, every surface follows.

```scss
$glass-alpha:       0.55;   // base surface translucency
$glass-alpha-heavy: 0.68;   // panels that need readable text over busy wallpaper
$glass-alpha-light: 0.40;   // the bar

$border:    rgba(255, 255, 255, 0.14);
$highlight: rgba(255, 255, 255, 0.18);  // the inner top edge - the "lit lip" of the pane

$radius:    14px;
$shadow-lg: 0 18px 48px rgba(0, 0, 0, 0.42);
```

Then `aether-shell reload` (SCSS compiles at startup).

---

## How the glass is built

Four ingredients, three of which are in `style/_glass.scss`:

```scss
@mixin glass($alpha: $glass-alpha, $radius-size: $radius) {
  background-color: rgba(22, 20, 40, $alpha);   // 1. translucent fill
  border: 1px solid $border;                    // 2. hairline edge
  border-radius: $radius-size;
  box-shadow:
    inset 0 1px 0 $highlight,                   // 3. the lit top lip
    $shadow-sm,
    $shadow-lg;                                 //    depth
}
```

The fourth is **the compositor blur**, and it is not optional.

> GTK4 CSS has no `backdrop-filter`. There is no stylesheet-only way to blur what is
> behind a window. Without compositor blur these panels are just semi-transparent grey
> boxes sitting on your wallpaper.

That is what `config/hyprland/blur.conf` is for:

```conf
layerrule = blur, aether-ai
layerrule = ignorealpha 0.2, aether-ai
```

The namespace in the rule must match the `namespace=` prop on the window in
`widget/**/*.tsx`. If you add a new surface, add both.

`ignorealpha` matters more than it looks \u2014 without it the transparent padding around a
panel gets blurred too and everything turns into a smear.

Check it: `aether-shell doctor` warns if blur is off.

### Tuning the blur/opacity pair

They work against each other. Reasonable combinations:

| Look | `surfaceOpacity` | Hyprland `blur size` / `passes` |
|---|---|---|
| Frosted, heavy | 0.45 | 10 / 4 |
| Default | 0.55 | 8 / 3 |
| Subtle tint | 0.70 | 6 / 2 |
| Low-end GPU | 0.85 | blur off |

On a weak GPU, turn blur off and raise opacity instead of running 4 passes at 4K.

---

## Mixins available

| Mixin | Use for |
|---|---|
| `glass()` | any top-level surface |
| `glass-heavy()` | panels with a lot of text |
| `glass-thin()` | nested surfaces inside a panel |
| `glass-interactive()` | tiles, rows, buttons \u2014 adds hover/active |
| `glass-accent()` | the "on" state; accent-tinted glass, never flat fill |
| `accent-gradient()` | send button, orb, level bars |
| `icon-button()` | square symbolic buttons |

Rule of thumb: an active toggle should still look like glass. The moment you use a solid
fill for a selected state, the whole illusion drops.

---

## Making a light theme

Invert the surface base and flip text tokens. It is about six lines:

```scss
$glass:      rgba(250, 250, 255, 0.62);
$border:     rgba(0, 0, 0, 0.10);
$highlight:  rgba(255, 255, 255, 0.85);
$text:       #14121f;
$text-muted: rgba(20, 18, 31, 0.66);
$text-faint: rgba(20, 18, 31, 0.44);
```

Light glass needs a *lighter* border and a stronger highlight, otherwise the edges vanish.

---

## Per-surface overrides

Each surface has its own partial: `_bar.scss`, `_dock.scss`, `_launcher.scss`,
`_control-center.scss`, `_ai.scss`, `_notifications.scss`, `_osd.scss`. Edit the one you
care about; nothing else is affected.

GTK4 CSS is not web CSS. No flexbox, no grid, no `backdrop-filter`, no transitions on
every property. Layout is done in the widget tree; CSS only paints.

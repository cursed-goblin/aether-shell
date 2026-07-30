# The AI agent

The agent is a thin, provider-agnostic client. It does not ship a model, does not proxy
through anyone's server, and does not phone home. You bring a key; it makes a `curl`
request to that provider and streams the answer back into the panel.

Default provider is **xAI**, default model **grok-4**.

---

## Providers

| `provider` | Endpoint | Env var | Default model | Wire format |
|---|---|---|---|---|
| `xai` | `api.x.ai/v1` | `XAI_API_KEY` | `grok-4` | OpenAI |
| `openai` | `api.openai.com/v1` | `OPENAI_API_KEY` | `gpt-4o` | OpenAI |
| `anthropic` | `api.anthropic.com/v1` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` | Anthropic |
| `gemini` | `generativelanguage.googleapis.com` | `GEMINI_API_KEY` | `gemini-2.0-flash` | OpenAI-compatible |
| `groq` | `api.groq.com/openai/v1` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | OpenAI |
| `openrouter` | `openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | `anthropic/claude-sonnet-4` | OpenAI |
| `deepseek` | `api.deepseek.com` | `DEEPSEEK_API_KEY` | `deepseek-chat` | OpenAI |
| `mistral` | `api.mistral.ai/v1` | `MISTRAL_API_KEY` | `mistral-large-latest` | OpenAI |
| `ollama` | `localhost:11434/v1` | \u2014 (local) | `llama3.2` | OpenAI |
| `llamacpp` | `localhost:8080/v1` | \u2014 (local) | `local-model` | OpenAI |
| `custom` | set `ai.baseUrl` | `AETHER_API_KEY` | whatever you set | OpenAI |

Anything OpenAI-shaped works through `custom` with `ai.baseUrl`. Anthropic gets its own
format branch (`x-api-key`, `anthropic-version: 2023-06-01`, `/messages`).

```jsonc
{
  "ai": {
    "provider": "xai",
    "model": "grok-4",
    "streaming": true,
    "temperature": 0.7,
    "maxTokens": 2048,
    "historyLimit": 20,
    "baseUrl": null
  }
}
```

Switching provider or model from the panel's model menu writes back to `config.json`, so
it survives a restart.

---

## Where the key comes from

Resolved in this order, first hit wins:

1. **Environment variable** for the active provider (`XAI_API_KEY`, `OPENAI_API_KEY`, ...)
2. **System keyring** \u2014 `secret-tool lookup service aether-shell provider <id>`
3. **`~/.config/aether/secrets.json`**, mode `600`

```bash
aether-shell setup     # interactive: pick provider, paste key, choose storage
```

Local providers (`ollama`, `llamacpp`) need no key at all.

### How keys are handled

This part is deliberate, because it is where most shells get it wrong:

- The `Authorization` header is written to a `600` temp file and passed as `curl -H @file`.
  **The key never appears in `argv`**, so it never shows up in `ps aux` for other users.
- Keys are never written to `config.json` \u2014 the file people paste into bug reports.
- Anything logged goes through `maskKey()`, including `aether-shell doctor` output.
- The systemd unit carries no `Environment=` key, because `systemctl --user show` prints it.
- `secrets.json`, `.env` and `*.key` are in `.gitignore`, and CI fails the build if a
  key-shaped string is ever committed.

---

## Using it

| How | What |
|---|---|
| `Super + A` | open the panel |
| `Super + Space`, then `?query` | ask from the launcher without leaving it |
| `Super + Q` | explain whatever is in the clipboard |
| `astal -i aether ai "..."` | ask from a script or a custom keybind |
| `aether-shell ai "..."` | ask from a terminal |

Streaming is on by default; the send button becomes a stop button mid-response and
cancellation actually kills the request. Status is one of
`idle`, `thinking`, `streaming`, `error`, `unconfigured` \u2014 the last one means no key was
found, and the panel tells you which env var it looked for.

---

## Prompt tokens

Usable anywhere in a prompt or quick action. They are expanded locally, right before the
request:

| Token | Expands to |
|---|---|
| `{{clipboard}}` | `wl-paste` |
| `{{selection}}` | `wl-paste --primary` |
| `{{journal}}` | `journalctl -p 3 -xb --no-pager -n 60` |
| `{{hostinfo}}` | distro, kernel, DE, CPU, memory |

This is what makes `{{journal}}` quick actions useful \u2014 the agent gets your actual errors,
not a description of them. It also means anything you put in a token is sent to your
provider, so be aware of what is on your clipboard.

---

## Quick actions

The four cards on the empty panel. Fully user-defined:

```jsonc
{
  "ai": {
    "quickActions": [
      {
        "title": "Debug my system",
        "subtitle": "Read recent errors",
        "icon": "dialog-warning-symbolic",
        "prompt": "Here are my recent system errors:\\n{{journal}}\\nWhat is going wrong?"
      },
      {
        "title": "Explain this command",
        "subtitle": "From clipboard",
        "icon": "utilities-terminal-symbolic",
        "prompt": "Explain this shell command, flag by flag:\\n{{clipboard}}"
      }
    ]
  }
}
```

Any number of them; the panel lays them out in a grid.

---

## System prompt and history

```jsonc
{
  "ai": {
    "systemPrompt": "You are Aether, a concise Linux desktop assistant.",
    "historyLimit": 20
  }
}
```

History is in-memory only and capped at `historyLimit` messages. Nothing is written to
disk, and closing the panel with the header's clear button drops it immediately.

---

## Running fully offline

```bash
ollama serve
ollama pull llama3.2
```

```jsonc
{ "ai": { "provider": "ollama", "model": "llama3.2" } }
```

No key, no network egress. Everything else in the shell behaves identically.

---

## Adding a provider

One object in `service/providers.ts`:

```ts
myprovider: {
  id: "myprovider",
  name: "My Provider",
  baseUrl: "https://api.example.com/v1",
  endpoint: "/chat/completions",
  format: "openai",
  auth: "bearer",
  envVar: "MYPROVIDER_API_KEY",
  defaultModel: "some-model",
}
```

If it speaks the OpenAI wire format, that is the entire change \u2014 streaming, cancellation,
key resolution and error handling are all generic.

---

## When it fails

| Message | Cause |
|---|---|
| `unconfigured` | no key found; the panel names the env var it expected |
| `401` / `403` | bad or expired key \u2014 re-run `aether-shell setup` |
| `429` | rate limited, or out of credit |
| `model not found` | model name does not exist for that provider |
| hangs, then errors | no network, or a local server that is not running |

`aether-shell doctor` prints the active provider, model, and where the key was found \u2014 with
the key masked.

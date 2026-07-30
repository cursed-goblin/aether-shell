import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { Variable } from "astal"

import { config } from "./config"
import { getProvider, requestUrl, type Provider } from "./providers"
import { getApiKey, hasApiKey, maskKey } from "./secrets"

/**
 * AI agent backend.
 *
 * Design goals:
 *   - API-key driven, provider agnostic (see service/providers.ts)
 *   - Token streaming, so the panel fills in as the model types
 *   - Cancellable mid-response
 *   - No key ever appears in argv (it goes through a 0600 header file)
 *
 * Transport is `curl -N` driven through Gio.Subprocess rather than libsoup:
 * it gives us SSE line framing for free and behaves identically across
 * distros. Widgets never call this directly except through `ask()`.
 */

export type Role = "system" | "user" | "assistant"

export interface Message {
	role: Role
	content: string
	/** Set while a response is still streaming in. */
	pending?: boolean
	error?: boolean
	at: number
}

export type AiStatus = "idle" | "thinking" | "streaming" | "error" | "unconfigured"

function envHint(provider: Provider): string {
	return provider.envVar ?? "AETHER_API_KEY"
}

class AiService {
	readonly messages = Variable<Message[]>([])
	readonly status = Variable<AiStatus>("idle")
	readonly statusText = Variable("Ready")

	private proc: Gio.Subprocess | null = null
	private cancellable: Gio.Cancellable | null = null
	private headerFile: string | null = null
	private buffer = ""

	// ---------------------------------------------------------------- lifecycle

	init(): void {
		const provider = this.provider()
		if (!hasApiKey(config.ai.provider)) {
			this.status.set("unconfigured")
			this.statusText.set(`No API key for ${provider.name}`)
			printerr(
				`[aether/ai] no key found for "${config.ai.provider}". ` +
					`Set $${envHint(provider)} or run: aether-shell setup`,
			)
			return
		}
		this.status.set("idle")
		this.statusText.set(`${provider.name} \u00b7 ${this.model()}`)
	}

	provider(): Provider {
		return getProvider(config.ai.provider)
	}

	model(): string {
		return config.ai.model || this.provider().defaultModel
	}

	keyPreview(): string {
		return maskKey(getApiKey(config.ai.provider))
	}

	clear(): void {
		this.cancel()
		this.messages.set([])
		this.status.set(hasApiKey(config.ai.provider) ? "idle" : "unconfigured")
	}

	cancel(): void {
		this.cancellable?.cancel()
		try {
			this.proc?.force_exit()
		} catch {
			/* already gone */
		}
		this.proc = null
		this.cleanupHeaderFile()
		this.finalizePending()
		if (this.status.get() !== "unconfigured") this.status.set("idle")
	}

	// ------------------------------------------------------------------- public

	/** Expands {{clipboard}} / {{journal}} / {{selection}} in quick actions. */
	expand(template: string): string {
		return template
			.replace(/\{\{clipboard\}\}/g, () => sh(["wl-paste", "--no-newline"]))
			.replace(/\{\{selection\}\}/g, () =>
				sh(["wl-paste", "--primary", "--no-newline"]),
			)
			.replace(/\{\{journal\}\}/g, () =>
				sh(["journalctl", "-p", "3", "-xb", "--no-pager", "-n", "60"]),
			)
			.replace(/\{\{hostinfo\}\}/g, () => sh(["uname", "-a"]))
	}

	ask(prompt: string): void {
		const text = prompt.trim()
		if (!text) return

		if (!hasApiKey(config.ai.provider)) {
			const provider = this.provider()
			this.pushError(
				`No API key configured for ${provider.name}.\n\n` +
					`Set it with one of:\n` +
					`  export ${envHint(provider)}="..."\n` +
					`  aether-shell setup\n` +
					`  secret-tool store --label="Aether" service aether-shell provider ${config.ai.provider}`,
			)
			return
		}

		this.cancel()

		this.push({ role: "user", content: text, at: Date.now() })
		this.push({ role: "assistant", content: "", pending: true, at: Date.now() })

		this.status.set("thinking")
		this.statusText.set(`${this.provider().name} \u00b7 ${this.model()}`)

		this.request()
	}

	retry(): void {
		const msgs = this.messages.get()
		const lastUser = [...msgs].reverse().find((m) => m.role === "user")
		if (!lastUser) return
		this.messages.set(msgs.filter((m) => m !== msgs[msgs.length - 1]))
		this.ask(lastUser.content)
	}

	// ------------------------------------------------------------------ request

	private request(): void {
		const provider = this.provider()
		const url = requestUrl(provider, config.ai.baseUrl)
		const body = this.buildBody(provider)

		this.headerFile = this.writeHeaderFile(provider)

		const argv = [
			"curl",
			"--silent",
			"--show-error",
			"--no-buffer",
			"--fail-with-body",
			"--max-time",
			"180",
			"-X",
			"POST",
			url,
			"-H",
			"content-type: application/json",
			"-H",
			`@${this.headerFile}`,
			"--data-binary",
			"@-",
		]

		try {
			this.cancellable = new Gio.Cancellable()
			this.proc = Gio.Subprocess.new(
				argv,
				Gio.SubprocessFlags.STDIN_PIPE |
					Gio.SubprocessFlags.STDOUT_PIPE |
					Gio.SubprocessFlags.STDERR_PIPE,
			)

			const stdin = this.proc.get_stdin_pipe()!
			stdin.write_all(new TextEncoder().encode(JSON.stringify(body)), null)
			stdin.close(null)

			const stdout = new Gio.DataInputStream({
				base_stream: this.proc.get_stdout_pipe()!,
				close_base_stream: true,
			})

			this.buffer = ""
			this.readLine(stdout)

			this.proc.wait_async(this.cancellable, () => {
				this.cleanupHeaderFile()
				this.finalizePending()
				if (this.status.get() !== "error") this.status.set("idle")
			})
		} catch (err) {
			this.pushError(`Transport error: ${err}`)
		}
	}

	private buildBody(provider: Provider): Record<string, unknown> {
		const history = this.messages
			.get()
			.filter((m) => !m.pending && !m.error)
			.slice(-config.ai.historyLimit)
			.map((m) => ({ role: m.role, content: m.content }))

		if (provider.format === "anthropic") {
			return {
				model: this.model(),
				system: config.ai.systemPrompt,
				messages: history.filter((m) => m.role !== "system"),
				max_tokens: config.ai.maxTokens,
				temperature: config.ai.temperature,
				stream: config.ai.streaming,
			}
		}

		return {
			model: this.model(),
			messages: [{ role: "system", content: config.ai.systemPrompt }, ...history],
			max_tokens: config.ai.maxTokens,
			temperature: config.ai.temperature,
			stream: config.ai.streaming,
		}
	}

	/**
	 * Auth header goes into a mode-600 tmpfile instead of argv, so the key
	 * is not visible in `ps aux` or /proc/<pid>/cmdline.
	 */
	private writeHeaderFile(provider: Provider): string {
		const key = getApiKey(config.ai.provider)
		const lines: string[] = []

		if (provider.auth === "bearer" && key) lines.push(`authorization: Bearer ${key}`)
		if (provider.auth === "x-api-key" && key) lines.push(`x-api-key: ${key}`)
		for (const [k, v] of Object.entries(provider.headers ?? {})) lines.push(`${k}: ${v}`)

		const [path, stream] = Gio.File.new_tmp("aether-hdr-XXXXXX")
		const filePath = path.get_path()!
		stream.get_output_stream().write_all(
			new TextEncoder().encode(lines.join("\n") + "\n"),
			null,
		)
		stream.close(null)
		GLib.chmod?.(filePath, 0o600)
		return filePath
	}

	private cleanupHeaderFile(): void {
		if (!this.headerFile) return
		try {
			Gio.File.new_for_path(this.headerFile).delete(null)
		} catch {
			/* best effort */
		}
		this.headerFile = null
	}

	// ------------------------------------------------------------------ streaming

	private readLine(stream: Gio.DataInputStream): void {
		stream.read_line_async(GLib.PRIORITY_DEFAULT, this.cancellable, (s, res) => {
			let line: string | null = null
			try {
				const [bytes] = (s as Gio.DataInputStream).read_line_finish(res)
				line = bytes ? new TextDecoder().decode(bytes) : null
			} catch {
				return
			}

			if (line === null) {
				this.finalizePending()
				return
			}

			this.consume(line)
			this.readLine(s as Gio.DataInputStream)
		})
	}

	private consume(line: string): void {
		const trimmed = line.trim()
		if (!trimmed) return

		// Non-streaming replies and API errors arrive as one JSON blob.
		if (!trimmed.startsWith("data:")) {
			this.buffer += trimmed
			this.tryWholeJson()
			return
		}

		const payload = trimmed.slice(5).trim()
		if (payload === "[DONE]") {
			this.finalizePending()
			return
		}

		try {
			const json = JSON.parse(payload)
			const delta = this.extractDelta(json)
			if (delta) this.appendToPending(delta)
		} catch {
			/* partial SSE frame; ignore */
		}
	}

	private tryWholeJson(): void {
		try {
			const json = JSON.parse(this.buffer)
			this.buffer = ""

			if (json.error) {
				const msg = json.error.message ?? JSON.stringify(json.error)
				this.pushError(`${this.provider().name} returned an error:\n${msg}`)
				return
			}

			const whole =
				json.choices?.[0]?.message?.content ??
				json.content?.map((c: any) => c.text).join("") ??
				""
			if (whole) this.appendToPending(whole)
		} catch {
			/* still accumulating */
		}
	}

	/** Handles OpenAI-style and Anthropic-style stream frames. */
	private extractDelta(json: any): string {
		if (json.choices?.[0]?.delta?.content) return json.choices[0].delta.content
		if (json.type === "content_block_delta" && json.delta?.text) return json.delta.text
		if (json.delta?.text) return json.delta.text
		return ""
	}

	// -------------------------------------------------------------------- store

	private push(msg: Message): void {
		this.messages.set([...this.messages.get(), msg])
	}

	private appendToPending(chunk: string): void {
		if (this.status.get() !== "streaming") this.status.set("streaming")

		const msgs = [...this.messages.get()]
		const last = msgs[msgs.length - 1]
		if (!last || last.role !== "assistant") return

		msgs[msgs.length - 1] = { ...last, content: last.content + chunk, pending: true }
		this.messages.set(msgs)
	}

	private finalizePending(): void {
		const msgs = [...this.messages.get()]
		const last = msgs[msgs.length - 1]
		if (!last?.pending) return

		if (!last.content.trim()) {
			msgs[msgs.length - 1] = {
				...last,
				pending: false,
				error: true,
				content: "Empty response. Check the model name and your API key.",
			}
		} else {
			msgs[msgs.length - 1] = { ...last, pending: false }
		}
		this.messages.set(msgs)
	}

	private pushError(text: string): void {
		const msgs = [...this.messages.get()]
		const last = msgs[msgs.length - 1]

		if (last?.pending) {
			msgs[msgs.length - 1] = { ...last, pending: false, error: true, content: text }
			this.messages.set(msgs)
		} else {
			this.push({ role: "assistant", content: text, error: true, at: Date.now() })
		}

		this.status.set("error")
		this.statusText.set("Request failed")
	}
}

/** Small synchronous helper for prompt template expansion. */
function sh(argv: string[]): string {
	try {
		const [ok, stdout] = GLib.spawn_sync(
			null,
			argv,
			null,
			GLib.SpawnFlags.SEARCH_PATH,
			null,
		)
		if (!ok || !stdout) return ""
		return new TextDecoder().decode(stdout).trim()
	} catch {
		return ""
	}
}

export const ai = new AiService()

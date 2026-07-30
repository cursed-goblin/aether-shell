import GLib from "gi://GLib"
import Gio from "gi://Gio"

import { getProvider, requiresKey } from "./providers"

/**
 * API key resolution.
 *
 * Order of precedence (first hit wins):
 *   1. Environment variable        XAI_API_KEY, OPENAI_API_KEY, ...
 *   2. libsecret / keyring         secret-tool store --label="Aether" service aether-shell provider xai
 *   3. ~/.config/aether/secrets.json  { "xai": "xai-..." }   (chmod 600 enforced)
 *
 * Keys are never written to the shell config, never logged, and never
 * interpolated into a command line - they are passed to curl through a
 * header file on a private tmpfile, so they do not appear in `ps aux`.
 */

const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), "aether"])
const SECRETS_PATH = GLib.build_filenamev([CONFIG_DIR, "secrets.json"])

let cache: Record<string, string> | null = null

function readSecretsFile(): Record<string, string> {
	if (cache) return cache

	try {
		const file = Gio.File.new_for_path(SECRETS_PATH)
		if (!file.query_exists(null)) return (cache = {})

		// Refuse group/world readable secret files.
		const info = file.query_info("unix::mode", Gio.FileQueryInfoFlags.NONE, null)
		const mode = info.get_attribute_uint32("unix::mode") & 0o777
		if (mode & 0o077) {
			printerr(
				`[aether/secrets] ${SECRETS_PATH} is mode ${mode.toString(8)}; ` +
					`run: chmod 600 ${SECRETS_PATH}`,
			)
		}

		const [ok, bytes] = file.load_contents(null)
		if (!ok) return (cache = {})

		const text = new TextDecoder().decode(bytes)
		return (cache = JSON.parse(text) as Record<string, string>)
	} catch (err) {
		printerr(`[aether/secrets] failed to read secrets.json: ${err}`)
		return (cache = {})
	}
}

function readKeyring(provider: string): string | null {
	try {
		const [ok, stdout] = GLib.spawn_sync(
			null,
			["secret-tool", "lookup", "service", "aether-shell", "provider", provider],
			null,
			GLib.SpawnFlags.SEARCH_PATH,
			null,
		)
		if (!ok || !stdout) return null
		const key = new TextDecoder().decode(stdout).trim()
		return key.length > 0 ? key : null
	} catch {
		return null
	}
}

/** Returns the API key for a provider, or an empty string if none is set. */
export function getApiKey(providerId: string): string {
	const provider = getProvider(providerId)

	if (provider.envVar) {
		const fromEnv = GLib.getenv(provider.envVar)
		if (fromEnv && fromEnv.trim()) return fromEnv.trim()
	}

	const fromKeyring = readKeyring(providerId)
	if (fromKeyring) return fromKeyring

	const fromFile = readSecretsFile()[providerId]
	if (fromFile && fromFile.trim()) return fromFile.trim()

	return ""
}

export function hasApiKey(providerId: string): boolean {
	const provider = getProvider(providerId)
	if (!requiresKey(provider)) return true
	return getApiKey(providerId).length > 0
}

/** Never show more than this in the UI. */
export function maskKey(key: string): string {
	if (!key) return "not set"
	if (key.length <= 10) return "\u2022".repeat(key.length)
	return `${key.slice(0, 4)}\u2026${key.slice(-4)}`
}

export function invalidateSecretsCache(): void {
	cache = null
}

/**
 * Writes an API key to ~/.config/aether/secrets.json with mode 600.
 * Used by `aether-shell setup` and the AI panel's key prompt.
 */
export function storeApiKey(providerId: string, key: string): void {
	const secrets = { ...readSecretsFile(), [providerId]: key.trim() }

	GLib.mkdir_with_parents(CONFIG_DIR, 0o700)
	GLib.file_set_contents(SECRETS_PATH, JSON.stringify(secrets, null, 2))
	GLib.chmod?.(SECRETS_PATH, 0o600)

	invalidateSecretsCache()
}

import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { Variable } from "astal"

import { invalidateSecretsCache } from "./secrets"

/**
 * Config layer.
 *
 * Defaults ship with the package and are never edited in place.
 * Users override in ~/.config/aether/config.json - a deep merge, so a user
 * only writes the keys they care about.
 *
 * The file is watched; saving it re-applies theme variables live.
 */

export interface QuickAction {
	icon: string
	title: string
	subtitle: string
	prompt: string
}

export interface AiConfig {
	provider: string
	model: string
	temperature: number
	maxTokens: number
	streaming: boolean
	historyLimit: number
	systemPrompt: string
	quickActions: QuickAction[]
	/** Optional override, e.g. a self-hosted OpenAI-compatible gateway. */
	baseUrl?: string | null
}

export interface Config {
	theme: {
		accent: string
		accent2: string
		surfaceOpacity: number
		radius: number
		font: string
		monoFont: string
	}
	bar: {
		position: "top" | "bottom"
		height: number
		left: string[]
		center: string[]
		right: string[]
	}
	dock: {
		enabled: boolean
		autohide: boolean
		iconSize: number
		pinned: string[]
		onlyPrimaryMonitor: boolean
	}
	launcher: { maxResults: number; askAiPrefix: string }
	notifications: { position: string; timeout: number; maxPopups: number }
	weather: { enabled: boolean; location: string; units: string }
	ai: AiConfig
}

const USER_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), "aether"])
const USER_CONFIG = GLib.build_filenamev([USER_DIR, "config.json"])

/** SRC is injected by the ags bundler and points at the install prefix. */
declare const SRC: string
const DEFAULT_CONFIG = `${SRC}/config/default.json`

function readJson(path: string): Record<string, any> {
	try {
		const file = Gio.File.new_for_path(path)
		if (!file.query_exists(null)) return {}
		const [ok, bytes] = file.load_contents(null)
		if (!ok) return {}
		return JSON.parse(new TextDecoder().decode(bytes))
	} catch (err) {
		printerr(`[aether/config] cannot parse ${path}: ${err}`)
		return {}
	}
}

function deepMerge<T extends Record<string, any>>(base: T, override: Record<string, any>): T {
	const out: Record<string, any> = { ...base }
	for (const [key, value] of Object.entries(override)) {
		const current = out[key]
		if (
			value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			current &&
			typeof current === "object" &&
			!Array.isArray(current)
		) {
			out[key] = deepMerge(current, value)
		} else {
			out[key] = value
		}
	}
	return out as T
}

function load(): Config {
	const defaults = readJson(DEFAULT_CONFIG) as Config
	const user = readJson(USER_CONFIG)
	return deepMerge(defaults, user)
}

/** Mutable singleton - widgets read `config.x.y` directly. */
export let config: Config = load()

/** Bump this to make widgets rebuild after a config change. */
export const configRevision = Variable(0)

export function reloadConfig(): void {
	config = load()
	invalidateSecretsCache()
	configRevision.set(configRevision.get() + 1)
	applyThemeVariables()
}

/**
 * Pushes user theme values into GTK CSS custom properties so the SCSS
 * can stay static while accent/opacity/radius are runtime-configurable.
 */
export function applyThemeVariables(): void {
	const { accent, accent2, surfaceOpacity, radius, font, monoFont } = config.theme

	globalThis.__aetherThemeCss = `
		:root {
			--accent: ${accent};
			--accent-2: ${accent2};
			--surface-alpha: ${surfaceOpacity};
			--radius: ${radius}px;
			--font: "${font}";
			--font-mono: "${monoFont}";
		}
	`
}

export function watchConfig(): void {
	GLib.mkdir_with_parents(USER_DIR, 0o700)

	const file = Gio.File.new_for_path(USER_CONFIG)
	const monitor = file.monitor(Gio.FileMonitorFlags.NONE, null)

	monitor.connect("changed", (_m, _f, _o, event) => {
		if (
			event === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
			event === Gio.FileMonitorEvent.CREATED
		) {
			print("[aether/config] reloading")
			reloadConfig()
		}
	})

	// Keep a reference so the monitor is not garbage collected.
	globalThis.__aetherConfigMonitor = monitor
	applyThemeVariables()
}

export function userConfigPath(): string {
	return USER_CONFIG
}

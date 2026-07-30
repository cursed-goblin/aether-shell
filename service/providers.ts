/**
 * Provider registry.
 *
 * The agent backend is API-key driven and provider-agnostic. Adding a new
 * service is one entry here - if it speaks the OpenAI wire format, that is
 * the entire integration.
 */

export type WireFormat = "openai" | "anthropic" | "gemini"
export type AuthStyle = "bearer" | "x-api-key" | "query" | "none"

export interface Provider {
	id: string
	name: string
	baseUrl: string
	endpoint: string
	format: WireFormat
	auth: AuthStyle
	/** Environment variable checked first when resolving the key. */
	envVar?: string
	defaultModel: string
	/** Extra headers required by the API (e.g. Anthropic's version pin). */
	headers?: Record<string, string>
	/** Local servers need no key and should not nag the user for one. */
	local?: boolean
}

export const PROVIDERS: Record<string, Provider> = {
	// ---- default: xAI / Grok -------------------------------------------
	xai: {
		id: "xai",
		name: "xAI (Grok)",
		baseUrl: "https://api.x.ai/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "XAI_API_KEY",
		defaultModel: "grok-4",
	},

	openai: {
		id: "openai",
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "OPENAI_API_KEY",
		defaultModel: "gpt-4o",
	},

	anthropic: {
		id: "anthropic",
		name: "Anthropic",
		baseUrl: "https://api.anthropic.com/v1",
		endpoint: "/messages",
		format: "anthropic",
		auth: "x-api-key",
		envVar: "ANTHROPIC_API_KEY",
		defaultModel: "claude-sonnet-4-20250514",
		headers: { "anthropic-version": "2023-06-01" },
	},

	gemini: {
		id: "gemini",
		name: "Google Gemini",
		baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "GEMINI_API_KEY",
		defaultModel: "gemini-2.0-flash",
	},

	groq: {
		id: "groq",
		name: "Groq",
		baseUrl: "https://api.groq.com/openai/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "GROQ_API_KEY",
		defaultModel: "llama-3.3-70b-versatile",
	},

	openrouter: {
		id: "openrouter",
		name: "OpenRouter",
		baseUrl: "https://openrouter.ai/api/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "OPENROUTER_API_KEY",
		defaultModel: "anthropic/claude-sonnet-4",
		headers: {
			"HTTP-Referer": "https://github.com/cursed-goblin/aether-shell",
			"X-Title": "Aether Shell",
		},
	},

	deepseek: {
		id: "deepseek",
		name: "DeepSeek",
		baseUrl: "https://api.deepseek.com/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "DEEPSEEK_API_KEY",
		defaultModel: "deepseek-chat",
	},

	mistral: {
		id: "mistral",
		name: "Mistral",
		baseUrl: "https://api.mistral.ai/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "MISTRAL_API_KEY",
		defaultModel: "mistral-large-latest",
	},

	// ---- local, no key --------------------------------------------------
	ollama: {
		id: "ollama",
		name: "Ollama (local)",
		baseUrl: "http://localhost:11434/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "none",
		defaultModel: "llama3.2",
		local: true,
	},

	llamacpp: {
		id: "llamacpp",
		name: "llama.cpp (local)",
		baseUrl: "http://localhost:8080/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "none",
		defaultModel: "local-model",
		local: true,
	},

	// ---- escape hatch ---------------------------------------------------
	custom: {
		id: "custom",
		name: "Custom endpoint",
		baseUrl: "http://localhost:8000/v1",
		endpoint: "/chat/completions",
		format: "openai",
		auth: "bearer",
		envVar: "AETHER_API_KEY",
		defaultModel: "custom-model",
	},
}

export function getProvider(id: string): Provider {
	return PROVIDERS[id] ?? PROVIDERS.xai
}

export function providerIds(): string[] {
	return Object.keys(PROVIDERS)
}

/** True when the provider will not work without a key. */
export function requiresKey(provider: Provider): boolean {
	return provider.auth !== "none" && !provider.local
}

/** Full request URL, honouring a user-supplied baseUrl override. */
export function requestUrl(provider: Provider, baseUrlOverride?: string | null): string {
	const base = (baseUrlOverride || provider.baseUrl).replace(/\/+$/, "")
	return `${base}${provider.endpoint}`
}

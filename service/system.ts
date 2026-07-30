import GLib from "gi://GLib"
import { Variable } from "astal"

/**
 * System stats poller.
 *
 * Reads /proc and /sys directly - no shelling out, no external monitor
 * daemon. Values are normalized 0..1 so widgets can bind them to level
 * bars and rings without doing math.
 */

export interface Stat {
	value: number
	detail: string
}

export interface SystemStats {
	cpu: Stat
	memory: Stat
	disk: Stat
	network: Stat
	brightness: number
	uptime: string
}

const EMPTY: SystemStats = {
	cpu: { value: 0, detail: "" },
	memory: { value: 0, detail: "" },
	disk: { value: 0, detail: "" },
	network: { value: 0, detail: "" },
	brightness: 1,
	uptime: "",
}

function read(path: string): string {
	try {
		const [ok, bytes] = GLib.file_get_contents(path)
		return ok ? new TextDecoder().decode(bytes) : ""
	} catch {
		return ""
	}
}

function gib(kb: number): string {
	return (kb / 1024 / 1024).toFixed(1)
}

// ------------------------------------------------------------------- cpu

let lastIdle = 0
let lastTotal = 0

function cpu(): Stat {
	const line = read("/proc/stat").split("\n")[0]
	const parts = line.trim().split(/\s+/).slice(1).map(Number)
	if (parts.length < 4) return { value: 0, detail: "" }

	const idle = parts[3] + (parts[4] ?? 0)
	const total = parts.reduce((a, b) => a + b, 0)

	const deltaIdle = idle - lastIdle
	const deltaTotal = total - lastTotal
	lastIdle = idle
	lastTotal = total

	const usage = deltaTotal > 0 ? 1 - deltaIdle / deltaTotal : 0

	const mhz = read("/proc/cpuinfo")
		.split("\n")
		.filter((l) => l.startsWith("cpu MHz"))
		.map((l) => parseFloat(l.split(":")[1]))
	const avg = mhz.length ? mhz.reduce((a, b) => a + b, 0) / mhz.length : 0

	return {
		value: Math.min(Math.max(usage, 0), 1),
		detail: avg ? `${(avg / 1000).toFixed(2)} GHz` : "",
	}
}

// ---------------------------------------------------------------- memory

function memory(): Stat {
	const info = read("/proc/meminfo")
	const get = (key: string) => {
		const match = info.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))
		return match ? Number(match[1]) : 0
	}

	const total = get("MemTotal")
	const available = get("MemAvailable")
	const used = total - available

	return {
		value: total > 0 ? used / total : 0,
		detail: `${gib(used)} / ${gib(total)} GB`,
	}
}

// ------------------------------------------------------------------ disk

function disk(): Stat {
	try {
		const { Gio } = imports.gi
		const info = Gio.File.new_for_path(GLib.get_home_dir()).query_filesystem_info(
			"filesystem::size,filesystem::used",
			null,
		)
		const size = Number(info.get_attribute_uint64("filesystem::size"))
		const used = Number(info.get_attribute_uint64("filesystem::used"))
		const toGb = (n: number) => Math.round(n / 1024 ** 3)

		return {
			value: size > 0 ? used / size : 0,
			detail: `${toGb(used)} / ${toGb(size)} GB`,
		}
	} catch {
		return { value: 0, detail: "" }
	}
}

// --------------------------------------------------------------- network

let lastRx = 0
let lastTx = 0
let lastAt = 0

function network(): Stat {
	const lines = read("/proc/net/dev").split("\n").slice(2)
	let rx = 0
	let tx = 0

	for (const line of lines) {
		const [iface, rest] = line.split(":")
		if (!rest || iface.trim() === "lo") continue
		const cols = rest.trim().split(/\s+/).map(Number)
		rx += cols[0] ?? 0
		tx += cols[8] ?? 0
	}

	const now = Date.now()
	const seconds = lastAt ? (now - lastAt) / 1000 : 1
	const rxRate = Math.max(rx - lastRx, 0) / seconds
	const txRate = Math.max(tx - lastTx, 0) / seconds

	lastRx = rx
	lastTx = tx
	lastAt = now

	// Scale against a 100 Mbit reference so the ring stays meaningful.
	const reference = 12.5 * 1024 * 1024
	const mbps = (n: number) => (n / 1024 / 1024).toFixed(1)

	return {
		value: Math.min((rxRate + txRate) / reference, 1),
		detail: `\u2193${mbps(rxRate)} \u2191${mbps(txRate)} MB/s`,
	}
}

// ------------------------------------------------------------ brightness

function brightness(): number {
	try {
		const { Gio } = imports.gi
		const dir = Gio.File.new_for_path("/sys/class/backlight")
		const iter = dir.enumerate_children("standard::name", 0, null)
		const child = iter.next_file(null)
		if (!child) return 1

		const base = `/sys/class/backlight/${child.get_name()}`
		const current = Number(read(`${base}/brightness`).trim())
		const max = Number(read(`${base}/max_brightness`).trim())
		return max > 0 ? current / max : 1
	} catch {
		return 1
	}
}

function uptime(): string {
	const seconds = Number(read("/proc/uptime").split(" ")[0] ?? 0)
	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function sample(): SystemStats {
	return {
		cpu: cpu(),
		memory: memory(),
		disk: disk(),
		network: network(),
		brightness: brightness(),
		uptime: uptime(),
	}
}

/** Polls every 2s. Widgets bind to this and never poll themselves. */
export const systemStats = Variable<SystemStats>(EMPTY).poll(2000, sample)

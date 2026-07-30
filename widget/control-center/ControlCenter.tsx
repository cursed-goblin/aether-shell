import { App, Astal, Gdk, Gtk } from "astal/gtk4"
import { Variable, bind, execAsync } from "astal"
import GLib from "gi://GLib"
import AstalWp from "gi://AstalWp"
import AstalNetwork from "gi://AstalNetwork"
import AstalBluetooth from "gi://AstalBluetooth"
import AstalBattery from "gi://AstalBattery"

import { systemStats } from "../../service/system"

/**
 * Control center: toggle tiles, sliders and a live system monitor.
 * Mirrors the reference design's right-hand stack.
 */
export default function ControlCenter(monitor: Gdk.Monitor) {
	const audio = AstalWp.get_default()?.audio
	const speaker = audio?.defaultSpeaker
	const network = AstalNetwork.get_default()
	const bluetooth = AstalBluetooth.get_default()
	const battery = AstalBattery.get_default()
	const dnd = Variable(false)
	const nightLight = Variable(false)

	function Tile(props: {
		icon: string
		title: string
		subtitle: unknown
		cssClasses: unknown
		onClicked: () => void
	}) {
		return (
			<button cssClasses={props.cssClasses as any} onClicked={props.onClicked} hexpand>
				<box spacing={10}>
					<image cssClasses={["tile-icon"]} iconName={props.icon} />
					<box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
						<label cssClasses={["t"]} xalign={0} label={props.title} />
						<label cssClasses={["s"]} xalign={0} label={props.subtitle as any} />
					</box>
				</box>
			</button>
		)
	}

	function Ring(key: "cpu" | "memory" | "disk" | "network", label: string) {
		return (
			<box cssClasses={["ring", key]} orientation={Gtk.Orientation.VERTICAL} spacing={6}>
				<levelbar
					cssClasses={["ring-bar"]}
					value={bind(systemStats).as((s) => s[key].value)}
					minValue={0}
					maxValue={1}
				/>
				<label
					cssClasses={["ring-value"]}
					label={bind(systemStats).as((s) => `${Math.round(s[key].value * 100)}%`)}
				/>
				<label cssClasses={["ring-label"]} label={label} />
				<label cssClasses={["ring-sub"]} label={bind(systemStats).as((s) => s[key].detail)} />
			</box>
		)
	}

	const userName = GLib.get_real_name() || GLib.get_user_name()

	return (
		<window
			name="control-center"
			namespace="aether-control-center"
			cssClasses={["cc-window"]}
			gdkmonitor={monitor}
			anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
			layer={Astal.Layer.OVERLAY}
			keymode={Astal.Keymode.ON_DEMAND}
			visible={false}
			application={App}
			onKeyPressed={(_s, keyval) => {
				if (keyval === Gdk.KEY_Escape) App.get_window("control-center")?.hide()
			}}
		>
			<box cssClasses={["cc", "glass"]} orientation={Gtk.Orientation.VERTICAL} spacing={16}>
				{/* profile */}
				<box cssClasses={["cc-head"]} spacing={12}>
					<image cssClasses={["avatar"]} iconName="avatar-default-symbolic" pixelSize={36} />
					<box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
						<label cssClasses={["name"]} xalign={0} label={userName} />
						<label
							cssClasses={["meta"]}
							xalign={0}
							label={bind(battery, "percentage").as((p) => `Battery ${Math.round(p * 100)}%`)}
						/>
					</box>
					<button
						cssClasses={["icon-btn"]}
						tooltipText="Settings"
						onClicked={() => execAsync(["xdg-open", "settings://"]).catch(() => {})}
					>
						<image iconName="emblem-system-symbolic" />
					</button>
					<button
						cssClasses={["icon-btn", "danger"]}
						tooltipText="Power off"
						onClicked={() => execAsync(["systemctl", "poweroff"])}
					>
						<image iconName="system-shutdown-symbolic" />
					</button>
				</box>

				{/* toggles */}
				<box cssClasses={["cc-section"]} orientation={Gtk.Orientation.VERTICAL} spacing={10}>
					<label cssClasses={["section-title"]} xalign={0} label="Control Center" />
					<box spacing={10} homogeneous>
						{Tile({
							icon: "network-wireless-symbolic",
							title: "Wi-Fi",
							subtitle: bind(network, "wifi").as((w) => w?.ssid ?? "Disconnected"),
							cssClasses: bind(network, "wifi").as((w) =>
								w?.enabled ? ["tile", "on"] : ["tile"],
							),
							onClicked: () => {
								const wifi = network.wifi
								if (wifi) wifi.enabled = !wifi.enabled
							},
						})}
						{Tile({
							icon: "bluetooth-symbolic",
							title: "Bluetooth",
							subtitle: bind(bluetooth, "isPowered").as((p) => (p ? "On" : "Off")),
							cssClasses: bind(bluetooth, "isPowered").as((p) =>
								p ? ["tile", "on"] : ["tile"],
							),
							onClicked: () => bluetooth.toggle(),
						})}
					</box>
					<box spacing={10} homogeneous>
						{Tile({
							icon: "weather-clear-night-symbolic",
							title: "Night Light",
							subtitle: bind(nightLight).as((v) => (v ? "On" : "Off")),
							cssClasses: bind(nightLight).as((v) => (v ? ["tile", "on"] : ["tile"])),
							onClicked: () => {
								const next = !nightLight.get()
								nightLight.set(next)
								execAsync(
									next
										? ["sh", "-c", "pkill -x wlsunset; wlsunset -t 3800 &"]
										: ["pkill", "-x", "wlsunset"],
								).catch(() => {})
							},
						})}
						{Tile({
							icon: "notifications-disabled-symbolic",
							title: "Do Not Disturb",
							subtitle: bind(dnd).as((v) => (v ? "On" : "Off")),
							cssClasses: bind(dnd).as((v) => (v ? ["tile", "on"] : ["tile"])),
							onClicked: () => dnd.set(!dnd.get()),
						})}
					</box>
				</box>

				{/* sliders */}
				<box cssClasses={["cc-section"]} orientation={Gtk.Orientation.VERTICAL} spacing={10}>
					<box cssClasses={["slider-row"]} spacing={10}>
						<image iconName="display-brightness-symbolic" />
						<slider
							hexpand
							value={bind(systemStats).as((s) => s.brightness)}
							onChangeValue={({ value }) =>
								execAsync(["brightnessctl", "set", `${Math.round(value * 100)}%`]).catch(() => {})
							}
						/>
					</box>
					{speaker && (
						<box cssClasses={["slider-row"]} spacing={10}>
							<image iconName={bind(speaker, "volumeIcon")} />
							<slider
								hexpand
								value={bind(speaker, "volume")}
								onChangeValue={({ value }) => (speaker.volume = value)}
							/>
						</box>
					)}
				</box>

				{/* system monitor */}
				<box
					cssClasses={["cc-section", "sysmon"]}
					orientation={Gtk.Orientation.VERTICAL}
					spacing={10}
				>
					<box>
						<label cssClasses={["section-title"]} xalign={0} hexpand label="System Monitor" />
						<label cssClasses={["section-note"]} label="Live" />
					</box>
					<box spacing={10} homogeneous>
						{Ring("cpu", "CPU")}
						{Ring("memory", "Memory")}
						{Ring("disk", "Disk")}
						{Ring("network", "Network")}
					</box>
				</box>
			</box>
		</window>
	)
}

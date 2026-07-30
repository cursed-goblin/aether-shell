import { App, Gtk } from "astal/gtk4"
import { Variable, bind, execAsync } from "astal"
import GLib from "gi://GLib"
import AstalHyprland from "gi://AstalHyprland"
import AstalTray from "gi://AstalTray"
import AstalWp from "gi://AstalWp"
import AstalNetwork from "gi://AstalNetwork"
import AstalBattery from "gi://AstalBattery"

/**
 * Bar modules.
 *
 * Each export is a pure render of service state - no polling loops, no
 * direct shelling out except for user-initiated actions.
 */

// --------------------------------------------------------------------- logo

export function Logo() {
	return (
		<button
			cssClasses={["bar-logo"]}
			tooltipText="Applications"
			onClicked={() => App.toggle_window("launcher")}
		>
			<box spacing={8}>
				<image iconName="aether-symbolic" cssClasses={["logo-mark"]} />
				<label label="Aether OS" cssClasses={["logo-text"]} />
			</box>
		</button>
	)
}

// --------------------------------------------------------------- workspaces

export function Workspaces() {
	const hypr = AstalHyprland.get_default()

	return (
		<box cssClasses={["workspaces"]} spacing={4}>
			{bind(hypr, "workspaces").as((wss) =>
				wss
					.filter((ws) => ws.id > 0)
					.sort((a, b) => a.id - b.id)
					.map((ws) => (
						<button
							cssClasses={bind(hypr, "focusedWorkspace").as((fw) =>
								fw?.id === ws.id ? ["ws", "active"] : ["ws"],
							)}
							onClicked={() => ws.focus()}
						>
							<label label={String(ws.id)} />
						</button>
					)),
			)}
		</box>
	)
}

// ------------------------------------------------------------- active window

export function ActiveWindow() {
	const hypr = AstalHyprland.get_default()

	return (
		<label
			cssClasses={["active-window"]}
			maxWidthChars={38}
			ellipsize={3}
			label={bind(hypr, "focusedClient").as((c) => (c ? c.title || c.class : "Desktop"))}
		/>
	)
}

// -------------------------------------------------------------------- clock

const now = Variable(GLib.DateTime.new_now_local()).poll(1000, () =>
	GLib.DateTime.new_now_local(),
)

export function Clock() {
	return (
		<button cssClasses={["clock"]} onClicked={() => App.toggle_window("control-center")}>
			<box spacing={10}>
				<label cssClasses={["date"]} label={bind(now).as((t) => t.format("%a, %d %b")!)} />
				<label cssClasses={["time"]} label={bind(now).as((t) => t.format("%I:%M %p")!)} />
			</box>
		</button>
	)
}

// --------------------------------------------------------------------- tray

export function Tray() {
	const tray = AstalTray.get_default()

	return (
		<box cssClasses={["tray"]} spacing={8}>
			{bind(tray, "items").as((items) =>
				items.map((item) => (
					<menubutton cssClasses={["tray-item"]} tooltipText={bind(item, "tooltipMarkup")}>
						<image gicon={bind(item, "gicon")} />
						<popover>{Gtk.PopoverMenu.new_from_model(item.menuModel)}</popover>
					</menubutton>
				)),
			)}
		</box>
	)
}

// --------------------------------------------------------------- indicators

export function Indicators() {
	const speaker = AstalWp.get_default()?.audio.defaultSpeaker
	const network = AstalNetwork.get_default()

	return (
		<button cssClasses={["indicators"]} onClicked={() => App.toggle_window("control-center")}>
			<box spacing={10}>
				<image iconName="display-brightness-symbolic" />
				<image
					iconName={bind(network, "primary").as(
						() => network.wifi?.iconName ?? "network-wired-symbolic",
					)}
				/>
				{speaker && <image iconName={bind(speaker, "volumeIcon")} />}
			</box>
		</button>
	)
}

// ------------------------------------------------------------------ battery

export function Battery() {
	const bat = AstalBattery.get_default()

	return (
		<box
			cssClasses={["battery"]}
			spacing={6}
			visible={bind(bat, "isPresent")}
			tooltipText={bind(bat, "percentage").as((p) => `${Math.round(p * 100)}%`)}
		>
			<image iconName={bind(bat, "batteryIconName")} />
			<label label={bind(bat, "percentage").as((p) => `${Math.round(p * 100)}%`)} />
		</box>
	)
}

// -------------------------------------------------------------------- power

export function Power() {
	return (
		<menubutton cssClasses={["power"]} tooltipText="Session">
			<image iconName="system-shutdown-symbolic" />
			<popover cssClasses={["glass", "power-menu"]}>
				<box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
					<button onClicked={() => execAsync(["loginctl", "lock-session"])}>
						<box spacing={10}>
							<image iconName="system-lock-screen-symbolic" />
							<label label="Lock" />
						</box>
					</button>
					<button onClicked={() => execAsync(["systemctl", "suspend"])}>
						<box spacing={10}>
							<image iconName="weather-clear-night-symbolic" />
							<label label="Suspend" />
						</box>
					</button>
					<button onClicked={() => execAsync(["systemctl", "reboot"])}>
						<box spacing={10}>
							<image iconName="system-reboot-symbolic" />
							<label label="Restart" />
						</box>
					</button>
					<button
						cssClasses={["danger"]}
						onClicked={() => execAsync(["systemctl", "poweroff"])}
					>
						<box spacing={10}>
							<image iconName="system-shutdown-symbolic" />
							<label label="Power Off" />
						</box>
					</button>
				</box>
			</popover>
		</menubutton>
	)
}

export default {
	Logo,
	Workspaces,
	ActiveWindow,
	Clock,
	Tray,
	Indicators,
	Battery,
	Power,
}

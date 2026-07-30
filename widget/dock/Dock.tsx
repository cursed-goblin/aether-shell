import { App, Astal, Gdk, Gtk } from "astal/gtk4"
import { bind, execAsync } from "astal"
import Gio from "gi://Gio"
import AstalHyprland from "gi://AstalHyprland"
import AstalApps from "gi://AstalApps"

import { config } from "../../service/config"

/**
 * Floating dock. Pinned apps come from config, running apps are appended
 * from the compositor's client list and get a running indicator dot.
 */
export default function Dock(monitor: Gdk.Monitor) {
	const { BOTTOM } = Astal.WindowAnchor
	const hypr = AstalHyprland.get_default()
	const apps = new AstalApps.Apps()

	function launch(id: string) {
		const [match] = apps.fuzzy_query(id)
		if (match) match.launch()
		else execAsync(["sh", "-c", id]).catch(() => {})
	}

	function PinnedApp(id: string) {
		const [entry] = apps.fuzzy_query(id)

		return (
			<button
				cssClasses={bind(hypr, "clients").as((clients) =>
					clients.some((c) => c.class.toLowerCase().includes(id.toLowerCase()))
						? ["app", "running"]
						: ["app"],
				)}
				tooltipText={entry?.name ?? id}
				onClicked={() => launch(id)}
			>
				<image
					iconName={entry?.iconName ?? "application-x-executable-symbolic"}
					pixelSize={config.dock.iconSize}
				/>
			</button>
		)
	}

	return (
		<window
			name={`dock-${monitor.get_connector()}`}
			namespace="aether-dock"
			cssClasses={["dock-window"]}
			gdkmonitor={monitor}
			anchor={BOTTOM}
			exclusivity={
				config.dock.autohide ? Astal.Exclusivity.NORMAL : Astal.Exclusivity.EXCLUSIVE
			}
			layer={Astal.Layer.TOP}
			application={App}
		>
			<box cssClasses={["dock", "glass"]} spacing={10}>
				{config.dock.pinned.map(PinnedApp)}
				<box cssClasses={["dock-sep"]} />
				<button
					cssClasses={["app", "ai"]}
					tooltipText="Aether AI"
					onClicked={() => App.toggle_window("ai")}
				>
					<image iconName="starred-symbolic" pixelSize={config.dock.iconSize} />
				</button>
				<button
					cssClasses={["app"]}
					tooltipText="Trash"
					onClicked={() =>
						Gio.AppInfo.launch_default_for_uri("trash:///", null)
					}
				>
					<image iconName="user-trash-symbolic" pixelSize={config.dock.iconSize} />
				</button>
			</box>
		</window>
	)
}

void Gtk

import { App, Astal, Gdk } from "astal/gtk4"
import { config } from "../../service/config"

import {
	Logo,
	Workspaces,
	ActiveWindow,
	Clock,
	Tray,
	Indicators,
	Battery,
	Power,
} from "./Modules"

const MODULES: Record<string, () => JSX.Element> = {
	logo: Logo,
	workspaces: Workspaces,
	activeWindow: ActiveWindow,
	clock: Clock,
	tray: Tray,
	indicators: Indicators,
	battery: Battery,
	power: Power,
}

function section(names: string[], cssClass: string) {
	return (
		<box cssClasses={["bar-section", cssClass]} spacing={10}>
			{names.map((name) => MODULES[name]?.() ?? <box />)}
		</box>
	)
}

/** Top/bottom bar. One instance per monitor, exclusive zone reserved. */
export default function Bar(monitor: Gdk.Monitor) {
	const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
	const edge = config.bar.position === "bottom" ? BOTTOM : TOP

	return (
		<window
			name={`bar-${monitor.get_connector()}`}
			namespace="aether-bar"
			cssClasses={["bar", "glass"]}
			gdkmonitor={monitor}
			exclusivity={Astal.Exclusivity.EXCLUSIVE}
			anchor={edge | LEFT | RIGHT}
			application={App}
		>
			<centerbox cssClasses={["bar-inner"]} heightRequest={config.bar.height}>
				{section(config.bar.left, "start")}
				{section(config.bar.center, "center")}
				{section(config.bar.right, "end")}
			</centerbox>
		</window>
	)
}

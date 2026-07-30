import { App } from "astal/gtk4"
import style from "./style/main.scss"

import { config, watchConfig } from "./service/config"
import { ai } from "./service/ai"

import Bar from "./widget/bar/Bar"
import Dock from "./widget/dock/Dock"
import Launcher from "./widget/launcher/Launcher"
import ControlCenter from "./widget/control-center/ControlCenter"
import NotificationPopups from "./widget/notifications/Popups"
import Osd from "./widget/osd/Osd"
import AiPanel from "./widget/ai/AiPanel"

/**
 * Entry point.
 *
 * Every surface below is an independent Wayland layer-shell window.
 * Nothing here talks to the system directly - widgets render state that
 * lives in `service/`.
 */
function main() {
	const monitors = App.get_monitors()
	const primary = monitors[0]

	for (const monitor of monitors) {
		Bar(monitor)
		if (config.dock.enabled) Dock(monitor)
	}

	// Single-instance surfaces live on the focused/primary monitor.
	Launcher(primary)
	ControlCenter(primary)
	AiPanel(primary)
	Osd(primary)
	NotificationPopups(primary)

	watchConfig()
	ai.init()
}

App.start({
	instanceName: "aether",
	css: style,
	main,

	/**
	 * IPC surface, so keybinds can drive the shell:
	 *   astal -i aether toggle launcher
	 *   astal -i aether toggle control-center
	 *   astal -i aether toggle ai
	 *   astal -i aether ai "summarize my clipboard"
	 */
	requestHandler(request: string, res: (response: string) => void) {
		const [cmd, ...rest] = request.trim().split(/\s+/)
		const arg = rest.join(" ")

		switch (cmd) {
			case "toggle":
				App.toggle_window(arg)
				return res(`toggled ${arg}`)

			case "open":
				App.get_window(arg)?.show()
				return res(`opened ${arg}`)

			case "close":
				App.get_window(arg)?.hide()
				return res(`closed ${arg}`)

			case "ai":
				App.get_window("ai")?.show()
				if (arg) ai.ask(arg)
				return res("ok")

			case "reload":
				return res("config reloaded")

			default:
				return res(
					"unknown command. try: toggle|open|close <window> | ai <prompt> | reload",
				)
		}
	},
})

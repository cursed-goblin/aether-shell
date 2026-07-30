import { App, Astal, Gdk, Gtk } from "astal/gtk4"
import { Variable, bind } from "astal"
import AstalApps from "gi://AstalApps"

import { config } from "../../service/config"
import { ai } from "../../service/ai"

/**
 * App launcher.
 *
 * Typing `?` (configurable) as the first character turns the query into an
 * AI prompt and hands it to the agent panel instead of searching apps.
 */
export default function Launcher(monitor: Gdk.Monitor) {
	const apps = new AstalApps.Apps()
	const query = Variable("")
	const results = Variable<AstalApps.Application[]>([])

	let entryRef: Gtk.Entry

	function search(text: string) {
		query.set(text)
		if (text.startsWith(config.launcher.askAiPrefix)) {
			results.set([])
			return
		}
		results.set(apps.fuzzy_query(text).slice(0, config.launcher.maxResults))
	}

	function close() {
		query.set("")
		results.set([])
		entryRef?.set_text("")
		App.get_window("launcher")?.hide()
	}

	function submit() {
		const text = query.get().trim()

		if (text.startsWith(config.launcher.askAiPrefix)) {
			const prompt = text.slice(config.launcher.askAiPrefix.length).trim()
			close()
			App.get_window("ai")?.show()
			if (prompt) ai.ask(prompt)
			return
		}

		const [first] = results.get()
		if (first) {
			first.launch()
			close()
		}
	}

	return (
		<window
			name="launcher"
			namespace="aether-launcher"
			cssClasses={["launcher-window"]}
			gdkmonitor={monitor}
			anchor={Astal.WindowAnchor.TOP}
			layer={Astal.Layer.OVERLAY}
			keymode={Astal.Keymode.EXCLUSIVE}
			visible={false}
			application={App}
			onKeyPressed={(_self, keyval) => {
				if (keyval === Gdk.KEY_Escape) close()
			}}
		>
			<box cssClasses={["launcher", "glass"]} orientation={Gtk.Orientation.VERTICAL}>
				<box cssClasses={["launcher-search"]} spacing={10}>
					<image iconName="system-search-symbolic" />
					<entry
						$={(self) => (entryRef = self)}
						hexpand
						placeholderText={`Search apps\u2026  \u00b7  ${config.launcher.askAiPrefix} to ask Aether AI`}
						onNotifyText={(self) => search(self.text)}
						onActivate={submit}
					/>
				</box>

				<box
					cssClasses={["ai-hint"]}
					visible={bind(query).as((q) => q.startsWith(config.launcher.askAiPrefix))}
					spacing={10}
				>
					<image iconName="starred-symbolic" />
					<label
						hexpand
						xalign={0}
						label={bind(query).as(
							(q) => `Ask Aether AI: ${q.slice(1).trim() || "\u2026"}`,
						)}
					/>
					<label cssClasses={["kbd"]} label="Enter" />
				</box>

				<scrolledwindow
					cssClasses={["launcher-results"]}
					vexpand
					visible={bind(results).as((r) => r.length > 0)}
				>
					<box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
						{bind(results).as((list) =>
							list.map((app) => (
								<button
									cssClasses={["result"]}
									onClicked={() => {
										app.launch()
										close()
									}}
								>
									<box spacing={12}>
										<image iconName={app.iconName} pixelSize={32} />
										<box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
											<label cssClasses={["name"]} xalign={0} label={app.name} />
											<label
												cssClasses={["desc"]}
												xalign={0}
												visible={Boolean(app.description)}
												ellipsize={3}
												maxWidthChars={52}
												label={app.description ?? ""}
											/>
										</box>
									</box>
								</button>
							)),
						)}
					</box>
				</scrolledwindow>
			</box>
		</window>
	)
}

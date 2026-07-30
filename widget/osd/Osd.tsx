import { App, Astal, Gdk, Gtk } from "astal/gtk4"
import { Variable, bind, timeout } from "astal"
import AstalWp from "gi://AstalWp"

import { systemStats } from "../../service/system"

/** Volume / brightness on-screen display. Auto-hides after 1.5s. */
export default function Osd(monitor: Gdk.Monitor) {
	const speaker = AstalWp.get_default()?.audio.defaultSpeaker
	const visible = Variable(false)
	const icon = Variable("audio-volume-high-symbolic")
	const value = Variable(0)

	let hideTimer: ReturnType<typeof timeout> | null = null
	let primed = false

	function show(nextIcon: string, nextValue: number) {
		// Skip the initial emission on startup.
		if (!primed) {
			primed = true
			return
		}
		icon.set(nextIcon)
		value.set(nextValue)
		visible.set(true)
		hideTimer?.cancel()
		hideTimer = timeout(1500, () => visible.set(false))
	}

	speaker?.connect("notify::volume", () => show(speaker.volumeIcon, speaker.volume))
	speaker?.connect("notify::mute", () =>
		show(speaker.volumeIcon, speaker.mute ? 0 : speaker.volume),
	)

	let lastBrightness = systemStats.get().brightness
	systemStats.subscribe((s) => {
		if (Math.abs(s.brightness - lastBrightness) > 0.01) {
			lastBrightness = s.brightness
			show("display-brightness-symbolic", s.brightness)
		}
	})

	return (
		<window
			name="osd"
			namespace="aether-osd"
			cssClasses={["osd-window"]}
			gdkmonitor={monitor}
			anchor={Astal.WindowAnchor.BOTTOM}
			layer={Astal.Layer.OVERLAY}
			visible={bind(visible)}
			application={App}
		>
			<box cssClasses={["osd", "glass"]} spacing={14}>
				<image iconName={bind(icon)} pixelSize={20} />
				<levelbar
					cssClasses={["osd-bar"]}
					widthRequest={180}
					valign={Gtk.Align.CENTER}
					value={bind(value)}
					minValue={0}
					maxValue={1}
				/>
				<label
					cssClasses={["osd-value"]}
					label={bind(value).as((v) => `${Math.round(v * 100)}%`)}
				/>
			</box>
		</window>
	)
}

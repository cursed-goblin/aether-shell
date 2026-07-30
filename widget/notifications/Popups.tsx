import { App, Astal, Gdk, Gtk } from "astal/gtk4"
import { bind, timeout } from "astal"
import AstalNotifd from "gi://AstalNotifd"

import { config } from "../../service/config"

/** Transient notification popups stacked under the bar. */
export default function NotificationPopups(monitor: Gdk.Monitor) {
	const notifd = AstalNotifd.get_default()

	function urgency(n: AstalNotifd.Notification): string {
		switch (n.urgency) {
			case AstalNotifd.Urgency.CRITICAL:
				return "critical"
			case AstalNotifd.Urgency.LOW:
				return "low"
			default:
				return "normal"
		}
	}

	function Notification(n: AstalNotifd.Notification) {
		timeout(config.notifications.timeout, () => n.dismiss())

		return (
			<box cssClasses={["notification", "glass", urgency(n)]} spacing={12}>
				<image
					cssClasses={["app-icon"]}
					iconName={n.appIcon || n.desktopEntry || "dialog-information-symbolic"}
					pixelSize={32}
					valign={Gtk.Align.START}
				/>
				<box orientation={Gtk.Orientation.VERTICAL} hexpand spacing={4}>
					<box>
						<label cssClasses={["summary"]} xalign={0} hexpand ellipsize={3} label={n.summary} />
						<label cssClasses={["app"]} label={n.appName} />
					</box>
					<label
						cssClasses={["body"]}
						xalign={0}
						wrap
						maxWidthChars={40}
						visible={Boolean(n.body)}
						label={n.body}
					/>
					<box spacing={8} visible={n.get_actions().length > 0}>
						{n.get_actions().map((action) => (
							<button cssClasses={["action"]} onClicked={() => n.invoke(action.id)}>
								<label label={action.label} />
							</button>
						))}
					</box>
				</box>
				<button cssClasses={["close"]} valign={Gtk.Align.START} onClicked={() => n.dismiss()}>
					<image iconName="window-close-symbolic" />
				</button>
			</box>
		)
	}

	return (
		<window
			name="notifications"
			namespace="aether-notifications"
			cssClasses={["notification-window"]}
			gdkmonitor={monitor}
			anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
			layer={Astal.Layer.OVERLAY}
			application={App}
		>
			<box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
				{bind(notifd, "notifications").as((list) =>
					list.slice(-config.notifications.maxPopups).reverse().map(Notification),
				)}
			</box>
		</window>
	)
}

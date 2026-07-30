import { App, Astal, Gdk, Gtk } from "astal/gtk4"
import { Variable, bind } from "astal"

import { config } from "../../service/config"
import { ai, type Message } from "../../service/ai"
import { PROVIDERS } from "../../service/providers"

/**
 * Aether AI panel.
 *
 * The whole agent backend is API-key driven (service/ai.ts + providers.ts).
 * This file only renders conversation state and pushes prompts in.
 */
export default function AiPanel(monitor: Gdk.Monitor) {
	const draft = Variable("")
	let entryRef: Gtk.Entry
	let scrollRef: Gtk.ScrolledWindow

	function scrollToBottom() {
		const adj = scrollRef?.get_vadjustment()
		if (adj) adj.set_value(adj.get_upper())
	}

	function send(text?: string) {
		const prompt = (text ?? draft.get()).trim()
		if (!prompt) return
		ai.ask(prompt)
		draft.set("")
		entryRef?.set_text("")
		scrollToBottom()
	}

	ai.messages.subscribe(() => scrollToBottom())

	// ------------------------------------------------------------------ header

	const Header = () => (
		<box cssClasses={["ai-header"]} spacing={10}>
			<image cssClasses={["ai-mark"]} iconName="starred-symbolic" />
			<box orientation={Gtk.Orientation.VERTICAL} hexpand>
				<label cssClasses={["title"]} xalign={0} label="Aether AI" />
				<label cssClasses={["subtitle"]} xalign={0} label={bind(ai.statusText)} />
			</box>

			<menubutton cssClasses={["icon-btn"]} tooltipText="Model">
				<image iconName="emblem-system-symbolic" />
				<popover cssClasses={["glass", "model-menu"]}>
					<box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
						<label cssClasses={["menu-head"]} xalign={0} label="Provider" />
						{Object.entries(PROVIDERS).map(([id, p]) => (
							<button
								cssClasses={id === config.ai.provider ? ["row", "active"] : ["row"]}
								onClicked={() => {
									config.ai.provider = id
									config.ai.model = ""
									ai.init()
								}}
							>
								<box spacing={10}>
									<label hexpand xalign={0} label={p.name} />
									<label cssClasses={["dim"]} label={p.defaultModel} />
								</box>
							</button>
						))}
						<box cssClasses={["menu-sep"]} />
						<label cssClasses={["menu-foot"]} xalign={0} label={`key: ${ai.keyPreview()}`} />
					</box>
				</popover>
			</menubutton>

			<button cssClasses={["icon-btn"]} tooltipText="New chat" onClicked={() => ai.clear()}>
				<image iconName="document-new-symbolic" />
			</button>
			<button
				cssClasses={["icon-btn"]}
				tooltipText="Close"
				onClicked={() => App.get_window("ai")?.hide()}
			>
				<image iconName="window-close-symbolic" />
			</button>
		</box>
	)

	// ------------------------------------------------------------ empty state

	function QuickCard(action: (typeof config.ai.quickActions)[number]) {
		return (
			<button cssClasses={["quick-card"]} onClicked={() => send(ai.expand(action.prompt))}>
				<box spacing={10}>
					<image cssClasses={["badge"]} iconName={action.icon} />
					<box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
						<label cssClasses={["t"]} xalign={0} label={action.title} />
						<label cssClasses={["s"]} xalign={0} label={action.subtitle} />
					</box>
				</box>
			</button>
		)
	}

	const QuickActions = () => (
		<box cssClasses={["ai-empty"]} orientation={Gtk.Orientation.VERTICAL} spacing={16} vexpand>
			<box cssClasses={["orb"]} halign={Gtk.Align.END} />
			<box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
				<label cssClasses={["greeting"]} xalign={0} label="Hello." />
				<label cssClasses={["greeting-sub"]} xalign={0} label="How can I help you today?" />
			</box>

			<box cssClasses={["quick-grid"]} spacing={10} homogeneous>
				<box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
					{config.ai.quickActions.slice(0, 2).map(QuickCard)}
				</box>
				<box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
					{config.ai.quickActions.slice(2, 4).map(QuickCard)}
				</box>
			</box>
		</box>
	)

	// -------------------------------------------------------------- transcript

	function Bubble(msg: Message) {
		const classes = ["bubble", msg.role]
		if (msg.error) classes.push("error")
		if (msg.pending) classes.push("pending")

		return (
			<box
				cssClasses={classes}
				halign={msg.role === "user" ? Gtk.Align.END : Gtk.Align.START}
				orientation={Gtk.Orientation.VERTICAL}
			>
				<label
					cssClasses={["text"]}
					xalign={0}
					wrap
					selectable
					maxWidthChars={56}
					label={msg.content || "\u2026"}
				/>
			</box>
		)
	}

	const Transcript = () => (
		<scrolledwindow
			$={(self) => (scrollRef = self)}
			cssClasses={["ai-transcript"]}
			vexpand
			visible={bind(ai.messages).as((m) => m.length > 0)}
		>
			<box orientation={Gtk.Orientation.VERTICAL} spacing={10}>
				{bind(ai.messages).as((msgs) => msgs.map(Bubble))}
			</box>
		</scrolledwindow>
	)

	// ------------------------------------------------------------------ prompt

	const Composer = () => (
		<box cssClasses={["ai-composer"]} orientation={Gtk.Orientation.VERTICAL} spacing={8}>
			<box cssClasses={["input"]} spacing={10}>
				<entry
					$={(self) => (entryRef = self)}
					hexpand
					placeholderText="Ask anything\u2026"
					onNotifyText={(self) => draft.set(self.text)}
					onActivate={() => send()}
				/>
				<button
					cssClasses={["stop"]}
					visible={bind(ai.status).as((s) => s === "streaming" || s === "thinking")}
					tooltipText="Stop"
					onClicked={() => ai.cancel()}
				>
					<image iconName="media-playback-stop-symbolic" />
				</button>
				<button cssClasses={["send"]} tooltipText="Send" onClicked={() => send()}>
					<image iconName="go-next-symbolic" />
				</button>
			</box>
			<label
				cssClasses={["disclaimer"]}
				label={bind(ai.status).as((s) =>
					s === "unconfigured"
						? "No API key set \u2014 run: aether-shell setup"
						: "Aether AI can make mistakes. Verify important information.",
				)}
			/>
		</box>
	)

	// ------------------------------------------------------------------ window

	return (
		<window
			name="ai"
			namespace="aether-ai"
			cssClasses={["ai-window"]}
			gdkmonitor={monitor}
			anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT | Astal.WindowAnchor.BOTTOM}
			layer={Astal.Layer.OVERLAY}
			keymode={Astal.Keymode.ON_DEMAND}
			visible={false}
			application={App}
			onKeyPressed={(_self, keyval) => {
				if (keyval === Gdk.KEY_Escape) App.get_window("ai")?.hide()
			}}
		>
			<box cssClasses={["ai-panel", "glass"]} orientation={Gtk.Orientation.VERTICAL}>
				<Header />
				<box cssClasses={["ai-body"]} orientation={Gtk.Orientation.VERTICAL} vexpand>
					<box
						visible={bind(ai.messages).as((m) => m.length === 0)}
						orientation={Gtk.Orientation.VERTICAL}
						vexpand
					>
						<QuickActions />
					</box>
					<Transcript />
				</box>
				<Composer />
			</box>
		</window>
	)
}

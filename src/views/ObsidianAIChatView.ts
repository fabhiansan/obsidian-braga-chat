import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import ChatApp from "../components/ChatApp";
import { ChatErrorBoundary } from "../components/presentational/ErrorBoundary";
import { ChatApiManager } from "../api";
import { App } from "obsidian";
import { StoredChatData, ChatMessage } from "../types";
import { ObsidianAISettings } from "../settings";
import type { SyncLogEntry, SyncProgressSnapshot } from "../sync/SyncProgress";

interface ChatLogger {
	log(level: string, ...args: unknown[]): void;
}

export const CHAT_VIEWTYPE = "braga-chat-view";

export interface ChatPluginLike {
	app: App;
	chatapi: ChatApiManager;
	manifest: { id: string };
	settings: ObsidianAISettings;
	logger?: ChatLogger;
	personaLoader: import("../intelligence/PersonaLoader").PersonaLoader | null;
	searchIndex: import("../search/index").SearchIndex | null;
	integrationRegistry?: import("../integrations/ProviderRegistry").ProviderRegistry;
	openSessionInNewTab(sessionId: string, messageId: string): Promise<void>;
	loadChatData(): Promise<StoredChatData>;
	/** Read one session's message file into memory (index-only boot). */
	hydrateSession?(sessionId: string): Promise<ChatMessage[]>;
	peekSessionMessages?(sessionId: string): Promise<ChatMessage[]>;
	/** False while a session's messages exist on disk but aren't in memory. */
	isSessionHydrated?(sessionId: string): boolean;
	saveChatData(data: StoredChatData): Promise<void>;
	saveSettings(): Promise<void>;
	openRemoteStorageSettings?(): void;
	syncHub?: import("../sync/SyncStatusHub").SyncStatusHub;
	triggerSync?(
		dryRun?: boolean,
		options?: {
			useModal?: boolean;
			direction?: "both" | "upload" | "download";
		},
	): Promise<{ ok: boolean; message: string }>;
	/** T46: Read-only comparison of local vs remote stores for the examine step. */
	examineSync?(
		direction?: "both" | "upload" | "download",
	): Promise<import("../sync/SyncEngine").SyncExamination | null>;
	rebuildSyncIndex?(
		choice: "remote" | "local" | "compare",
		options?: {
			onLog?: (entry: SyncLogEntry) => void;
			onProgress?: (progress: SyncProgressSnapshot) => void;
		},
	): Promise<{
		uploaded: number;
		downloaded: number;
		conflicts: number;
		skipped: number;
	}>;
	cancelSync?(): void;
	onSessionEnd?(session: import("../types").ChatSession): Promise<void>;
}

export interface ObsidianAIChatViewOptions {
	/** Optional profile ID to bind this chat panel to. */
	profileId?: string;
	sessionId?: string;
	messageId?: string;
}

export class ObsidianAIChatView extends ItemView {
	private root: Root | null = null;
	private plugin: ChatPluginLike;
	private options: ObsidianAIChatViewOptions;
	private renderPending = false;

	constructor(
		leaf: WorkspaceLeaf,
		plugin: ChatPluginLike,
		options: ObsidianAIChatViewOptions = {},
	) {
		super(leaf);
		this.plugin = plugin;
		this.options = options;
	}

	getViewType(): string {
		return CHAT_VIEWTYPE;
	}

	getDisplayText(): string {
		return "Chat Lab AI";
	}

	getIcon(): string {
		return "message-square";
	}

	async onOpen(): Promise<void> {
		// Defensive: ensure clean container before first render.
		// On desktop Obsidian may call onOpen + setState in quick succession,
		// and contentEl can contain stale DOM from a previous mount.
		this.contentEl.empty();
		this.plugin.logger?.log(
			"info",
			`[ChatView] opened — profile: ${this.options.profileId ?? "default"}`,
		);
		this.render();
	}

	getState(): Record<string, unknown> {
		return { ...this.options };
	}

	async setState(
		state: Record<string, unknown>,
		result: unknown,
	): Promise<void> {
		this.options = {
			...this.options,
			...(state as ObsidianAIChatViewOptions),
		};
		await super.setState(state, result as never);
		this.render();
	}

	private render(): void {
		// Prevent concurrent renders that can duplicate content on desktop
		if (this.renderPending) return;
		this.renderPending = true;

		if (!this.root) {
			this.root = createRoot(this.contentEl);
		}

		this.root.render(
			createElement(
				ChatErrorBoundary,
				null,
				createElement(ChatApp, {
					plugin: this.plugin,
					profileId: this.options.profileId,
					initialSessionId: this.options.sessionId,
					initialMessageId: this.options.messageId,
				}),
			),
		);

		// Clear the guard after React has processed the render
		queueMicrotask(() => {
			this.renderPending = false;
		});
	}

	async onClose(): Promise<void> {
		this.plugin.logger?.log("info", "[ChatView] closed");
		this.root?.unmount();
		this.root = null;
		this.renderPending = false;
	}
}

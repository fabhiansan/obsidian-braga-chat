// main.ts
import { Plugin } from "obsidian";
import { ObsidianAISettings, DEFAULT_SETTINGS } from "./settings";
import { ChatApiManager } from "./api";
import { FileLogger } from "./logger";
import { SessionStorage } from "./storage/session-storage";
import { PersonaLoader } from "./intelligence/PersonaLoader";
import { SearchIndex } from "./search/index";
import { SessionSummarizer } from "./intelligence/SessionSummarizer";
import { SyncEngine } from "./sync/SyncEngine";
import { SyncStatusHub } from "./sync/SyncStatusHub";
import { mountSyncStatusBar } from "./sync/SyncStatusBar";
import { ProviderRegistry } from "./integrations/ProviderRegistry";
import { AgentApiManager } from "./api/AgentApiManager";
import { ChatStorage } from "./storage/ChatStorage";
import { PluginUpdater } from "./updater/PluginUpdater";
import { setCliAgentWorkspace } from "./api/cliAgents/CliAgentLanguageModel";
import { StoredChatData, ChatSession } from "./types";
import type { SyncLogEntry, SyncProgressSnapshot } from "./sync/SyncProgress";
import type { SyncRetryRecord } from "./sync/SyncRetryStore";

import {
	OPEN_CHAT_COMMAND_ID,
	OPEN_CHAT_COMMAND_NAME,
	registerChatView,
	registerCommands,
	registerRibbonIcon,
	registerEditorExtensions,
	registerSettingsTab,
	activateChatView,
	openSessionInNewTab,
	checkForUpdates,
	showAvailableBuilds,
} from "./ui/registration";
import { setupEventHandlers } from "./ui/events";
import {
	initializeStorage,
	loadSettings,
	saveSettings,
	loadChatData,
	hydrateChatSession,
	isChatSessionHydrated,
	peekChatSessionMessages,
	saveChatData,
	syncPluginData,
	onSessionEnd,
	openRemoteStorageSettings,
	cleanupStorage,
} from "./lifecycle/storage";
import {
	initSyncEngine,
	examineSync,
	rebuildSyncIndex,
	triggerSync,
	cancelSync,
} from "./lifecycle/sync";

export { OPEN_CHAT_COMMAND_ID, OPEN_CHAT_COMMAND_NAME };

export default class ObsidianAIPlugin extends Plugin {
	static readonly LEGACY_PLUGIN_ID = "obsidian-ai";
	static readonly LS_WEBDAV_PASSWORD = "obsidian-ai:webdav-password";
	settings: ObsidianAISettings = DEFAULT_SETTINGS;
	chatapi!: ChatApiManager;
	agentapi: AgentApiManager | null = null;
	logger!: FileLogger;
	sessionStorage: SessionStorage | null = null;
	personaLoader: PersonaLoader | null = null;
	searchIndex: SearchIndex | null = null;
	sessionSummarizer: SessionSummarizer | null = null;
	integrationRegistry!: ProviderRegistry;
	syncEngine: SyncEngine | null = null;
	syncIdentity: string | null = null;
	syncRetryStore:
		| import("./sync/SyncRetryStore").DurableSyncRetryStore
		| null = null;
	syncHub = new SyncStatusHub();

	// Data integrity guards
	_backupCreated = false;
	_settingsLoadedFromFile = false;
	_saveInProgress = false;
	_pendingChatData: StoredChatData | null = null;
	_lastSavedChatDataFingerprint: string | null = null;
	_chatStorage: ChatStorage | null = null;
	_migrationPromptShown = false;
	_chatViewActivation: Promise<void> | null = null;
	_updater: PluginUpdater | null = null;

	async onload() {
		const onloadStart = Date.now();
		// Register the entry command before asynchronous migration/settings work so
		// Obsidian's command palette can discover it even while startup completes.
		this.addCommand({
			id: OPEN_CHAT_COMMAND_ID,
			name: OPEN_CHAT_COMMAND_NAME,
			callback: () => this.activateChatView(),
		});

		const adapter = this.app.vault.adapter as { getBasePath?: () => string };
		setCliAgentWorkspace(adapter.getBasePath?.() ?? null);

		await initializeStorage(this);
		console.info(
			`[ObsidianAI] startup: initializeStorage done in ${Date.now() - onloadStart}ms`,
		);
		this.logger?.log(
			"info",
			`[Startup] initializeStorage done in ${Date.now() - onloadStart}ms`,
		);

		registerChatView(this);
		mountSyncStatusBar(this, () => activateChatView(this));
		this.logger?.log(
			"info",
			`[Startup] chat view registered at ${Date.now() - onloadStart}ms`,
		);
		registerRibbonIcon(this);
		registerEditorExtensions(this);
		registerCommands(this);
		registerSettingsTab(this);
		// Braga fork: no automatic update checks — they would pull upstream
		// builds over this fork. Updates come through the vault's git instead.

		setupEventHandlers(this);

		// Defer sync engine init to avoid blocking plugin load with network calls
		// (can take 10+ seconds if WebDAV server is slow or unreachable)
		initSyncEngine(this).catch((err) => {
			console.error("[ObsidianAI] Deferred SyncEngine init failed:", err);
		});
	}

	onunload() {
		cleanupStorage(this);
	}

	async activateChatView() {
		return activateChatView(this);
	}

	async openSessionInNewTab(
		sessionId: string,
		messageId: string,
	): Promise<void> {
		return openSessionInNewTab(this, sessionId, messageId);
	}

	async onSessionEnd(session: ChatSession): Promise<void> {
		return onSessionEnd(this, session);
	}

	async checkForUpdates(manual: boolean) {
		return checkForUpdates(this, manual);
	}

	async showAvailableBuilds() {
		return showAvailableBuilds(this);
	}

	async loadSettings() {
		return loadSettings(this);
	}

	async saveSettings() {
		return saveSettings(this);
	}

	async loadChatData(
		opts?: import("./storage/ChatStorage").LoadChatDataOptions,
	): Promise<StoredChatData> {
		return loadChatData(this, opts);
	}

	/** Read one session's message file into memory (index-only boot leaves
		sessions unhydrated until first open). Returns [] for unknown ids. */
	async hydrateSession(sessionId: string) {
		return hydrateChatSession(this, sessionId);
	}

	/** Pure read of a session's messages without changing hydration state
		(history copy/export, search). */
	async peekSessionMessages(sessionId: string) {
		return peekChatSessionMessages(this, sessionId);
	}

	isSessionHydrated(sessionId: string): boolean {
		return isChatSessionHydrated(this, sessionId);
	}

	async saveChatData(chatData: StoredChatData): Promise<void> {
		return saveChatData(this, chatData);
	}

	async rebuildSyncIndex(
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
	}> {
		return rebuildSyncIndex(this, choice, options);
	}

	cancelSync(): void {
		return cancelSync(this);
	}

	async triggerSync(
		dryRun = false,
		options?: {
			useModal?: boolean;
			direction?: "both" | "upload" | "download";
			onProgress?: (progress: SyncProgressSnapshot) => void;
			onLog?: (entry: SyncLogEntry) => void;
			trigger?: "manual" | "auto";
		},
	): Promise<{
		ok: boolean;
		message: string;
		uploaded: number;
		downloaded: number;
		conflicts: number;
		skipped: number;
		errors: string[];
		pluginData?: {
			status: "complete" | "partial" | "failed";
			uploaded: boolean;
			downloaded: boolean;
			conflict: boolean;
			failed: number;
			errors: string[];
		};
		chatSessions?: {
			status: "complete" | "partial" | "failed";
			retryable: number;
		};
	}> {
		return triggerSync(this, dryRun, options);
	}

	async examineSync(direction?: "both" | "upload" | "download") {
		return examineSync(this, direction);
	}

	async syncPluginData(
		direction?: "upload" | "download" | "both",
		options?: {
			dryRun?: boolean;
			onProgress?: (event: {
				id: string;
				direction: "upload" | "download" | "conflict" | "skip";
				status: "start" | "done" | "error";
				error?: string;
			}) => void;
		},
	): Promise<{
		uploaded: boolean;
		downloaded: boolean;
		conflict: boolean;
		failed: number;
		errors: string[];
		status: "complete" | "partial" | "failed";
		retryable: SyncRetryRecord[];
		items: Array<{
			id: string;
			status: string;
			error?: string;
		}>;
	}> {
		return syncPluginData(this, direction, options);
	}

	openRemoteStorageSettings(): void {
		return openRemoteStorageSettings(this);
	}
}

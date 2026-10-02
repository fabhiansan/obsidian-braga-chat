import {
	CLI_DEFAULT_BINARY,
	CLI_DEFAULT_MODEL,
} from "./api/cliAgents/CliAgentLanguageModel";
import { cursorPrompt, selectionPrompt } from "./default_prompts";
import { SlashCommand } from "./modules/commands/source";
import { migrateRecentModelsToProviders } from "./lib/recentModels";

/** Automatic remote sync stays disabled until its behavior is fully verified. */
export const AUTO_SYNC_ENABLED = false;

export interface IntelligenceSettings {
	enableIntelligence: boolean;
	personaPath: string;
	memoryPath: string;
	identityContextBudget: number;
	/** Core memory size: small (50), medium (100), large (200) entries */
	memoryCoreSize: "small" | "medium" | "large";
	memoryBackupRetention: number;
	/** Auto-summarize sessions when they end (e.g. user starts new session) */
	autoSummarize: boolean;
	/** Min messages before auto-summarization triggers */
	autoSummarizeMinMessages: number;
	/** Allow AI to query memory audit log via read_memory_audit tool */
	enableMemoryAuditTool: boolean;
}

export interface SyncComponentConfig {
	chatSessions: boolean;
	pluginSettings: boolean;
	apiKeys: boolean;
	memory: boolean;
	memoryAudit: boolean;
	persona: boolean;
	usageStats: boolean;
}

/** Controls the optional telemetry block included in chat session exports. */
export interface DebugTelemetrySettings {
	includeProviderUsage: boolean;
	includeRequestEstimates: boolean;
	includeRequestBreakdown: boolean;
	includeToolDetails: boolean;
	includeContextMetadata: boolean;
	includeModelTiming: boolean;
}

export type ProviderType =
	| "openai"
	| "ollama"
	| "custom"
	| "gemini"
	| "azure"
	| "anthropic"
	| "deepseek"
	| "kimi"
	| "openrouter"
	| "agent"
	| "claude-code"
	| "codex"
	| "opencode";

export type WebSearchProvider =
	| "brave"
	| "duckduckgo"
	| "searxng"
	| "tavily"
	| "exa";

export type StorageBackendType = "none" | "webdav" | "s3" | "custom";

export interface WebDAVStorageConfig {
	type: "webdav";
	url: string;
	username: string;
	password: string;
	prefix: string;
	enabled: boolean;
}

export interface S3StorageConfig {
	type: "s3";
	endpoint: string;
	region: string;
	bucket: string;
	prefix: string;
	accessKeyId: string;
	secretAccessKey: string;
	enabled: boolean;
}

export interface RemoteStorageConfig {
	enabled: boolean;
	backend: StorageBackendType;
	passphrase: string;
	autoSync: boolean;
	syncIntervalMinutes: number;
	conflictStrategy: "last-write-wins" | "keep-both" | "manual";
	/** Sync direction: both ways, upload only, or download only (T43) */
	syncDirection: "both" | "upload" | "download";
	/** Permit sync to remove sessions inferred as deleted. */
	allowDeletions: boolean;
	webdav?: WebDAVStorageConfig;
	s3?: S3StorageConfig;
	lastSyncTime: number;
	/** Max parallel upload/download operations (T42c). */
	concurrencyLimit?: number;
}

export interface ModelCache {
	models: string[];
	fetchedAt: number;
	error?: string;
}

export interface ProviderProfile {
	id: string;
	name: string;
	provider: ProviderType;
	model: string;
	apiKey?: string;
	customURL?: string;
	azureEndpoint?: string;
	azureApiVersion?: string;
	modelCache?: ModelCache;
	// Agent provider fields
	endpointUrl?: string; // Agent: OpenResponses endpoint URL
	agentId?: string; // Agent: x-openclaw-agent-id header
	sessionKey?: string; // Agent: stable session key
	autoApprove?: boolean; // Agent: auto-execute tool calls
	maxSteps?: number; // Agent: max tool iterations
	createdAt: number;
	updatedAt: number;
}

export interface ObsidianAISettings {
	providerProfiles: ProviderProfile[];
	activeProviderProfileId: string;
	/** IDs of profiles selected in the multi-select toolbar (global default) */
	selectedProfileIds: string[];
	selectionPrompt: string;
	cursorPrompt: string;
	customCommands: SlashCommand[];
	commandPrefix: string;
	messageHistory: boolean;
	includeActiveNote: boolean;
	maxContextTokens: number;
	maxContextMessages: number;
	/** Total model request budget, including system prompt and response reserve. */
	maxRequestTokens: number;
	/** Number of newest messages retained verbatim by the budgeted builder. */
	preserveRecentMessages: number;
	/** Start semantic compaction at this estimated history size. */
	compactionTriggerTokens: number;
	/** Hysteresis release threshold for semantic compaction. */
	compactionReleaseTokens: number;
	/** Tokens reserved for the response and agent tool-loop continuations. */
	requestResponseReserveTokens: number;
	/** Maximum tokens of any persisted tool result replayed to the model. */
	maxToolResultTokens: number;
	/** How tool calls and results appear in history replay: "elide" = omit payloads (saves tokens), "preserve" = full detail (debug). */
	toolHistoryMode: "elide" | "preserve";
	maxSavedConversations: number;
	autoNameSessions: boolean;
	debugLogLevel: "off" | "error" | "info" | "debug";
	debugLogRetention: number;
	debugLogMaxSizeMB: number;
	/** Baseline memory snapshot interval; clamped to 60 seconds through 1 hour. */
	memoryLogIntervalSeconds: number;
	enableAgentTools: boolean;
	autoApply: boolean;
	/** IDs of peer-plugin providers allowed to offer tools to Obsidian AI. */
	enabledIntegrationProviderIds: string[];
	maxAgentSteps: number;
	pressEnterToSend: boolean;
	/** Preferred fixed width for each title in the shared chat tab strip. */
	chatTabTitleWidth: number;
	/** Show full request payload token count (system + history + message) instead of message-only */
	showFullRequestTokens: boolean;
	/** Reveal advanced controls in the Settings panel. */
	showAdvancedSettings: boolean;
	/** Enable enhanced telemetry capture and export details. */
	debugMode: boolean;
	/** Select which telemetry fields are included when debug mode is exported. */
	debugTelemetry: DebugTelemetrySettings;
	/** Restore saved internal chat tabs and their positions after a plugin reload. */
	restoreChatTabs: boolean;
	/** Enable developer mode: allows AI to read and modify plugin settings via tools. */
	developerMode: boolean;
	/** Chat storage format: 'legacy' = single data.json, 'jsonl' = split sessions */
	chatStorageFormat: "legacy" | "jsonl";
	/** Max sessions shown in sidebar before pagination */
	maxSessionsInSidebar: number;
	/** Number of rolling backups to keep of data.json */
	sessionBackupCount: number;
	/** How to display file paths in the context picker */
	contextPickerPathDisplay: "never" | "always" | "duplicates";
	// Web Search settings
	webSearchProvider: WebSearchProvider;
	braveApiKey: string;
	searxngUrl: string;
	tavilyApiKey: string;
	exaApiKey: string;

	// PDF extraction settings
	pdfExtractionMethod: "auto" | "server" | "client";
	pdfExtractionServerUrl: string;
	pdfMaxPages: number;

	// Intelligence Layer settings (T26)
	intelligence: IntelligenceSettings;

	// Multi-user sync settings (T40)
	syncRelayUrl: string;
	syncRelayUrlHistory: string[];
	syncRoomId: string;
	syncUserName: string;

	// Auto-updater settings
	checkForUpdates: boolean;
	updateChannel: "stable" | "dev";
	lastUpdateCheck: number;
	autoUpdate: boolean;

	// Remote storage / sync settings (T42)
	remoteStorage: RemoteStorageConfig;
	// Component-level sync selection (T55)
	syncComponents: SyncComponentConfig;

	/** Recently used models per provider, shared across credential profiles. */
	recentModels: Record<string, string[]>;

	/** Which settings sections are collapsed (persisted UI state) */
	collapsedSections?: Record<string, boolean>;
}

type LegacySettings = Partial<ObsidianAISettings> & {
	provider?: ProviderType;
	model?: string;
	apiKey?: string;
	customURL?: string;
	azureEndpoint?: string;
	azureApiVersion?: string;
};

const DEFAULT_PROFILE_ID = "default-provider-profile";

const generateId = (): string => {
	return `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getProviderColor = (provider: ProviderType): string => {
	const colors: Record<string, string> = {
		openai: "#10a37f",
		anthropic: "#d97757",
		google: "#4285f4",
		gemini: "#4285f4",
		deepseek: "#4d6bfa",
		ollama: "#ff6b35",
		openrouter: "#ef4444",
		kimi: "#2563eb",
		azure: "#0078d4",
		custom: "#8b5cf6",
		agent: "#f59e0b",
		"claude-code": "#d97757",
		codex: "#10a37f",
		opencode: "#525252",
	};
	return colors[provider] || "#6b7280";
};

export const getDefaultProfileName = (provider: ProviderType): string => {
	switch (provider) {
		case "openai":
			return "OpenAI";
		case "azure":
			return "Azure OpenAI";
		case "gemini":
			return "Gemini";
		case "anthropic":
			return "Anthropic";
		case "deepseek":
			return "DeepSeek";
		case "kimi":
			return "Kimi";
		case "openrouter":
			return "OpenRouter";
		case "custom":
			return "Custom endpoint";
		case "agent":
			return "Agent (OpenResponses)";
		case "claude-code":
			return "Claude Code";
		case "codex":
			return "Codex";
		case "opencode":
			return "opencode";
		case "ollama":
		default:
			return "Local Ollama";
	}
};

export const getDefaultModel = (provider: ProviderType): string => {
	switch (provider) {
		case "openai":
			return "gpt-4o-mini";
		case "gemini":
			return "gemini-pro";
		case "azure":
			return "gpt-4";
		case "anthropic":
			return "claude-3-5-sonnet-latest";
		case "deepseek":
			return "deepseek-chat";
		case "kimi":
			return "moonshot-v1-8k";
		case "openrouter":
			return "openai/gpt-4o-mini";
		case "custom":
			return "gpt-4o-mini";
		case "agent":
			return "openclaw";
		case "claude-code":
		case "codex":
		case "opencode":
			return CLI_DEFAULT_MODEL;
		case "ollama":
		default:
			return "llama3.2";
	}
};

export const getDefaultEndpoint = (provider: ProviderType): string => {
	switch (provider) {
		case "openai":
			return "https://api.openai.com/v1";
		case "anthropic":
			return "https://api.anthropic.com/v1";
		case "gemini":
			return "https://generativelanguage.googleapis.com/v1beta";
		case "deepseek":
			return "https://api.deepseek.com/v1";
		case "openrouter":
			return "https://openrouter.ai/api/v1";
		case "kimi":
			return "https://api.moonshot.ai/v1";
		case "ollama":
			return "http://localhost:11434/v1";
		case "agent":
			return "http://localhost:18789/v1/responses";
		// For CLI agents the endpoint field holds the executable path.
		case "claude-code":
		case "codex":
		case "opencode":
			return CLI_DEFAULT_BINARY[provider];
		case "custom":
			return "";
		case "azure":
		default:
			return "";
	}
};

export const createProviderProfile = (
	overrides: Partial<ProviderProfile> = {},
): ProviderProfile => {
	const now = Date.now();
	const provider = overrides.provider ?? "openai";
	return {
		id: overrides.id ?? generateId(),
		name: overrides.name ?? getDefaultProfileName(provider),
		provider,
		model: overrides.model ?? getDefaultModel(provider),
		apiKey: overrides.apiKey ?? "",
		customURL: overrides.customURL ?? "",
		azureEndpoint: overrides.azureEndpoint ?? "",
		azureApiVersion: overrides.azureApiVersion ?? "2024-02-15-preview",
		modelCache: overrides.modelCache,
		// Agent fields
		endpointUrl: overrides.endpointUrl ?? "",
		agentId: overrides.agentId ?? "main",
		sessionKey: overrides.sessionKey ?? "",
		autoApprove: overrides.autoApprove ?? false,
		maxSteps: overrides.maxSteps ?? 10,
		createdAt: overrides.createdAt ?? now,
		updatedAt: overrides.updatedAt ?? now,
	};
};

const DEFAULT_PROFILES: ProviderProfile[] = [
	createProviderProfile({
		id: DEFAULT_PROFILE_ID,
		name: "OpenAI",
		provider: "openai",
	}),
	createProviderProfile({ provider: "openai", name: "OpenAI" }),
	createProviderProfile({ provider: "anthropic", name: "Anthropic" }),
	createProviderProfile({ provider: "deepseek", name: "DeepSeek" }),
	createProviderProfile({ provider: "kimi", name: "Kimi" }),
	createProviderProfile({ provider: "gemini", name: "Gemini" }),
	createProviderProfile({ provider: "openrouter", name: "OpenRouter" }),
	createProviderProfile({ provider: "custom", name: "Custom endpoint" }),
	createProviderProfile({ provider: "agent", name: "Agent (OpenResponses)" }),
];

export const DEFAULT_SETTINGS: ObsidianAISettings = {
	providerProfiles: DEFAULT_PROFILES,
	activeProviderProfileId: DEFAULT_PROFILE_ID,
	selectedProfileIds: [],
	selectionPrompt: selectionPrompt,
	cursorPrompt: cursorPrompt,
	customCommands: [],
	commandPrefix: "/",
	messageHistory: false,
	includeActiveNote: false,
	maxContextTokens: 8000,
	maxContextMessages: 10,
	maxRequestTokens: 32000,
	preserveRecentMessages: 4,
	compactionTriggerTokens: 24000,
	compactionReleaseTokens: 16000,
	requestResponseReserveTokens: 4096,
	maxToolResultTokens: 4000,
	toolHistoryMode: "elide",
	maxSavedConversations: 20,
	autoNameSessions: false,
	chatStorageFormat: "legacy",
	maxSessionsInSidebar: 50,
	sessionBackupCount: 3,
	debugLogLevel: "error",
	debugLogRetention: 200,
	debugLogMaxSizeMB: 5,
	memoryLogIntervalSeconds: 60,
	enableAgentTools: true,
	autoApply: false,
	enabledIntegrationProviderIds: [],
	maxAgentSteps: 5,
	pressEnterToSend: true,
	chatTabTitleWidth: 160,
	restoreChatTabs: true,
	showFullRequestTokens: true,
	showAdvancedSettings: false,
	debugMode: false,
	debugTelemetry: {
		includeProviderUsage: true,
		includeRequestEstimates: true,
		includeRequestBreakdown: true,
		includeToolDetails: true,
		includeContextMetadata: true,
		includeModelTiming: true,
	},
	developerMode: false,
	contextPickerPathDisplay: "duplicates",
	webSearchProvider: "duckduckgo",
	braveApiKey: "",
	searxngUrl: "",
	tavilyApiKey: "",
	exaApiKey: "",
	pdfExtractionMethod: "auto",
	pdfExtractionServerUrl: "https://quantumofgravity.com/relay/pdf-extract/",
	pdfMaxPages: 50,
	intelligence: {
		enableIntelligence: false,
		personaPath: "intelligence/persona.md",
		memoryPath: "intelligence/memory.md",
		identityContextBudget: 2000,
		memoryCoreSize: "medium",
		memoryBackupRetention: 20,
		autoSummarize: false,
		autoSummarizeMinMessages: 4,
		enableMemoryAuditTool: false,
	},

	// Multi-user sync defaults (T40)
	syncRelayUrl: "ws://localhost:8080",
	syncRelayUrlHistory: [],
	syncRoomId: "obsidian-ai-chat",
	syncUserName: "User",

	// Auto-updater defaults
	checkForUpdates: true,
	updateChannel: "stable",
	lastUpdateCheck: 0,
	autoUpdate: false,

	// Remote storage defaults (T42)
	remoteStorage: {
		enabled: false,
		backend: "none",
		passphrase: "",
		autoSync: AUTO_SYNC_ENABLED,
		syncIntervalMinutes: 30,
		conflictStrategy: "last-write-wins",
		syncDirection: "both",
		allowDeletions: false,
		concurrencyLimit: 3,
		webdav: {
			type: "webdav",
			url: "",
			username: "",
			password: "",
			prefix: "obsidian-ai-sync/",
			enabled: false,
		},
		s3: {
			type: "s3",
			endpoint: "",
			region: "us-east-1",
			bucket: "",
			prefix: "obsidian-ai-sync/",
			accessKeyId: "",
			secretAccessKey: "",
			enabled: false,
		},
		lastSyncTime: 0,
	},
	// Component-level sync defaults (T55)
	syncComponents: {
		chatSessions: true,
		pluginSettings: true,
		apiKeys: false,
		memory: true,
		memoryAudit: false,
		persona: true,
		usageStats: false,
	},
	// Recently used models per provider
	recentModels: {},
	// Collapsible section state (persisted)
	collapsedSections: {},
};

export const normalizeSettings = (
	loadedSettings: LegacySettings | null | undefined,
): ObsidianAISettings => {
	const merged = {
		...DEFAULT_SETTINGS,
		...(loadedSettings ?? {}),
	};

	const providerProfiles =
		Array.isArray(loadedSettings?.providerProfiles) &&
		loadedSettings.providerProfiles.length > 0
			? loadedSettings.providerProfiles.map(normalizeProviderProfile)
			: [createProfileFromLegacySettings(loadedSettings)];

	const activeProviderProfileId: string = providerProfiles.some(
		(profile) => profile.id === loadedSettings?.activeProviderProfileId,
	)
		? (loadedSettings?.activeProviderProfileId as string)
		: providerProfiles[0].id;

	const selectedProfileIds: string[] = Array.isArray(
		loadedSettings?.selectedProfileIds,
	)
		? loadedSettings.selectedProfileIds.filter((id) =>
				providerProfiles.some((p) => p.id === id),
			)
		: [];
	const debugTelemetry: DebugTelemetrySettings = {
		...DEFAULT_SETTINGS.debugTelemetry,
		...(loadedSettings?.debugTelemetry ?? {}),
	};

	return {
		providerProfiles,
		activeProviderProfileId,
		selectedProfileIds,
		selectionPrompt: merged.selectionPrompt,
		cursorPrompt: merged.cursorPrompt,
		customCommands: merged.customCommands ?? [],
		commandPrefix: merged.commandPrefix || "/",
		messageHistory: Boolean(merged.messageHistory),
		includeActiveNote: Boolean(merged.includeActiveNote),
		maxContextTokens: merged.maxContextTokens ?? 8000,
		maxContextMessages: merged.maxContextMessages ?? 10,
		maxRequestTokens: merged.maxRequestTokens ?? 32000,
		preserveRecentMessages: merged.preserveRecentMessages ?? 4,
		compactionTriggerTokens: merged.compactionTriggerTokens ?? 24000,
		compactionReleaseTokens: merged.compactionReleaseTokens ?? 16000,
		requestResponseReserveTokens:
			merged.requestResponseReserveTokens ?? 4096,
		maxToolResultTokens: merged.maxToolResultTokens ?? 4000,
		toolHistoryMode:
			merged.toolHistoryMode === "preserve" ? "preserve" : "elide",
		maxSavedConversations: merged.maxSavedConversations ?? 20,
		autoNameSessions: Boolean(merged.autoNameSessions),
		chatStorageFormat:
			(merged.chatStorageFormat as "legacy" | "jsonl") ?? "legacy",
		maxSessionsInSidebar: merged.maxSessionsInSidebar ?? 50,
		sessionBackupCount: merged.sessionBackupCount ?? 3,
		debugLogLevel: merged.debugLogLevel ?? "error",
		debugLogRetention: merged.debugLogRetention ?? 200,
		debugLogMaxSizeMB: merged.debugLogMaxSizeMB ?? 5,
		memoryLogIntervalSeconds: Number.isFinite(
			merged.memoryLogIntervalSeconds,
		)
			? Math.min(
					3600,
					Math.max(60, Math.round(merged.memoryLogIntervalSeconds)),
				)
			: 60,
		enableAgentTools: Boolean(merged.enableAgentTools ?? true),
		autoApply: Boolean(merged.autoApply ?? false),
		enabledIntegrationProviderIds: Array.isArray(
			merged.enabledIntegrationProviderIds,
		)
			? merged.enabledIntegrationProviderIds.filter(
					(id): id is string => typeof id === "string",
				)
			: [],
		maxAgentSteps: merged.maxAgentSteps ?? 5,
		pressEnterToSend: Boolean(merged.pressEnterToSend ?? true),
		chatTabTitleWidth: Math.min(
			360,
			Math.max(
				120,
				Number.isFinite(merged.chatTabTitleWidth)
					? merged.chatTabTitleWidth
					: 160,
			),
		),
		restoreChatTabs: Boolean(merged.restoreChatTabs ?? true),
		showFullRequestTokens: Boolean(merged.showFullRequestTokens ?? true),
		showAdvancedSettings: Boolean(merged.showAdvancedSettings ?? false),
		debugMode: Boolean(merged.debugMode ?? false),
		debugTelemetry,
		developerMode: Boolean(merged.developerMode ?? false),
		contextPickerPathDisplay:
			(merged.contextPickerPathDisplay as
				| "never"
				| "always"
				| "duplicates") ?? "duplicates",
		webSearchProvider:
			(merged.webSearchProvider as WebSearchProvider) ?? "duckduckgo",
		braveApiKey: merged.braveApiKey ?? "",
		searxngUrl: merged.searxngUrl ?? "",
		tavilyApiKey: merged.tavilyApiKey ?? "",
		exaApiKey: merged.exaApiKey ?? "",
		pdfExtractionMethod:
			(merged.pdfExtractionMethod as "auto" | "server" | "client") ??
			"auto",
		pdfExtractionServerUrl:
			merged.pdfExtractionServerUrl ??
			"https://quantumofgravity.com/relay/pdf-extract/",
		pdfMaxPages: Number.isFinite(merged.pdfMaxPages)
			? (merged.pdfMaxPages as number)
			: 50,
		intelligence: {
			enableIntelligence: Boolean(
				merged.intelligence?.enableIntelligence ?? false,
			),
			personaPath:
				merged.intelligence?.personaPath ?? "intelligence/persona.md",
			memoryPath:
				merged.intelligence?.memoryPath ?? "intelligence/memory.md",
			identityContextBudget:
				merged.intelligence?.identityContextBudget ?? 2000,
			memoryCoreSize: merged.intelligence?.memoryCoreSize ?? "medium",
			memoryBackupRetention: Number.isFinite(
				merged.intelligence?.memoryBackupRetention,
			)
				? Math.max(
						0,
						Math.min(
							50,
							merged.intelligence!.memoryBackupRetention!,
						),
					)
				: 20,
			autoSummarize: Boolean(merged.intelligence?.autoSummarize ?? false),
			autoSummarizeMinMessages:
				merged.intelligence?.autoSummarizeMinMessages ?? 4,
			enableMemoryAuditTool: Boolean(
				merged.intelligence?.enableMemoryAuditTool ?? false,
			),
		},
		syncRelayUrl: merged.syncRelayUrl ?? "ws://localhost:8080",
		syncRelayUrlHistory: Array.isArray(merged.syncRelayUrlHistory)
			? merged.syncRelayUrlHistory.filter(
					(u): u is string => typeof u === "string",
				)
			: [],
		syncRoomId: merged.syncRoomId ?? "obsidian-ai-chat",
		syncUserName: merged.syncUserName ?? "User",
		checkForUpdates: Boolean(merged.checkForUpdates ?? true),
		updateChannel: (merged.updateChannel as "stable" | "dev") ?? "stable",
		lastUpdateCheck: merged.lastUpdateCheck ?? 0,
		autoUpdate: Boolean(merged.autoUpdate ?? false),
		remoteStorage: {
			enabled: Boolean(merged.remoteStorage?.enabled ?? false),
			backend:
				(merged.remoteStorage?.backend as StorageBackendType) ?? "none",
			passphrase: merged.remoteStorage?.passphrase ?? "",
			// Ignore saved opt-in values while automatic sync is unavailable.
			autoSync:
				AUTO_SYNC_ENABLED &&
				Boolean(merged.remoteStorage?.autoSync ?? false),
			syncIntervalMinutes: Number.isFinite(
				merged.remoteStorage?.syncIntervalMinutes,
			)
				? (merged.remoteStorage?.syncIntervalMinutes as number)
				: 30,
			conflictStrategy:
				(merged.remoteStorage?.conflictStrategy as
					| "last-write-wins"
					| "keep-both"
					| "manual") ?? "last-write-wins",
			concurrencyLimit: Number.isFinite(
				merged.remoteStorage?.concurrencyLimit,
			)
				? (merged.remoteStorage?.concurrencyLimit as number)
				: 3,
			syncDirection:
				(merged.remoteStorage?.syncDirection as
					| "both"
					| "upload"
					| "download") ?? "both",
			allowDeletions: Boolean(
				merged.remoteStorage?.allowDeletions ?? false,
			),
			webdav: {
				type: "webdav" as const,
				url: merged.remoteStorage?.webdav?.url ?? "",
				username: merged.remoteStorage?.webdav?.username ?? "",
				password: merged.remoteStorage?.webdav?.password ?? "",
				prefix:
					merged.remoteStorage?.webdav?.prefix ?? "obsidian-ai-sync/",
				enabled: Boolean(
					merged.remoteStorage?.webdav?.enabled ?? false,
				),
			},
			s3: {
				type: "s3" as const,
				endpoint: merged.remoteStorage?.s3?.endpoint ?? "",
				region: merged.remoteStorage?.s3?.region ?? "us-east-1",
				bucket: merged.remoteStorage?.s3?.bucket ?? "",
				prefix: merged.remoteStorage?.s3?.prefix ?? "obsidian-ai-sync/",
				accessKeyId: merged.remoteStorage?.s3?.accessKeyId ?? "",
				secretAccessKey:
					merged.remoteStorage?.s3?.secretAccessKey ?? "",
				enabled: Boolean(merged.remoteStorage?.s3?.enabled ?? false),
			},
			lastSyncTime: merged.remoteStorage?.lastSyncTime ?? 0,
		},
		syncComponents: {
			chatSessions: Boolean(merged.syncComponents?.chatSessions ?? true),
			pluginSettings: Boolean(
				merged.syncComponents?.pluginSettings ?? true,
			),
			apiKeys: Boolean(merged.syncComponents?.apiKeys ?? false),
			memory: Boolean(merged.syncComponents?.memory ?? true),
			memoryAudit: Boolean(merged.syncComponents?.memoryAudit ?? false),
			persona: Boolean(merged.syncComponents?.persona ?? true),
			usageStats: Boolean(merged.syncComponents?.usageStats ?? false),
		},
		recentModels: migrateRecentModelsToProviders(
			typeof merged.recentModels === "object" &&
				merged.recentModels !== null
				? merged.recentModels
				: {},
			providerProfiles,
		),
		collapsedSections:
			typeof merged.collapsedSections === "object" &&
			merged.collapsedSections !== null
				? merged.collapsedSections
				: {},
	};
};

export const getActiveProviderProfile = (
	settings: ObsidianAISettings,
): ProviderProfile => {
	return (
		settings.providerProfiles.find(
			(profile) => profile.id === settings.activeProviderProfileId,
		) ?? settings.providerProfiles[0]
	);
};

const createProfileFromLegacySettings = (
	settings: LegacySettings | null | undefined,
): ProviderProfile => {
	const provider =
		settings?.provider === "ollama"
			? "custom"
			: (settings?.provider ?? "openai");
	return createProviderProfile({
		id: DEFAULT_PROFILE_ID,
		name: getDefaultProfileName(provider),
		provider,
		model: settings?.model ?? getDefaultModel(provider),
		apiKey: settings?.apiKey ?? "",
		customURL: settings?.customURL ?? "",
		azureEndpoint: settings?.azureEndpoint ?? "",
		azureApiVersion: settings?.azureApiVersion ?? "2024-02-15-preview",
	});
};

const normalizeProviderProfile = (
	profile: ProviderProfile,
): ProviderProfile => {
	const provider =
		profile.provider === "ollama"
			? "custom"
			: (profile.provider ?? "openai");
	return createProviderProfile({
		...profile,
		provider,
		name: profile.name || getDefaultProfileName(provider),
		model: profile.model || getDefaultModel(provider),
	});
};

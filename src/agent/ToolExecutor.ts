import { App } from "obsidian";
import type { ToolCall, ToolResult } from "./types";
import type { ObsidianAISettings } from "../settings";
import type { PersonaLoader } from "../intelligence/PersonaLoader";
import { SearchIndex } from "../search/index";
import type { ProviderRegistry } from "../integrations/ProviderRegistry";
import {
	createBuiltInToolDefinitionsWithExecutors,
	resolveToolRegistry,
	validateToolArguments,
} from "./toolRegistry";
import type { ResolvedToolRegistry, ToolDefinition } from "./toolRegistry";
import { ContinuationStore } from "./pagination";
import { ToolResolver } from "./tools/ToolResolver";
import { NoteHandlers } from "./tools/handlers/noteHandlers";
import { BulkHandlers } from "./tools/handlers/bulkHandlers";
import { DiscoveryHandlers } from "./tools/handlers/discoveryHandlers";
import { MemoryHandlers } from "./tools/handlers/memoryHandlers";
import { SessionHandlers } from "./tools/handlers/sessionHandlers";
import { SettingsHandlers } from "./tools/handlers/settingsHandlers";
import { VaultHandlers } from "./tools/handlers/vaultHandlers";
import { WebHandlers } from "./tools/handlers/webHandlers";
import {
	DataviewHandlers,
	hasDataviewQueryApi,
} from "./tools/handlers/DataviewHandlers";
import { type ToolHandlerContext } from "./tools/ToolHandlerContext";
import {
	mutationTargets,
	TargetLockManager,
	ToolLockCancelledError,
} from "./targetLocks";

const sharedTargetLocks = new TargetLockManager();

export class ToolExecutor {
	private builtInRegistry: ResolvedToolRegistry;
	private readonly logger?: { log: (level: string, ...args: any[]) => void };
	private readonly continuations = new ContinuationStore();
	private readonly resolver: ToolResolver;
	private readonly noteHandlers: NoteHandlers;
	private readonly bulkHandlers: BulkHandlers;
	private readonly discoveryHandlers: DiscoveryHandlers;
	private readonly memoryHandlers: MemoryHandlers;
	private readonly sessionHandlers: SessionHandlers;
	private readonly settingsHandlers: SettingsHandlers;
	private readonly vaultHandlers: VaultHandlers;
	private readonly webHandlers: WebHandlers;
	private readonly dataviewHandlers: DataviewHandlers;
	private readonly targetLocks: TargetLockManager;

	constructor(
		app: App,
		private settings?: ObsidianAISettings,
		personaLoader?: PersonaLoader,
		searchIndex?: SearchIndex,
		getActiveSessionId?: () => string | null,
		private integrationRegistry?: ProviderRegistry,
		saveSettings?: () => Promise<void>,
		pluginId?: string,
		targetLocks: TargetLockManager = sharedTargetLocks,
		getSessions?: () =>
			| ReadonlyArray<{
					id: string;
					messages: import("../types").ChatMessage[];
			  }>
			| undefined,
		logger?: { log: (level: string, ...args: any[]) => void },
	) {
		this.logger = logger;
		this.targetLocks = targetLocks;
		this.resolver = new ToolResolver(app);
		const context: ToolHandlerContext = {
			app,
			pluginId,
			resolver: this.resolver,
			settings,
			personaLoader,
			searchIndex,
			getActiveSessionId,
			getSessions,
			integrationRegistry,
			saveSettings,
			continuations: this.continuations,
		};
		this.noteHandlers = new NoteHandlers(context);
		this.bulkHandlers = new BulkHandlers(context);
		this.discoveryHandlers = new DiscoveryHandlers(context);
		this.memoryHandlers = new MemoryHandlers(context);
		this.sessionHandlers = new SessionHandlers(context);
		this.settingsHandlers = new SettingsHandlers(context);
		this.vaultHandlers = new VaultHandlers(context);
		this.webHandlers = new WebHandlers(context);
		this.dataviewHandlers = new DataviewHandlers(context);
		// Build the same descriptor registry used to expose tools to the model.
		// Built-in and provider execution both pass through this map.
		const builtInDefinitions = createBuiltInToolDefinitionsWithExecutors({
			read_note: (call) =>
				this.noteHandlers.readNote(call.args as { path: string }),
			edit_note: (call) =>
				this.noteHandlers.editNote(
					call.args as {
						path: string;
						content: string;
						expected_content_fingerprint?: string;
					},
				),
			append_to_note: (call) =>
				this.noteHandlers.appendToNote(
					call.args as {
						path: string;
						content: string;
						expected_content_fingerprint?: string;
					},
				),
			create_note: (call) =>
				this.noteHandlers.createNote(
					call.args as { path: string; content: string },
				),
			create_notes: (call) =>
				this.bulkHandlers.createNotes(
					call.args as {
						notes: Array<{ path: string; content: string }>;
					},
				),
			patch_note: (call) =>
				this.noteHandlers.patchNote(
					call.args as {
						path: string;
						search: string;
						replace: string;
						replace_all?: boolean;
						expected_content_fingerprint?: string;
					},
				),
			edit_section: (call) =>
				this.noteHandlers.editSection(
					call.args as {
						path: string;
						section_heading: string;
						new_content: string;
						expected_content_fingerprint?: string;
					},
				),
			search_notes: (call) =>
				this.discoveryHandlers.searchNotes(
					call.args as {
						query: string;
						sort_by?: string;
						limit?: number;
						folder?: string;
						cursor?: string;
					},
				),
			search_note_content: (call) =>
				this.discoveryHandlers.searchNoteContent(
					call.args as {
						query: string;
						folder?: string;
						sort_by?: string;
						limit?: number;
						context_lines?: number;
						match_mode?: string;
						include_filename?: boolean;
						include_snippets?: boolean;
						cursor?: string;
					},
				),
			list_notes: (call) =>
				this.discoveryHandlers.listNotes(
					call.args as {
						folder?: string;
						sort_by?: string;
						limit?: number;
						include_subfolders?: boolean;
						depth?: number;
						cursor?: string;
					},
				),
			count_notes: (call) =>
				this.discoveryHandlers.countNotes(
					call.args as { folder?: string },
				),
			get_note_metadata: (call) =>
				this.discoveryHandlers.getNoteMetadata(
					call.args as { path: string },
				),
			list_folders: (call) =>
				this.vaultHandlers.listFolders(call.args as { path?: string }),
			check_paths: (call) =>
				this.discoveryHandlers.checkPaths(
					call.args as { paths: string[] },
				),
			search_web: (call) =>
				this.webHandlers.searchWeb(
					call.args as {
						query: string;
						limit?: number;
						cursor?: string;
					},
				),
			read_pdf: (call) =>
				this.webHandlers.readPdf(
					call.args as {
						source: string;
						max_pages?: number;
						start_page?: number;
					},
				),
			create_memory: (call) =>
				this.memoryHandlers.createMemory(
					call.args as {
						category: string;
						content: string;
						tags?: string[];
					},
				),
			update_memory: (call) =>
				this.memoryHandlers.updateMemory(
					call.args as {
						id: string;
						category?: string;
						content?: string;
						tags?: string[];
					},
				),
			delete_memory: (call) =>
				this.memoryHandlers.deleteMemory(call.args as { id: string }),
			list_memories: (call) =>
				this.memoryHandlers.listMemories(
					call.args as {
						category?: string;
						tag?: string;
						limit?: number;
						cursor?: string;
					},
				),
			search_memories: (call) =>
				this.memoryHandlers.searchMemories(
					call.args as {
						query: string;
						limit?: number;
						cursor?: string;
					},
				),
			read_memory_audit: (call) =>
				this.memoryHandlers.readMemoryAudit(
					call.args as { limit?: number; cursor?: string },
				),
			evaluate_staged: () => this.memoryHandlers.evaluateStaged(),
			cull_core: () => this.memoryHandlers.cullCore(),
			search_past_sessions: (call) =>
				this.sessionHandlers.searchPastSessions(
					call.args as {
						query: string;
						limit?: number;
						cursor?: string;
					},
				),
			read_tool_result: (call) =>
				this.sessionHandlers.readToolResult(
					call.args as {
						session_id: string;
						tool_call_id: string;
						offset?: number;
						limit?: number;
						query?: string;
					},
				),
			query_dataview: (call) =>
				this.dataviewHandlers.queryDataview(
					call.args as {
						query: string;
						max_output_chars?: number;
					},
				),
			create_folder: (call) =>
				this.vaultHandlers.createFolder(call.args as { path: string }),
			move_note: (call) =>
				this.vaultHandlers.moveNote(
					call.args as { path: string; new_path: string },
				),
			delete_note: (call) =>
				this.vaultHandlers.deleteNote(call.args as { path: string }),
			read_settings: (call) => this.settingsHandlers.readSettings(),
			update_setting: (call) =>
				this.settingsHandlers.updateSetting(
					call.args as { key: string; value: unknown },
				),
			get_plugin_info: (call) => this.settingsHandlers.getPluginInfo(),
		});
		const providerDefinitions: ToolDefinition[] =
			this.integrationRegistry?.getToolDefinitions() ?? [];
		this.builtInRegistry = resolveToolRegistry(
			[...builtInDefinitions, ...providerDefinitions],
			{
				enableMemoryAuditTool:
					this.settings?.intelligence?.enableMemoryAuditTool,
				developerMode: this.settings?.developerMode,
				dataviewAvailable: hasDataviewQueryApi(app),
			},
		);
	}

	getModelTools(): Record<string, Record<string, unknown>> {
		return this.builtInRegistry.tools;
	}

	/**
	 * Return the exact definitions used by this executor.
	 * Callers should use this result for both model exposure and execution.
	 */
	getResolvedToolRegistry(): ResolvedToolRegistry {
		return this.builtInRegistry;
	}

	async execute(call: ToolCall, signal?: AbortSignal): Promise<ToolResult> {
		const startedAt = Date.now();
		try {
			const registryDef = this.builtInRegistry.byId.get(call.toolName);
			if (!registryDef?.execute) {
				return {
					error: `Unknown or unavailable tool: ${call.toolName}`,
				};
			}
			if (signal?.aborted) {
				return { error: "Tool call cancelled before execution." };
			}

			const validation = await validateToolArguments(
				registryDef,
				call.args,
			);
			if (!validation.ok) {
				return {
					error: `Invalid arguments for ${call.toolName}: ${validation.error}`,
				};
			}
			if (signal?.aborted) {
				return { error: "Tool call cancelled before execution." };
			}

			this.logger?.log("info", `[Tool] ${call.toolName} starting`);
			const validatedCall = { ...call, args: validation.args };
			const execute = () =>
				registryDef.execute!(validatedCall, {
					enableMemoryAuditTool:
						this.settings?.intelligence?.enableMemoryAuditTool,
				});
			const result =
				registryDef.risk === "read" ||
				registryDef.risk === "remote-read"
					? await execute()
					: await this.targetLocks.runExclusive(
							mutationTargets(call.toolName, validation.args),
							execute,
							signal,
						);
			const elapsed = Date.now() - startedAt;
			if (result.error) {
				this.logger?.log(
					"info",
					`[Tool] ${call.toolName} failed in ${elapsed}ms — ${String(result.error).slice(0, 200)}`,
				);
			} else {
				const size = result.content ? String(result.content).length : 0;
				this.logger?.log(
					"info",
					`[Tool] ${call.toolName} done in ${elapsed}ms — ${size} chars`,
				);
			}
			return result;
		} catch (e: any) {
			if (e instanceof ToolLockCancelledError) {
				this.logger?.log(
					"info",
					`[Tool] ${call.toolName} cancelled — ${e.message}`,
				);
				return { error: e.message };
			}
			this.logger?.log(
				"error",
				`[Tool] ${call.toolName} threw after ${Date.now() - startedAt}ms — ${e.message || String(e)}`,
			);
			return { error: e.message || String(e) };
		}
	}
}

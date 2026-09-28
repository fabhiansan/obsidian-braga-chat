import type { App } from "obsidian";
import type {
	StoredChatData,
	ChatSession,
	ChatMessage,
	ContextItem,
	CompactionMetadata,
	Attachment,
} from "../types";
import type { ObsidianAISettings } from "../settings";

export interface StorageDeps {
	app: App;
	manifest: { id: string };
	settings: ObsidianAISettings;
	loadData(): Promise<any>;
	saveData(data: any): Promise<void>;
	logger?: { log(level: string, msg: string): void };
}

export interface LoadChatDataOptions {
	/** Read every session's message file up front. Default false: boot from
		the index only and hydrate message files on first open. Used by sync,
		diagnostics, and usage stats — anything that needs full transcripts. */
	hydrate?: boolean;
}

export interface ChatStorage {
	loadChatData(opts?: LoadChatDataOptions): Promise<StoredChatData>;
	saveChatData(data: StoredChatData): Promise<void>;
	detectLegacyFormat(): Promise<boolean>;
	/** Read one session's message file into memory. Returns the messages. */
	hydrateSession?(sessionId: string): Promise<ChatMessage[]>;
	peekSessionMessages?(sessionId: string): Promise<ChatMessage[]>;
	/** False while a session's messages exist on disk but haven't been read. */
	isSessionHydrated?(sessionId: string): boolean;
}

export function createStorage(
	deps: StorageDeps,
	format: "legacy" | "jsonl",
): ChatStorage {
	if (format === "jsonl") {
		return new JsonlStorage(deps);
	}
	return new LegacyStorage(deps);
}

// ─────────────────────────────────────────────────────────────
// Legacy Storage — everything in data.json (current behavior)
// ─────────────────────────────────────────────────────────────

class LegacyStorage implements ChatStorage {
	constructor(private deps: StorageDeps) {}

	async loadChatData(_opts?: LoadChatDataOptions): Promise<StoredChatData> {
		this.deps.logger?.log(
			"info",
			"LegacyStorage: loadChatData reading data.json",
		);
		const data = await this.deps.loadData();

		if (data?.chatData && Array.isArray(data.chatData.sessions)) {
			const chatData = data.chatData as StoredChatData;
			for (const session of chatData.sessions) {
				if (!Array.isArray(session.contextItems)) {
					session.contextItems = [];
				}
			}
			return chatData;
		}

		if (Array.isArray(data?.chatMessages) && data.chatMessages.length > 0) {
			const migrated: StoredChatData = {
				sessions: [
					{
						id: crypto.randomUUID(),
						title: "Previous Chat",
						createdAt: Date.now(),
						updatedAt: Date.now(),
						messages: data.chatMessages,
						contextItems: [],
					},
				],
				activeSessionId: null,
			};
			return migrated;
		}

		return { sessions: [], activeSessionId: null };
	}

	async saveChatData(data: StoredChatData): Promise<void> {
		this.deps.logger?.log(
			"info",
			"LegacyStorage: saveChatData writing data.json",
		);
		const existing = (await this.deps.loadData()) ?? {};
		const payload = { ...existing, chatData: data };
		await this.deps.saveData(payload);
		this.deps.logger?.log(
			"info",
			"LegacyStorage: data.json written successfully",
		);
	}

	async detectLegacyFormat(): Promise<boolean> {
		const data = await this.deps.loadData();
		return data?.chatData != null || Array.isArray(data?.chatMessages);
	}
}

// ─────────────────────────────────────────────────────────────
// JSONL Storage — split architecture
// ─────────────────────────────────────────────────────────────

interface SessionIndexEntry {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	filePath: string;
	profileId?: string;
	isGroupChat?: boolean;
	participants?: {
		id: string;
		name: string;
		profileId: string;
		color: string;
		icon?: string;
	}[];
	selectedProfileIds?: string[];
	modelOverrides?: Record<string, string>;
	thinkingEnabled?: boolean;
	draft?: string;
	draftAttachmentsFile?: string;
	contextItems?: ContextItem[];
	scrollPosition?: number;
	compactionMetadata?: CompactionMetadata;
}

interface SessionIndex {
	version: number;
	sessions: SessionIndexEntry[];
	activeSessionId: string | null;
	openSessionIds?: string[];
}

const INDEX_VERSION = 1;
const SESSIONS_DIR = "sessions";

class JsonlStorage implements ChatStorage {
	private deps: StorageDeps;
	private lastSavedState: {
		sessions: Map<
			string,
			{ messageIds: string[] | null; updatedAt: number }
		>;
		activeSessionId: string | null;
	} | null = null;
	/** Sessions booted from the index whose message files have NOT been read
		yet, keyed by id with their original index entries. saveChatData must
		never write these (messages in memory are []) — only hydrateSession()
		(or a save carrying real messages, e.g. a sync download) clears them. */
	private unhydratedSessions = new Map<string, SessionIndexEntry>();
	/** Avoid rewriting potentially large inline file data on each text autosave. */
	private savedDraftAttachmentRefs = new Map<string, Attachment[]>();
	/** In-flight hydrateSession calls — concurrent callers share one read. */
	private pendingHydrations = new Map<string, Promise<ChatMessage[]>>();
	/** Sessions known to have their messages in UI memory (hydrated via
		hydrateSession() or saved carrying real messages). Metadata-only index
		reads use this to avoid re-flagging those sessions as unhydrated —
		doing so would make isSessionHydrated() lie and a later "hydration"
		could revert newer in-memory messages to disk state (Codex wave-3 P1). */
	private hydratedSessionIds = new Set<string>();
	/** Last authoritative index entries. Used to preserve message files and
		metadata when a UI snapshot is partial or metadata-only. */
	private indexEntriesById = new Map<string, SessionIndexEntry>();

	constructor(deps: StorageDeps) {
		this.deps = deps;
	}

	async detectLegacyFormat(): Promise<boolean> {
		const data = await this.deps.loadData();
		return data?.chatData != null || Array.isArray(data?.chatMessages);
	}

	async loadChatData(
		opts: LoadChatDataOptions = {},
	): Promise<StoredChatData> {
		const adapter = this.deps.app.vault.adapter;
		const pluginDir = `${this.deps.app.vault.configDir}/plugins/${this.deps.manifest.id}`;
		const indexPath = `${pluginDir}/${SESSIONS_DIR}/index.json`;

		if (!(await adapter.exists(indexPath))) {
			return { sessions: [], activeSessionId: null };
		}

		let index: SessionIndex;
		try {
			const raw = await adapter.read(indexPath);
			index = JSON.parse(raw) as SessionIndex;
		} catch {
			return { sessions: [], activeSessionId: null };
		}
		this.indexEntriesById = new Map(
			index.sessions.map((entry) => [entry.id, entry]),
		);

		const hydrateAll = opts.hydrate === true;
		// A full read (diagnostics, usage stats, sync cache) must never disturb
		// lazy-hydration write protection; only index-only boots rebuild it.
		if (!hydrateAll) this.unhydratedSessions.clear();

		const sessions: ChatSession[] = await Promise.all(
			index.sessions.map(async (entry) => {
				let messages: ChatMessage[] = [];
				// Bulk hydrate must not claim success for a session whose
				// message file is missing or unparseable — consumers (sync
				// cache, diagnostics) treat hydrated as "content verified".
				// Mirror the lazy hydrateSession() honesty guard.
				let hydrateFailed = false;
				if (hydrateAll) {
					messages = await this._loadMessages(
						`${pluginDir}/${entry.filePath}`,
					);
					if (messages.length === 0 && entry.messageCount > 0) {
						hydrateFailed = true;
						// Keep it retryable via hydrateSession() and under the
						// save-guard so an autosave can't clobber the index.
						this.unhydratedSessions.set(entry.id, entry);
						this.deps.logger?.log(
							"error",
							`JsonlStorage: bulk hydrate found 0 messages for ${entry.id} (index expects ${entry.messageCount}) — leaving unhydrated for retry`,
						);
					} else if (
						messages.length > 0 &&
						messages.length < entry.messageCount
					) {
						this.deps.logger?.log(
							"warn",
							`JsonlStorage: bulk hydrate read ${messages.length}/${entry.messageCount} messages for ${entry.id}`,
						);
					}
				} else {
					// Index-only boot: metadata now, messages on first open.
					// Sessions already known-hydrated (mid-session sync re-read)
					// stay OUT of the guard — the UI already holds their messages.
					if (!this.hydratedSessionIds.has(entry.id)) {
						this.unhydratedSessions.set(entry.id, entry);
					}
				}
				let draftAttachments: ChatSession["draftAttachments"];
				if (entry.draftAttachmentsFile) {
					try {
						const draftPath = `${pluginDir}/${entry.draftAttachmentsFile}`;
						if (await adapter.exists(draftPath)) {
							const parsed = JSON.parse(
								await adapter.read(draftPath),
							);
							if (Array.isArray(parsed)) {
								draftAttachments = parsed as Attachment[];
								this.savedDraftAttachmentRefs.set(
									entry.id,
									draftAttachments,
								);
							}
						}
					} catch (error) {
						this.deps.logger?.log(
							"warn",
							`JsonlStorage: could not read attachment draft for ${entry.id}: ${String(error)}`,
						);
					}
				}
				return {
					id: entry.id,
					title: entry.title,
					createdAt: entry.createdAt,
					updatedAt: entry.updatedAt,
					messages,
					messageCount: hydrateAll
						? hydrateFailed
							? entry.messageCount
							: messages.length
						: entry.messageCount,
					hydrated: hydrateAll && !hydrateFailed,
					contextItems: entry.contextItems ?? [],
					profileId: entry.profileId,
					isGroupChat: entry.isGroupChat,
					participants: entry.participants,
					selectedProfileIds: entry.selectedProfileIds,
					modelOverrides: entry.modelOverrides,
					thinkingEnabled: entry.thinkingEnabled,
					draft: entry.draft,
					draftAttachments,
					scrollPosition: entry.scrollPosition,
					compactionMetadata: entry.compactionMetadata,
				};
			}),
		);

		const totalBytes = sessions.reduce(
			(sum, s) =>
				sum +
				s.messages.reduce(
					(m, msg) => m + (msg.content?.length ?? 0),
					0,
				),
			0,
		);
		this.deps.logger?.log(
			"info",
			`JsonlStorage: loaded ${sessions.length} session file(s), ` +
				`${sessions.reduce((n, s) => n + s.messages.length, 0)} message(s), ` +
				`~${Math.round(totalBytes / 1024)}KB of message text` +
				(hydrateAll ? "" : " (index-only boot)"),
		);

		this.lastSavedState = {
			sessions: new Map(
				sessions.map((s) => [
					s.id,
					{
						// null = on-disk ids unknown (index-only boot); forces a full
						// overwrite on the first write instead of a bad append.
						messageIds: hydrateAll
							? this.unhydratedSessions.has(s.id)
								? (this.lastSavedState?.sessions.get(s.id)
										?.messageIds ?? null)
								: s.messages.map((m) => m.id)
							: null,
						updatedAt: s.updatedAt,
					},
				]),
			),
			activeSessionId: index.activeSessionId,
		};

		return {
			sessions,
			activeSessionId: index.activeSessionId,
			openSessionIds: index.openSessionIds,
		};
	}

	/** Read one session's message file into memory. Idempotent; returns [] for
		already-hydrated or unknown ids so callers can fire it unconditionally. */
	async hydrateSession(sessionId: string): Promise<ChatMessage[]> {
		const pending = this.pendingHydrations.get(sessionId);
		if (pending) return pending;
		const p = this._hydrateSessionImpl(sessionId).finally(() =>
			this.pendingHydrations.delete(sessionId),
		);
		this.pendingHydrations.set(sessionId, p);
		return p;
	}

	private async _hydrateSessionImpl(
		sessionId: string,
	): Promise<ChatMessage[]> {
		const entry = this.unhydratedSessions.get(sessionId);
		if (!entry) {
			this.deps.logger?.log(
				"debug",
				`ChatStorage: hydrate skipped for ${sessionId} (no pending index entry)`,
			);
			return [];
		}
		const adapter = this.deps.app.vault.adapter;
		const pluginDir = `${this.deps.app.vault.configDir}/plugins/${this.deps.manifest.id}`;
		const path = `${pluginDir}/${entry.filePath}`;
		this.deps.logger?.log(
			"debug",
			`ChatStorage: hydrate started for ${sessionId} (${entry.filePath}, expected ${entry.messageCount})`,
		);
		let messages: ChatMessage[];
		try {
			messages = await this._loadMessages(path);
		} catch (err) {
			// Read failure (e.g. mobile bridge): leave the session unhydrated so
			// the next open retries, and surface it in the log instead of
			// silently returning [] and never trying again.
			this.deps.logger?.log(
				"error",
				`ChatStorage: hydrate read failed for ${sessionId} (${path}): ${String(err)}`,
			);
			return [];
		}
		if (messages.length === 0 && entry.messageCount > 0) {
			// Missing or fully unparseable .jsonl for a session the index says
			// has messages. Do NOT mark hydrated — that would permanently show
			// an empty session with no way to retry.
			this.deps.logger?.log(
				"error",
				`ChatStorage: hydrate found 0 messages for ${sessionId} (index expects ${entry.messageCount}, ${path}) — leaving unhydrated for retry`,
			);
			return [];
		}
		if (messages.length < entry.messageCount) {
			this.deps.logger?.log(
				"warn",
				`ChatStorage: hydrate read ${messages.length}/${entry.messageCount} messages for ${sessionId} (${path})`,
			);
		}
		this.unhydratedSessions.delete(sessionId);
		this.hydratedSessionIds.add(sessionId);
		// Record the true on-disk ids so the next save can append correctly.
		this.lastSavedState?.sessions.set(sessionId, {
			messageIds: messages.map((m) => m.id),
			updatedAt: entry.updatedAt,
		});
		this.deps.logger?.log(
			"info",
			`ChatStorage: hydrated ${sessionId} (${messages.length}/${entry.messageCount} messages, ${entry.filePath})`,
		);
		return messages;
	}

	isSessionHydrated(sessionId: string): boolean {
		return !this.unhydratedSessions.has(sessionId);
	}

	/** Pure read of one session's messages for consumers that must not
		disturb lazy-hydration state (history copy/export, search): touches
		neither the unhydratedSessions guard nor lastSavedState. */
	async peekSessionMessages(sessionId: string): Promise<ChatMessage[]> {
		const entry = this.unhydratedSessions.get(sessionId);
		const adapter = this.deps.app.vault.adapter;
		const pluginDir = `${this.deps.app.vault.configDir}/plugins/${this.deps.manifest.id}`;
		const filePath =
			entry?.filePath ?? `${SESSIONS_DIR}/${sessionId}.jsonl`;
		const messages = await this._loadMessages(`${pluginDir}/${filePath}`);
		this.deps.logger?.log(
			messages.length > 0 ? "debug" : "warn",
			`ChatStorage: peek ${sessionId} read ${messages.length} message(s) from ${filePath}`,
		);
		return messages;
	}

	async saveChatData(data: StoredChatData): Promise<void> {
		const adapter = this.deps.app.vault.adapter;
		const pluginDir = `${this.deps.app.vault.configDir}/plugins/${this.deps.manifest.id}`;
		const sessionsDir = `${pluginDir}/${SESSIONS_DIR}`;

		if (!(await adapter.exists(sessionsDir))) {
			await adapter.mkdir(sessionsDir);
		}

		const indexEntries: SessionIndexEntry[] = [];
		const incomingIds = new Set(data.sessions.map((session) => session.id));
		const deletedIds = new Set(data.deletedSessionIds ?? []);

		for (const session of data.sessions) {
			const filePath = `${SESSIONS_DIR}/${session.id}.jsonl`;
			const fullPath = `${pluginDir}/${filePath}`;
			const draftAttachmentsFile = session.draftAttachments?.length
				? `${SESSIONS_DIR}/${session.id}.draft.json`
				: undefined;
			const oldDraftFile = this.indexEntriesById.get(
				session.id,
			)?.draftAttachmentsFile;
			if (draftAttachmentsFile) {
				if (
					this.savedDraftAttachmentRefs.get(session.id) !==
					session.draftAttachments
				) {
					await adapter.write(
						`${pluginDir}/${draftAttachmentsFile}`,
						JSON.stringify(session.draftAttachments),
					);
					this.savedDraftAttachmentRefs.set(
						session.id,
						session.draftAttachments!,
					);
				}
			} else {
				if (
					oldDraftFile &&
					adapter.remove &&
					(await adapter.exists(`${pluginDir}/${oldDraftFile}`))
				) {
					await adapter.remove(`${pluginDir}/${oldDraftFile}`);
				}
				this.savedDraftAttachmentRefs.delete(session.id);
			}

			const originalEntry =
				this.unhydratedSessions.get(session.id) ??
				this.indexEntriesById.get(session.id);
			const expectedMessageCount =
				session.messageCount ?? originalEntry?.messageCount ?? 0;
			if (session.messages.length === 0 && expectedMessageCount > 0) {
				// Hard guard: this session's messages were never read into memory
				// or a metadata-only refresh replaced a previously hydrated copy.
				// Writing [] would destroy the on-disk file. Preserve the index
				// entry regardless of the transient hydration bookkeeping state.
				const preservedEntry: SessionIndexEntry = originalEntry ?? {
					id: session.id,
					title: session.title,
					createdAt: session.createdAt,
					updatedAt: session.updatedAt,
					messageCount: expectedMessageCount,
					filePath,
				};
				indexEntries.push({
					...preservedEntry,
					title: session.title,
					draft: session.draft,
					draftAttachmentsFile,
					scrollPosition: session.scrollPosition,
				});
				this.deps.logger?.log(
					"warn",
					`JsonlStorage: refused empty overwrite for ${session.id} (index expects ${expectedMessageCount})`,
				);
				continue;
			}

			const previous = this.lastSavedState?.sessions.get(session.id);
			const previousMessageIds = previous?.messageIds ?? null;

			await this._writeMessages(
				fullPath,
				session.messages,
				previousMessageIds,
			);
			// Real messages are now on disk (either they were already, or this
			// write put them there) — the session is hydrated from here on.
			this.unhydratedSessions.delete(session.id);
			this.hydratedSessionIds.add(session.id);

			indexEntries.push({
				id: session.id,
				title: session.title,
				createdAt: session.createdAt,
				updatedAt: session.updatedAt,
				messageCount: session.messages.length,
				filePath,
				profileId: session.profileId,
				isGroupChat: session.isGroupChat,
				participants: session.participants,
				selectedProfileIds: session.selectedProfileIds,
				modelOverrides: session.modelOverrides,
				thinkingEnabled: session.thinkingEnabled,
				draft: session.draft,
				draftAttachmentsFile,
				scrollPosition: session.scrollPosition,
				contextItems: session.contextItems,
				compactionMetadata: session.compactionMetadata,
			});
		}

		// A mounted chat view can hold a stale or intentionally bounded subset of
		// sessions. Absence from that snapshot is not deletion. Carry forward all
		// existing index entries unless the caller explicitly marks the ID deleted.
		for (const [id, entry] of this.indexEntriesById) {
			if (deletedIds.has(id)) {
				if (
					entry.draftAttachmentsFile &&
					adapter.remove &&
					(await adapter.exists(
						`${pluginDir}/${entry.draftAttachmentsFile}`,
					))
				) {
					await adapter.remove(
						`${pluginDir}/${entry.draftAttachmentsFile}`,
					);
				}
				this.savedDraftAttachmentRefs.delete(id);
				continue;
			}
			if (!incomingIds.has(id) && !deletedIds.has(id)) {
				// Draft-only sessions are included in the input while they contain
				// composer data. Drop their index entry and attachment payload after
				// the draft is cleared; empty message sessions are not history.
				if (entry.messageCount === 0) {
					if (
						entry.draftAttachmentsFile &&
						adapter.remove &&
						(await adapter.exists(
							`${pluginDir}/${entry.draftAttachmentsFile}`,
						))
					) {
						await adapter.remove(
							`${pluginDir}/${entry.draftAttachmentsFile}`,
						);
					}
					this.savedDraftAttachmentRefs.delete(id);
					continue;
				}
				indexEntries.push(entry);
				this.deps.logger?.log(
					"warn",
					`JsonlStorage: preserved omitted session ${id} from partial snapshot`,
				);
			}
		}

		const index: SessionIndex = {
			version: INDEX_VERSION,
			sessions: indexEntries,
			activeSessionId: data.activeSessionId,
			openSessionIds: data.openSessionIds,
		};

		await adapter.write(
			`${sessionsDir}/index.json`,
			JSON.stringify(index, null, 2),
		);
		this.indexEntriesById = new Map(
			indexEntries.map((entry) => [entry.id, entry]),
		);

		this.lastSavedState = {
			sessions: new Map(
				data.sessions.map((s) => [
					s.id,
					{
						messageIds: this.unhydratedSessions.has(s.id)
							? null
							: s.messages.map((m) => m.id),
						updatedAt: s.updatedAt,
					},
				]),
			),
			activeSessionId: data.activeSessionId,
		};
	}

	private async _loadMessages(path: string): Promise<ChatMessage[]> {
		const adapter = this.deps.app.vault.adapter;
		if (!(await adapter.exists(path))) {
			return [];
		}
		const raw = await adapter.read(path);
		if (!raw.trim()) return [];
		const lines = raw.split("\n").filter((l) => l.trim());
		const messages: ChatMessage[] = [];
		for (const line of lines) {
			try {
				const parsed = JSON.parse(line);
				// Basic schema validation
				if (
					parsed &&
					typeof parsed === "object" &&
					typeof parsed.id === "string" &&
					typeof parsed.role === "string" &&
					["user", "assistant", "system"].includes(parsed.role)
				) {
					messages.push(parsed as ChatMessage);
				} else {
					this.deps.logger?.log(
						"warn",
						`ChatStorage: skipping malformed message line in ${path}`,
					);
				}
			} catch {
				this.deps.logger?.log(
					"warn",
					`ChatStorage: failed to parse message line in ${path}`,
				);
			}
		}
		return messages;
	}

	private async _writeMessages(
		path: string,
		messages: ChatMessage[],
		previousMessageIds: string[] | null,
	): Promise<void> {
		const adapter = this.deps.app.vault.adapter;

		const canAppend =
			previousMessageIds !== null &&
			messages.length >= previousMessageIds.length &&
			messages
				.slice(0, previousMessageIds.length)
				.every((m, i) => m.id === previousMessageIds[i]);

		if (canAppend) {
			const newMessages = messages.slice(previousMessageIds.length);
			if (newMessages.length > 0) {
				const lines =
					newMessages.map((m) => JSON.stringify(m)).join("\n") + "\n";
				await adapter.append(path, lines);
			}
		} else {
			const content = messages.map((m) => JSON.stringify(m)).join("\n");
			await adapter.write(path, content ? content + "\n" : "");
		}
	}
}

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatSession, ChatMessage, ContextItem } from "../types";
import type { ChatPluginLike } from "../views/ObsidianAIChatView";
import type { ProviderProfile } from "../settings";
import type { ChatApiManager } from "../api";
import { getActiveProviderProfile } from "../settings";
import { makeId, sessionMessageCount } from "../lib/sessionUtils";
import {
	generateSessionTitle,
	generateSessionTitleLLM,
} from "../lib/sessionTitle";

interface UseChatSessionOptions {
	plugin: ChatPluginLike;
	profileId?: string;
}

function hasDraftState(session: ChatSession): boolean {
	return Boolean(session.draft?.trim() || session.draftAttachments?.length);
}

function shouldPersistSession(session: ChatSession): boolean {
	return sessionMessageCount(session) > 0 || hasDraftState(session);
}

export interface UseChatSessionResult {
	sessions: ChatSession[];
	setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
	activeSessionId: string | null;
	setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
	chatDataLoaded: boolean;
	sessionsRef: React.MutableRefObject<ChatSession[]>;
	activeSessionIdRef: React.MutableRefObject<string | null>;
	openSessionIds: string[];
	setOpenSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
	/** Create and activate a new session for chat and composer drafts. */
	createNewSession: (opts?: {
		includeActiveNote?: boolean;
		selectedProfileIds?: string[];
		modelOverrides?: Record<string, string>;
		autoNameSessions?: boolean;
		force?: boolean;
	}) => ChatSession;
	/** Delete a session. If active, switches to the most recent remaining. */
	deleteSession: (sessionId: string) => void;
	/** Rename a session. */
	renameSession: (sessionId: string, title: string) => void;
	/** Update a session's messages. */
	updateSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
	/** Update a session's context items. */
	updateSessionContextItems: (
		sessionId: string,
		contextItems: ContextItem[],
	) => void;
	/** Manually rename the active session via LLM + heuristic fallback. */
	manualRenameActiveSession: (
		resolvedProfile: ProviderProfile,
		chatapi: ChatApiManager,
	) => Promise<string | null>;
	autoNameSessions: boolean;
	setAutoNameSessions: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useChatSession({
	plugin,
	profileId,
}: UseChatSessionOptions): UseChatSessionResult {
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [chatDataLoaded, setChatDataLoaded] = useState(false);
	const [openSessionIds, setOpenSessionIds] = useState<string[]>([]);

	const sessionsRef = useRef<ChatSession[]>([]);
	const activeSessionIdRef = useRef<string | null>(null);
	const llmNamedRef = useRef<Set<string>>(new Set());
	const saveTimerRef = useRef<number | null>(null);
	const skipNextAutosaveRef = useRef(false);
	const deletedSessionIdsRef = useRef<Set<string>>(new Set());

	sessionsRef.current = sessions;
	activeSessionIdRef.current = activeSessionId;

	// Remote deletion tombstones can remove a session while the chat view is
	// mounted. Keep the in-memory picker/tabs aligned with persisted storage.
	useEffect(() => {
		const handleRemoteDeletion = (event: Event) => {
			const sessionId = (event as CustomEvent<{ sessionId?: string }>)
				.detail?.sessionId;
			if (!sessionId) return;
			setSessions((current) => current.filter((s) => s.id !== sessionId));
			setOpenSessionIds((current) =>
				current.filter((id) => id !== sessionId),
			);
			if (activeSessionIdRef.current === sessionId) {
				const next = sessionsRef.current
					.filter((session) => session.id !== sessionId)
					.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
				setActiveSessionId(next?.id ?? null);
			}
		};
		window.addEventListener(
			"obsidian-ai:session-deleted",
			handleRemoteDeletion,
		);
		return () =>
			window.removeEventListener(
				"obsidian-ai:session-deleted",
				handleRemoteDeletion,
			);
	}, []);

	// A completed remote download updates storage outside React's normal edit
	// path. Reload the lightweight session index so history and counts reflect
	// the downloaded sessions without requiring a view restart.
	useEffect(() => {
		let cancelled = false;
		const handleSessionsUpdated = () => {
			void plugin
				.loadChatData()
				.then((data) => {
					if (cancelled) return;
					const savedSessions =
						data.sessions.filter(shouldPersistSession);
					const currentActiveId = activeSessionIdRef.current;
					const nextActiveId = savedSessions.some(
						(session) => session.id === currentActiveId,
					)
						? currentActiveId
						: (savedSessions[0]?.id ?? null);
					// The sync refresh is metadata-only. Preserve messages already
					// present in React so the active chat and open tabs do not go
					// blank while the index is being refreshed.
					const currentById = new Map(
						sessionsRef.current.map((session) => [
							session.id,
							session,
						]),
					);
					const refreshedSessions = savedSessions.map((session) => {
						const current = currentById.get(session.id);
						return current && current.messages.length > 0
							? {
									...session,
									messages: current.messages,
									messageCount: current.messages.length,
									hydrated: true,
								}
							: session;
					});
					setSessions(refreshedSessions);
					setActiveSessionId(nextActiveId);
					setOpenSessionIds((current) => {
						const knownIds = new Set(
							savedSessions.map((s) => s.id),
						);
						const retained = current.filter((id) =>
							knownIds.has(id),
						);
						return retained.length > 0
							? retained
							: nextActiveId
								? [nextActiveId]
								: [];
					});
				})
				.catch((err: any) => {
					plugin.logger?.log(
						"warn",
						`[Sync] failed to refresh sessions after download: ${err?.message ?? err}`,
					);
				});
		};
		window.addEventListener(
			"obsidian-ai:sessions-updated",
			handleSessionsUpdated,
		);
		return () => {
			cancelled = true;
			window.removeEventListener(
				"obsidian-ai:sessions-updated",
				handleSessionsUpdated,
			);
		};
	}, [plugin]);

	// ─── Load persisted sessions on mount ───
	useEffect(() => {
		let cancelled = false;
		const loadStart = Date.now();
		plugin.logger?.log(
			"info",
			"[Startup] ChatApp mount — loading chat data…",
		);
		plugin.loadChatData().then((data) => {
			if (cancelled) return;
			plugin.logger?.log(
				"info",
				`[Startup] loadChatData resolved in ${Date.now() - loadStart}ms`,
			);
			const savedSessions = data.sessions.filter(
				// messageCount comes from the index, so this stays correct even
				// when messages haven't been hydrated yet (index-only boot). Draft
				// sessions are restored when they contain composer content.
				shouldPersistSession,
			);
			if (savedSessions.length > 0) {
				// Preserve the loaded storage untouched unless this also removes legacy
				// zero-message entries; those should be cleaned up on the next autosave.
				skipNextAutosaveRef.current =
					savedSessions.length === data.sessions.length;
				const totalMessages = savedSessions.reduce(
					(sum, s) => sum + sessionMessageCount(s),
					0,
				);
				plugin.logger?.log(
					"info",
					`[Chat] restored ${savedSessions.length} session(s), ${totalMessages} message(s)`,
				);
				setSessions(savedSessions);
				const restoredActiveId = savedSessions.some(
					(session) => session.id === data.activeSessionId,
				)
					? data.activeSessionId
					: savedSessions[0].id;
				setActiveSessionId(restoredActiveId);
				const knownIds = new Set(
					savedSessions.map((session) => session.id),
				);
				const restoredOpenIds = plugin.settings.restoreChatTabs
					? (data.openSessionIds ?? []).filter((id) =>
							knownIds.has(id),
						)
					: [];
				setOpenSessionIds(
					restoredOpenIds.length > 0
						? restoredOpenIds
						: restoredActiveId
							? [restoredActiveId]
							: [],
				);
				// Index-only boot: message files load in the background for the
				// sessions visible right now (active + open tabs); every other
				// session hydrates on first open via the open/send gates.
				for (const id of new Set(
					[restoredActiveId, ...restoredOpenIds].filter(
						(id): id is string => typeof id === "string",
					),
				)) {
					plugin.logger?.log(
						"debug",
						`[Startup] scheduling hydration for ${id}`,
					);
					plugin
						.hydrateSession?.(id)
						.then((messages) => {
							if (cancelled) return;
							if (messages.length === 0) {
								plugin.logger?.log(
									"warn",
									`[Startup] hydration for ${id} resolved with 0 messages`,
								);
								return;
							}
							plugin.logger?.log(
								"info",
								`[Startup] hydrated ${id} with ${messages.length} messages`,
							);
							// Write through the ref synchronously (see send gate).
							sessionsRef.current = sessionsRef.current.map(
								(s) =>
									s.id === id
										? {
												...s,
												messages,
												messageCount: messages.length,
												hydrated: true,
											}
										: s,
							);
							setSessions(sessionsRef.current);
						})
						.catch((err: any) =>
							plugin.logger?.log(
								"warn",
								`[Startup] hydrate ${id} failed: ${err?.message}`,
							),
						);
				}
			} else {
				// No saved data — create an empty session
				const activeProfile = getActiveProviderProfile(plugin.settings);
				const defaultSelectedIds =
					plugin.settings.selectedProfileIds?.length > 0
						? plugin.settings.selectedProfileIds
						: [activeProfile.id];

				const newSession: ChatSession = {
					id: makeId(),
					title: "",
					createdAt: Date.now(),
					updatedAt: Date.now(),
					messages: [],
					contextItems: plugin.settings.includeActiveNote
						? [{ type: "active-note", id: makeId() }]
						: [],
					profileId: profileId || activeProfile.id,
					selectedProfileIds: defaultSelectedIds,
					remoteUsers: [],
					selectedRemoteUserIds: [],
				};
				setSessions([newSession]);
				setActiveSessionId(newSession.id);
				setOpenSessionIds([newSession.id]);
			}
			setChatDataLoaded(true);
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- session initialization runs once for the plugin instance.
	}, [plugin]);

	// ─── Persist sessions whenever they change (debounced) ───
	useEffect(() => {
		if (!chatDataLoaded) return;
		if (skipNextAutosaveRef.current) {
			skipNextAutosaveRef.current = false;
			return;
		}
		if (sessions.length > 0) {
			if (saveTimerRef.current) {
				window.clearTimeout(saveTimerRef.current);
			}
			saveTimerRef.current = window.setTimeout(() => {
				const deletedSessionIds = [...deletedSessionIdsRef.current];
				const persistedSessions = sessions.filter(
					// messageCount keeps unhydrated sessions in the payload; the
					// storage layer's guard skips writing their (empty) messages.
					shouldPersistSession,
				);
				const persistedActiveSessionId = persistedSessions.some(
					(session) => session.id === activeSessionId,
				)
					? activeSessionId
					: (persistedSessions[0]?.id ?? null);
				void plugin.saveChatData({
					sessions: persistedSessions,
					activeSessionId: persistedActiveSessionId,
					openSessionIds: plugin.settings.restoreChatTabs
						? openSessionIds.filter((id) =>
								persistedSessions.some(
									(session) => session.id === id,
								),
							)
						: [],
					deletedSessionIds,
				});
				saveTimerRef.current = null;
			}, 150);
		}
		return () => {
			if (saveTimerRef.current) {
				window.clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
			}
		};
	}, [sessions, activeSessionId, openSessionIds, plugin, chatDataLoaded]);

	// ─── Auto-title session after it has a few messages ───
	const [autoNameSessions, setAutoNameSessions] = useState(
		plugin.settings.autoNameSessions,
	);
	useEffect(() => {
		if (!autoNameSessions) return;
		const currentActiveId = activeSessionIdRef.current;
		if (!currentActiveId) return;
		if (llmNamedRef.current.has(currentActiveId)) return;
		const session = sessionsRef.current.find(
			(s) => s.id === currentActiveId,
		);
		if (!session || session.title) return;
		const userMsgs = session.messages.filter((m) => m.role === "user");
		const assistantMsgs = session.messages.filter(
			(m) => m.role === "assistant",
		);
		if (userMsgs.length >= 1 && assistantMsgs.length >= 2) {
			llmNamedRef.current.add(currentActiveId);
			// Try LLM naming first, then fall back to heuristic
			void (async () => {
				const activeProfile = getActiveProviderProfile(plugin.settings);
				const title = await generateSessionTitleLLM(
					session.messages.slice(0, 6),
					activeProfile,
					plugin.chatapi,
				);
				if (title) {
					setSessions((prev) =>
						prev.map((s) =>
							s.id === currentActiveId ? { ...s, title } : s,
						),
					);
				} else {
					const fallback = generateSessionTitle(session.messages);
					setSessions((prev) =>
						prev.map((s) =>
							s.id === currentActiveId
								? { ...s, title: fallback }
								: s,
						),
					);
				}
			})();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- autosave dependencies are intentionally limited to session state and settings.
	}, [
		sessions,
		activeSessionId,
		autoNameSessions,
		plugin.settings,
		plugin.chatapi,
	]);

	// ─── Create a new session ───
	const createNewSession = useCallback(
		(opts?: {
			includeActiveNote?: boolean;
			selectedProfileIds?: string[];
			autoNameSessions?: boolean;
			force?: boolean;
			modelOverrides?: Record<string, string>;
		}): ChatSession => {
			const currentActiveId = activeSessionIdRef.current;
			const newSession: ChatSession = {
				id: makeId(),
				title: "",
				createdAt: Date.now(),
				updatedAt: Date.now(),
				messages: [],
				contextItems:
					(opts?.includeActiveNote ??
					plugin.settings.includeActiveNote)
						? [{ type: "active-note", id: makeId() }]
						: [],
				profileId:
					profileId ||
					(opts?.selectedProfileIds?.length === 1
						? opts.selectedProfileIds[0]
						: getActiveProviderProfile(plugin.settings).id),
				selectedProfileIds: opts?.selectedProfileIds?.length
					? opts.selectedProfileIds
					: [getActiveProviderProfile(plugin.settings).id],
				modelOverrides: opts?.modelOverrides,
				remoteUsers: [],
				selectedRemoteUserIds: [],
			};

			setSessions((prev) => {
				const updated = prev.map((s) =>
					s.id === currentActiveId
						? {
								...s,
								title:
									(opts?.autoNameSessions ??
									plugin.settings.autoNameSessions)
										? s.title ||
											generateSessionTitle(s.messages)
										: s.title,
								updatedAt: Date.now(),
							}
						: s,
				);

				// Trigger auto-summarization for the ending session (fire-and-forget)
				const endingSession = prev.find(
					(s) => s.id === currentActiveId,
				);
				if (endingSession && plugin.onSessionEnd) {
					void plugin.onSessionEnd(endingSession);
				}

				// Retention limits must never silently delete persisted history.
				// Users can remove sessions explicitly from the history UI.
				return [...updated, newSession];
			});
			setActiveSessionId(newSession.id);
			return newSession;
		},
		[plugin, profileId],
	);

	// ─── Delete a session ───
	const deleteSession = useCallback(
		(sessionId: string) => {
			deletedSessionIdsRef.current.add(sessionId);
			setSessions((prev) => {
				const filtered = prev.filter((s) => s.id !== sessionId);
				// If deleting the active session, activate the most recent remaining
				if (activeSessionIdRef.current === sessionId) {
					const mostRecent = filtered.sort(
						(a, b) => b.updatedAt - a.updatedAt,
					)[0];
					if (mostRecent) {
						setActiveSessionId(mostRecent.id);
					} else {
						// No sessions left — create a new empty one
						const empty: ChatSession = {
							id: makeId(),
							title: "",
							createdAt: Date.now(),
							updatedAt: Date.now(),
							messages: [],
							contextItems: plugin.settings.includeActiveNote
								? [{ type: "active-note", id: makeId() }]
								: [],
							profileId: profileId || undefined,
							remoteUsers: [],
							selectedRemoteUserIds: [],
						};
						filtered.push(empty);
						setActiveSessionId(empty.id);
					}
				}
				return filtered;
			});
		},
		[plugin, profileId],
	);

	// ─── Rename a session ───
	const renameSession = useCallback((sessionId: string, newTitle: string) => {
		setSessions((prev) =>
			prev.map((s) =>
				s.id === sessionId ? { ...s, title: newTitle.trim() } : s,
			),
		);
	}, []);

	// ─── Update session messages ───
	const updateSessionMessages = useCallback(
		(sessionId: string, messages: ChatMessage[]) => {
			setSessions((prev) =>
				prev.map((s) =>
					s.id === sessionId
						? { ...s, messages, updatedAt: Date.now() }
						: s,
				),
			);
		},
		[],
	);

	// ─── Update session context items ───
	const updateSessionContextItems = useCallback(
		(sessionId: string, contextItems: ContextItem[]) => {
			setSessions((prev) =>
				prev.map((s) =>
					s.id === sessionId ? { ...s, contextItems } : s,
				),
			);
		},
		[],
	);

	// ─── Manual LLM rename of active session ───
	const manualRenameActiveSession = useCallback(async function (
		resolvedProfile: ProviderProfile,
		chatapi: ChatApiManager,
	): Promise<string | null> {
		const currentActiveId = activeSessionIdRef.current;
		if (!currentActiveId) return null;
		const session = sessionsRef.current.find(
			(s) => s.id === currentActiveId,
		);
		if (!session || session.messages.length === 0) {
			return null;
		}
		const title = await generateSessionTitleLLM(
			session.messages,
			resolvedProfile,
			chatapi,
		);
		if (title) {
			setSessions((prev) =>
				prev.map((s) =>
					s.id === currentActiveId ? { ...s, title } : s,
				),
			);
			return title;
		} else {
			const fallback = generateSessionTitle(session.messages);
			setSessions((prev) =>
				prev.map((s) =>
					s.id === currentActiveId ? { ...s, title: fallback } : s,
				),
			);
			return fallback;
		}
	}, []);

	return {
		sessions,
		setSessions,
		activeSessionId,
		setActiveSessionId,
		chatDataLoaded,
		sessionsRef,
		activeSessionIdRef,
		openSessionIds,
		setOpenSessionIds,
		createNewSession,
		deleteSession,
		renameSession,
		updateSessionMessages,
		updateSessionContextItems,
		manualRenameActiveSession,
		autoNameSessions,
		setAutoNameSessions,
	};
}

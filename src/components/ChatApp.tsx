import React, {
	useState,
	useRef,
	useCallback,
	useEffect,
	useMemo,
} from "react";
import {
	Notice,
	TFile,
	WorkspaceLeaf,
	MarkdownView,
	MarkdownRenderer,
	Component,
} from "obsidian";

import { ChatPluginLike } from "../views/ObsidianAIChatView";
import { ChatMessage, ChatSession, ContextItem, ContentPart } from "../types";
import { resolveContextItems } from "../context/ContextEngine";
import { resolveAttachments } from "../context/AttachmentEngine";
import { estimateTokens } from "../context/tokenEstimator";
import { noteTools } from "../agent/tools";
import { ToolExecutor } from "../agent/ToolExecutor";
import { AgentLoop } from "../agent/AgentLoop";
import type { ToolCall, ToolResult } from "../agent/types";
import { Orchestrator, AgentResponse } from "../agent/Orchestrator";
import { ParticipantRouter } from "../agent/ParticipantRouter";
import { parseMentions } from "../agent/MentionParser";
import { getAgentColor, getAgentIcon } from "../lib/agentVisuals";
import { contextItemKey, sameContextItems } from "../lib/contextUtils";
import { parseSlashCommand, SlashCommand } from "../lib/slashCommand";
import {
	makeId,
	getSessionTotalTokens,
	sessionMessageCount,
} from "../lib/sessionUtils";
import { buildSystemPrompt } from "../lib/systemPrompt";
import { useChatSession } from "../hooks/useChatSession";
import { useChatUI } from "../hooks/useChatUI";
import { useMessageActions } from "../hooks/useMessageActions";
import { useSessionActions } from "../hooks/useSessionActions";
import { useSettingsActions } from "../hooks/useSettingsActions";
import { useExportActions } from "../hooks/useExportActions";
import { useSearch } from "../hooks/useSearch";
import { useContextItems } from "../hooks/useContextItems";
import { useChatRuntimeState } from "../hooks/useChatRuntimeState";
import ActionBar from "./presentational/ActionBar";
import ChatTabBar from "./ChatTabBar";
import ChatMessages from "./ChatMessages";
import ContextBar from "./presentational/ContextBar";
import ChatInput from "./ChatInput";
import SessionPickerModal from "./presentational/SessionPickerModal";
import ContextPickerModal from "./ContextPickerModal";
import ExportModal from "./presentational/ExportModal";
import PendingToolCard from "./presentational/PendingToolCard";
import ObsidianIcon from "./ObsidianIcon";
import ChatToolbar from "./ChatToolbar";
import ChatMainArea from "./ChatMainArea";
import ChatOverlays from "./ChatOverlays";
import SearchInput from "./presentational/SearchInput";
import SearchResults from "./presentational/search-results";

import { ChatApiManager } from "../api";
import { OpenResponsesLoop } from "../agent/OpenResponsesLoop";
import { noteToolsToOpenResponses } from "../agent/tools/toOpenResponses";
import { getActiveProviderProfile, ProviderProfile } from "../settings";
import { resolveSessionProfile as resolveProfileForSession } from "../lib/sessionProfile";
import { rememberRecentModel } from "../lib/recentModels";
import { stripThinkingTags } from "./MessageBubble";
import { serializeChatExport, generateFilename } from "../utils/exportChat";
import type { ExportFormat } from "./presentational/ExportModal";
import { WebSocketSyncAdapter } from "../sync/WebSocketSyncAdapter";
import type { SyncAdapter } from "../sync/SyncAdapter";

interface ChatAppProps {
	plugin: ChatPluginLike;
	/** Optional profile ID to use for this chat panel. Falls back to active profile. */
	profileId?: string;
	initialSessionId?: string;
	initialMessageId?: string;
}

const ChatApp: React.FC<ChatAppProps> = ({
	plugin,
	profileId,
	initialSessionId,
	initialMessageId,
}) => {
	const {
		sessions,
		setSessions,
		activeSessionId,
		setActiveSessionId,
		chatDataLoaded,
		sessionsRef,
		activeSessionIdRef,
		openSessionIds: persistedOpenSessionIds,
		setOpenSessionIds: setPersistedOpenSessionIds,
		createNewSession,
		renameSession,
		updateSessionMessages,
		updateSessionContextItems,
		manualRenameActiveSession,
		autoNameSessions,
		setAutoNameSessions,
	} = useChatSession({ plugin, profileId });

	const [wasTruncated, setWasTruncated] = useState(false);
	const [contextTokenCount, setContextTokenCount] = useState(0);
	const [, setSettingsRevision] = useState(0);
	const [scrollToMessageId, setScrollToMessageId] = useState<
		string | undefined
	>(initialMessageId);
	const [thinkingEnabled, setThinkingEnabled] = useState(false);
	const savedSessions = useMemo(
		() => sessions.filter((session) => sessionMessageCount(session) > 0),
		[sessions],
	);

	const {
		activeRuntime,
		getRuntime,
		patchRuntime,
		clearRuntime,
		abortRuntime,
	} = useChatRuntimeState(activeSessionId);
	const messagesRef = useRef<ChatMessage[]>([]);

	useEffect(() => {
		const refreshFromSettings = () =>
			setSettingsRevision((revision) => revision + 1);
		window.addEventListener(
			"obsidian-ai:settings-changed",
			refreshFromSettings,
		);
		return () =>
			window.removeEventListener(
				"obsidian-ai:settings-changed",
				refreshFromSettings,
			);
	}, []);

	// Track if the app was hidden while streaming (for mobile background handling)
	const wasHiddenRef = useRef(false);
	const streamingWhenHiddenRef = useRef(false);

	// Force re-render when user returns to chat tab (settings may have changed)
	const [settingsTick, setSettingsTick] = useState(0);
	useEffect(() => {
		const onVis = () => {
			if (!document.hidden) setSettingsTick((t) => t + 1);
		};
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, []);

	const ui = useChatUI();
	const { connectedUsers, setConnectedUsers } = ui;
	useEffect(() => {
		ui.clearMessageSelection();
	}, [activeSessionId]);
	const suppressProfilePersistenceRef = useRef(false);
	const scrollSaveTimersRef = useRef<Map<string, number>>(new Map());
	const getSelectedProfileIds = useCallback(
		() => Array.from(ui.selectedProfileIds),
		[ui.selectedProfileIds],
	);
	const syncAdapterRef = useRef<SyncAdapter | null>(null);
	const [relayConnected, setRelayConnected] = useState(false);
	const [typingUsers, setTypingUsers] = useState<string[]>([]);
	const activeSession = useMemo(
		() => sessions.find((session) => session.id === activeSessionId),
		[sessions, activeSessionId],
	);
	useEffect(() => {
		ui.setMessageAttachments(activeSession?.draftAttachments ?? []);
	}, [
		activeSessionId,
		activeSession?.draftAttachments,
		ui.setMessageAttachments,
	]);
	const handleAttachmentsChange = useCallback(
		(attachments: import("../types").Attachment[]) => {
			ui.setMessageAttachments(attachments);
			if (!activeSessionId) return;
			setSessions((current) =>
				current.map((session) =>
					session.id === activeSessionId
						? {
								...session,
								draftAttachments:
									attachments.length > 0
										? attachments
										: undefined,
							}
						: session,
				),
			);
		},
		[activeSessionId, setSessions, ui.setMessageAttachments],
	);
	const modelOverrides = activeSession?.modelOverrides;
	const isMultiAgentSelection = ui.selectedProfileIds.size > 1;
	const getModelOverrides = useCallback(
		() => activeSession?.modelOverrides,
		[activeSession?.modelOverrides],
	);
	const resolveSessionProfile = useCallback(
		(baseProfile: ProviderProfile): ProviderProfile => {
			return resolveProfileForSession(
				baseProfile,
				modelOverrides,
				activeSession?.messages,
				isMultiAgentSelection ? baseProfile.id : undefined,
			);
		},
		[modelOverrides, activeSession?.messages, isMultiAgentSelection],
	);

	/** Resolve the profile for this chat panel */
	const resolvedProfile: ProviderProfile = useMemo(() => {
		if (profileId) {
			const p = plugin.settings.providerProfiles.find(
				(pr) => pr.id === profileId,
			);
			if (p) return resolveSessionProfile(p);
		}
		if (activeSession?.profileId) {
			const p = plugin.settings.providerProfiles.find(
				(pr) => pr.id === activeSession.profileId,
			);
			if (p) return resolveSessionProfile(p);
		}
		return resolveSessionProfile(getActiveProviderProfile(plugin.settings));
	}, [
		profileId,
		activeSession,
		plugin.settings.providerProfiles,
		settingsTick,
		resolveSessionProfile,
	]);

	const resolvedSelectedProfiles = useMemo(
		() =>
			Array.from(ui.selectedProfileIds)
				.map((id) =>
					plugin.settings.providerProfiles.find((p) => p.id === id),
				)
				.filter((p): p is ProviderProfile => Boolean(p))
				.map((p) => resolveSessionProfile(p)),
		[
			ui.selectedProfileIds,
			plugin.settings.providerProfiles,
			resolveSessionProfile,
		],
	);

	// Remember the models belonging to the newly active tab. Derive this from
	// the session itself rather than the shared UI selection state, which is
	// restored in a separate effect and can briefly describe the previous tab.
	const resolvedActiveSessionProfiles = useMemo(() => {
		const ids = profileId
			? [profileId]
			: activeSession?.selectedProfileIds?.length
				? activeSession.selectedProfileIds
				: activeSession?.profileId
					? [activeSession.profileId]
					: [getActiveProviderProfile(plugin.settings).id];
		const multiAgent = ids.length > 1;
		return ids
			.map((id) =>
				plugin.settings.providerProfiles.find((p) => p.id === id),
			)
			.filter((p): p is ProviderProfile => Boolean(p))
			.map((p) =>
				resolveProfileForSession(
					p,
					activeSession?.modelOverrides,
					activeSession?.messages,
					multiAgent ? p.id : undefined,
				),
			);
	}, [profileId, activeSession, plugin.settings.providerProfiles]);

	useEffect(() => {
		if (!chatDataLoaded || resolvedActiveSessionProfiles.length === 0)
			return;
		let nextRecentModels = plugin.settings.recentModels;
		for (const activeProfile of resolvedActiveSessionProfiles) {
			nextRecentModels = rememberRecentModel(
				nextRecentModels,
				activeProfile.provider,
				activeProfile.model,
			);
		}
		if (nextRecentModels !== plugin.settings.recentModels) {
			plugin.settings.recentModels = nextRecentModels;
			void plugin.saveSettings();
		}
	}, [
		chatDataLoaded,
		activeSessionId,
		resolvedActiveSessionProfiles,
		plugin,
	]);

	// ─── Derive participants from selectedProfileIds ───
	const participants = useMemo(() => {
		const ids = Array.from(ui.selectedProfileIds);
		if (ids.length < 2) return [];
		return ids.map((id) => {
			const profile = plugin.settings.providerProfiles.find(
				(p) => p.id === id,
			);
			const effectiveProfile = profile
				? resolveSessionProfile(profile)
				: undefined;
			return {
				id,
				name: effectiveProfile?.name ?? "Unknown",
				profileId: id,
				color: getAgentColor(effectiveProfile?.provider ?? "custom"),
				icon: getAgentIcon(effectiveProfile?.provider ?? "custom"),
			};
		});
	}, [
		ui.selectedProfileIds,
		plugin.settings.providerProfiles,
		resolveSessionProfile,
	]);

	// All selected agents for display in participant bar (includes single selections)
	const selectedAgents = useMemo(() => {
		const ids = Array.from(ui.selectedProfileIds);
		return ids.map((id) => {
			const profile = plugin.settings.providerProfiles.find(
				(p) => p.id === id,
			);
			const effectiveProfile = profile
				? resolveSessionProfile(profile)
				: undefined;
			return {
				id,
				name: effectiveProfile?.name ?? "Unknown",
				color: getAgentColor(effectiveProfile?.provider ?? "custom"),
				profile: effectiveProfile,
			};
		});
	}, [
		ui.selectedProfileIds,
		plugin.settings.providerProfiles,
		resolveSessionProfile,
	]);

	const isGroupChat =
		participants.length >= 2 || ui.selectedRemoteUserIds.size > 0;

	// ─── Group Chat Orchestrator ───
	const orchestrator = useMemo(() => {
		if (!isGroupChat || participants.length === 0) return null;
		const resolved = participants.map((p) => {
			const profile = plugin.settings.providerProfiles.find(
				(pr) => pr.id === p.profileId,
			);
			return {
				...p,
				profile: profile ? resolveSessionProfile(profile) : undefined,
			};
		});
		const orch = new Orchestrator({
			api: plugin.chatapi,
			participants: resolved.map((e) => ({
				id: e.id,
				name: e.name,
				profileId: e.profileId,
				color: e.color,
				icon: e.icon,
			})),
			mode: "sequential",
			contextStrategy: "full",
			enableTools: plugin.settings.enableAgentTools,
			autoApprove: plugin.settings.autoApply,
			maxSteps: plugin.settings.maxAgentSteps,
			maxContextMessages: plugin.settings.maxContextMessages ?? 10,
			maxRequestTokens: plugin.settings.maxRequestTokens ?? 32000,
			preserveRecentMessages: plugin.settings.preserveRecentMessages ?? 4,
			requestResponseReserveTokens:
				plugin.settings.requestResponseReserveTokens ?? 4096,
			maxToolResultTokens: plugin.settings.maxToolResultTokens ?? 4000,
			toolExecutor: new ToolExecutor(
				plugin.app,
				plugin.settings,
				plugin.personaLoader ?? undefined,
				plugin.searchIndex ?? undefined,
				() => activeSessionIdRef.current,
				plugin.integrationRegistry,
				plugin.saveSettings.bind(plugin),
			),
		});
		orch.engines = resolved.map((e) => ({
			id: e.id,
			name: e.name,
			color: e.color,
			profile:
				e.profile ??
				({
					id: e.profileId,
					name: e.name,
					provider: "custom",
					model: "default",
					createdAt: Date.now(),
					updatedAt: Date.now(),
				} as ProviderProfile),
		}));
		return orch;
	}, [
		isGroupChat,
		participants,
		plugin.chatapi,
		plugin.settings,
		plugin.app,
		resolveSessionProfile,
	]);

	// ─── Participant Router (wraps orchestrator + relay) ───
	const participantRouter = useMemo(() => {
		if (!isGroupChat || !relayConnected || !syncAdapterRef.current)
			return null;
		return new ParticipantRouter(
			orchestrator,
			syncAdapterRef.current,
			plugin.settings.syncUserName || "local",
		);
	}, [
		isGroupChat,
		orchestrator,
		relayConnected,
		plugin.settings.syncUserName,
	]);

	const messages = useMemo(() => {
		const s = sessions.find((s) => s.id === activeSessionId);
		return s?.messages ?? [];
	}, [sessions, activeSessionId]);
	messagesRef.current = messages;

	// Sync remoteUsers from active session to ParticipantRouter
	useEffect(() => {
		const session = sessions.find((s) => s.id === activeSessionId);
		if (participantRouter && session?.selectedRemoteUserIds) {
			participantRouter.setRemoteUsers(session.selectedRemoteUserIds);
		}
	}, [activeSessionId, sessions, participantRouter]);

	// ─── Session Actions ───
	const {
		openSessionIds,
		setOpenSessionIds,
		openSessionInTab,
		handleNewChat,
		handleLoadSession,
		handleCloseTab,
		handleCloseOtherTabs,
		handleCloseTabsToRight,
		handleDeleteSession,
		handleRenameSession,
	} = useSessionActions({
		plugin,
		profileId,
		sessionsRef,
		activeSessionIdRef,
		setSessions,
		setActiveSessionId,
		setScrollToMessageId,
		createNewSession,
		setSelectedProfileIds: ui.setSelectedProfileIds,
		getSelectedProfileIds,
		setDebateMode: ui.setDebateMode,
		setWasTruncated,
		isStreaming: activeRuntime.isStreaming,
		abortActiveRuntime: () => abortRuntime(activeSessionIdRef.current),
		clearSessionRuntime: (sessionId) => {
			abortRuntime(sessionId);
			clearRuntime(sessionId);
		},
		openSessionIds: persistedOpenSessionIds,
		setOpenSessionIds: setPersistedOpenSessionIds,
		getModelOverrides,
	});

	// The toolbar is shared visually, but profile selection belongs to the
	// newly active session. This is deliberately one-way: writing picker changes
	// back into the session happens in the separate effect below.
	useEffect(() => {
		const activeSession = sessions.find(
			(session) => session.id === activeSessionId,
		);
		if (!activeSession) return;
		const ids = activeSession.selectedProfileIds?.length
			? activeSession.selectedProfileIds
			: activeSession.profileId
				? [activeSession.profileId]
				: [getActiveProviderProfile(plugin.settings).id];
		const currentIds = Array.from(ui.selectedProfileIds);
		if (
			ids.length !== currentIds.length ||
			ids.some((id) => !ui.selectedProfileIds.has(id))
		) {
			suppressProfilePersistenceRef.current = true;
			ui.setSelectedProfileIds(new Set(ids));
		}
		// Also restore selected remote users
		const remoteIds = activeSession.selectedRemoteUserIds ?? [];
		const currentRemoteIds = Array.from(ui.selectedRemoteUserIds);
		if (
			remoteIds.length !== currentRemoteIds.length ||
			remoteIds.some((id) => !ui.selectedRemoteUserIds.has(id))
		) {
			suppressProfilePersistenceRef.current = true;
			ui.setSelectedRemoteUserIds(new Set(remoteIds));
		}
	}, [activeSessionId, chatDataLoaded]);

	const handleModelChange = useCallback(
		(profileId: string, model: string) => {
			if (!activeSessionId) return;
			setSessions((prev) =>
				prev.map((session) => {
					if (session.id !== activeSessionId) return session;
					const nextOverrides = {
						...(session.modelOverrides ?? {}),
						[profileId]: model,
					};
					return {
						...session,
						modelOverrides: nextOverrides,
						updatedAt: Date.now(),
					};
				}),
			);
		},
		[activeSessionId, setSessions],
	);

	// ─── Settings Actions ───
	const {
		autoApprove,
		handleToggleAutoApprove,
		handleToggleAutoName,
		handleManualRename,
	} = useSettingsActions({
		plugin,
		autoNameSessions,
		setAutoNameSessions,
		sessionsRef,
		activeSessionIdRef,
		manualRenameActiveSession,
		resolvedProfile,
	});

	// ─── Export Actions ───
	const { handleExportChat } = useExportActions(ui.setShowExportModal);

	// ─── Search ───
	const {
		searchQuery,
		setSearchQuery,
		searchResults,
		searchLoading,
		searchVisible,
		toggleSearch,
		handleSelectSearchResult,
	} = useSearch(sessions, openSessionInTab);

	// ─── Context Items ───
	const {
		contextItems,
		setContextItems,
		targetNoteName,
		setTargetNoteName,
		handleToggleActiveNote,
		handleRemoveContextItem,
		handleAddMention,
		handleAddContextItems,
	} = useContextItems(
		plugin,
		sessionsRef,
		activeSessionIdRef,
		setSessions,
		setWasTruncated,
		() => ui.setShowContextPicker(false),
	);

	// ─── Message Actions ───
	const actions = useMessageActions({
		plugin,
		orchestrator,
		participantRouter,
		resolvedProfile,
		isGroupChat,
		participants,
		thinkingEnabled,
		sessionsRef,
		activeSessionIdRef,
		setSessions,
		setWasTruncated,
		setContextTokenCount,
		setContextItems,
		messagesRef,
		contextItemsRef: { current: contextItems } as React.MutableRefObject<
			ContextItem[]
		>,
		lastMarkdownLeafRef: useRef<WorkspaceLeaf | null>(null),
		getRuntime,
		patchRuntime,
		clearRuntime,
		ui,
	});

	// ═══════════════════════════════════════════════════════
	// RELAY / SYNC
	// ═══════════════════════════════════════════════════════
	const activeSessionRelayEnabled = useMemo(() => {
		const session = sessions.find((s) => s.id === activeSessionId);
		return session?.relayEnabled ?? false;
	}, [sessions, activeSessionId]);

	// Connect/disconnect sync adapter when relayEnabled changes
	useEffect(() => {
		if (!activeSessionId) return;
		const session = sessions.find((s) => s.id === activeSessionId);
		if (!session) return;

		if (session.relayEnabled) {
			const adapter = new WebSocketSyncAdapter(
				plugin.settings.syncRelayUrl,
			);
			// Register callbacks BEFORE connect to avoid race with server roster
			adapter.onUserList((users) => {
				setConnectedUsers(users);
			});
			adapter.onPresence((event) => {
				if (event.type === "join") {
					setConnectedUsers((prev) =>
						prev.includes(event.userId)
							? prev
							: [...prev, event.userId],
					);
				} else if (event.type === "leave") {
					setConnectedUsers((prev) =>
						prev.filter((u) => u !== event.userId),
					);
				}
			});
			adapter.onMessage((remoteMsg) => {
				// Append remote message to current session
				setSessions((prev) =>
					prev.map((s) =>
						s.id === activeSessionId
							? {
									...s,
									messages: [...s.messages, remoteMsg],
									updatedAt: Date.now(),
								}
							: s,
					),
				);
			});
			adapter.onTyping((userId) => {
				// Show typing indicator for 3 seconds then remove
				setTypingUsers((prev) =>
					prev.includes(userId) ? prev : [...prev, userId],
				);
				window.setTimeout(() => {
					setTypingUsers((prev) => prev.filter((u) => u !== userId));
				}, 3000);
			});
			adapter
				.connect(
					plugin.settings.syncRoomId,
					plugin.settings.syncUserName,
				)
				.then(() => {
					setRelayConnected(true);
					new Notice("🔌 Relay connected");
				})
				.catch((err) => {
					console.warn("[ChatApp] Relay connect failed:", err);
					setRelayConnected(false);
					new Notice(`🔌 Relay failed: ${err.message}`);
				});
			syncAdapterRef.current = adapter;
		} else {
			if (syncAdapterRef.current) {
				syncAdapterRef.current.disconnect();
				syncAdapterRef.current = null;
				setRelayConnected(false);
				setConnectedUsers([]);
				setTypingUsers([]);
			}
		}

		return () => {
			if (syncAdapterRef.current) {
				syncAdapterRef.current.disconnect();
				syncAdapterRef.current = null;
				setRelayConnected(false);
				setConnectedUsers([]);
				setTypingUsers([]);
			}
		};
	}, [
		activeSessionId,
		activeSessionRelayEnabled,
		plugin.settings.syncRelayUrl,
		plugin.settings.syncRoomId,
		plugin.settings.syncUserName,
	]);

	const handleToggleRelay = useCallback(() => {
		if (!activeSessionId) return;
		setSessions((prev) =>
			prev.map((s) =>
				s.id === activeSessionId
					? { ...s, relayEnabled: !s.relayEnabled }
					: s,
			),
		);
	}, [activeSessionId, setSessions]);

	// Wrap handleSend to also sync to relay (only if ParticipantRouter is not handling it)
	const handleSendWithSync = useCallback(
		async (text: string, attachments?: import("../types").Attachment[]) => {
			await actions.handleSend(text, attachments);
			// Only do legacy relay sync if ParticipantRouter is not active
			if (
				!participantRouter &&
				syncAdapterRef.current &&
				relayConnected
			) {
				const userMsg: ChatMessage = {
					id: makeId(),
					role: "user",
					content: text,
					timestamp: Date.now(),
					attachments:
						attachments && attachments.length > 0
							? attachments
							: undefined,
					resolvedParts:
						attachments && attachments.length > 0
							? await resolveAttachments(
									attachments,
									plugin.app,
									resolvedProfile.provider,
								)
							: undefined,
				};
				syncAdapterRef.current.sendMessage(userMsg).catch((err) => {
					console.warn("[ChatApp] Failed to sync message:", err);
				});
			}
		},
		[
			actions.handleSend,
			plugin.app,
			relayConnected,
			participantRouter,
			resolvedProfile.provider,
		],
	);

	// Sync selectedProfileIds into the active session whenever they change
	useEffect(() => {
		if (!activeSessionId) return;
		if (suppressProfilePersistenceRef.current) {
			suppressProfilePersistenceRef.current = false;
			return;
		}
		const ids = Array.from(ui.selectedProfileIds);
		setSessions((prev) =>
			prev.map((s) => {
				if (s.id !== activeSessionId) return s;
				const nextParticipants =
					ids.length >= 2
						? ids.map((id) => {
								const profile =
									plugin.settings.providerProfiles.find(
										(p) => p.id === id,
									);
								return {
									id,
									name: profile?.name ?? "Unknown",
									profileId: id,
									color: getAgentColor(
										profile?.provider ?? "custom",
									),
									icon: getAgentIcon(
										profile?.provider ?? "custom",
									),
								};
							})
						: [];
				const alreadyMatches =
					s.profileId === (ids.length === 1 ? ids[0] : undefined) &&
					JSON.stringify(s.selectedProfileIds ?? []) ===
						JSON.stringify(ids) &&
					s.isGroupChat === ids.length >= 2 &&
					JSON.stringify(s.selectedRemoteUserIds ?? []) ===
						JSON.stringify(Array.from(ui.selectedRemoteUserIds));
				return alreadyMatches
					? s
					: {
							...s,
							profileId: ids.length === 1 ? ids[0] : undefined,
							selectedProfileIds: ids,
							isGroupChat:
								ids.length >= 2 ||
								ui.selectedRemoteUserIds.size > 0,
							participants: nextParticipants,
							selectedRemoteUserIds: Array.from(
								ui.selectedRemoteUserIds,
							),
						};
			}),
		);
	}, [
		ui.selectedProfileIds,
		ui.selectedRemoteUserIds,
		activeSessionId,
		plugin.settings.providerProfiles,
	]);

	const handleScrollPositionChange = useCallback(
		(sessionId: string, scrollTop: number) => {
			const existingTimer = scrollSaveTimersRef.current.get(sessionId);
			if (existingTimer) window.clearTimeout(existingTimer);
			scrollSaveTimersRef.current.set(
				sessionId,
				window.setTimeout(() => {
					setSessions((current) =>
						current.map((session) =>
							session.id === sessionId &&
							session.scrollPosition !== scrollTop
								? { ...session, scrollPosition: scrollTop }
								: session,
						),
					);
					scrollSaveTimersRef.current.delete(sessionId);
				}, 200),
			);
		},
		[setSessions],
	);
	useEffect(
		() => () => {
			scrollSaveTimersRef.current.forEach((timer) =>
				window.clearTimeout(timer),
			);
		},
		[],
	);

	// ─── Draft auto-save (debounced) ───
	const draftTimerRef = useRef<number | null>(null);
	const handleDraftChange = useCallback(
		(text: string) => {
			const currentActiveId = activeSessionIdRef.current;
			if (!currentActiveId) return;
			if (draftTimerRef.current) {
				window.clearTimeout(draftTimerRef.current);
			}
			draftTimerRef.current = window.setTimeout(() => {
				setSessions((prev) =>
					prev.map((s) =>
						s.id === currentActiveId ? { ...s, draft: text } : s,
					),
				);
				draftTimerRef.current = null;
			}, 500);
		},
		[setSessions],
	);
	useEffect(() => {
		return () => {
			if (draftTimerRef.current) {
				window.clearTimeout(draftTimerRef.current);
			}
		};
	}, []);

	// Initialise leaf tracking and register workspace listener
	useEffect(() => {
		const initLeaf =
			plugin.app.workspace.getLeavesOfType("markdown")[0] ?? null;
		if (initLeaf?.view instanceof MarkdownView) {
			setTargetNoteName(
				(initLeaf.view as MarkdownView).file?.basename ?? null,
			);
		}
	}, [plugin]);

	const hasHistory = savedSessions.length > 0;

	const handleCopySelectedMessages = useCallback(async () => {
		const selected = messages.filter((message) =>
			ui.selectedMessageIds.has(message.id),
		);
		if (!selected.length) return;
		try {
			await navigator.clipboard.writeText(
				serializeChatExport({
					kind: "messages",
					messages: selected,
					format: "md",
				}),
			);
			new Notice(`Copied ${selected.length} messages`);
			ui.clearMessageSelection();
		} catch (error) {
			new Notice(`Copy failed: ${(error as Error).message}`);
		}
	}, [messages, ui.selectedMessageIds, ui.clearMessageSelection]);

	const handleSessionCopy = useCallback(
		async (session: ChatSession, format: ExportFormat) => {
			// Index-only sessions hold no messages in memory yet — read the
			// file via a pure peek (hydration state untouched) first.
			let resolved = session;
			if (!session.hydrated && session.messageCount != null) {
				const messages =
					(await plugin.peekSessionMessages?.(session.id)) ?? [];
				if (messages.length > 0) resolved = { ...session, messages };
			}
			const content = serializeChatExport({
				kind: "sessions",
				sessions: [resolved],
				scope: "single",
				format,
				options: {
					debugMode: plugin.settings.debugMode,
					debugTelemetry: plugin.settings.debugTelemetry,
				},
			});
			try {
				await navigator.clipboard.writeText(content);
				new Notice(`Copied ${format.toUpperCase()} chat`);
			} catch (error) {
				new Notice(`Copy failed: ${(error as Error).message}`);
			}
		},
		[plugin.settings.debugMode, plugin.settings.debugTelemetry],
	);

	const handleSessionExport = useCallback(
		async (session: ChatSession, format: ExportFormat) => {
			// Same pure peek as handleSessionCopy before serializing.
			let resolved = session;
			if (!session.hydrated && session.messageCount != null) {
				const messages =
					(await plugin.peekSessionMessages?.(session.id)) ?? [];
				if (messages.length > 0) resolved = { ...session, messages };
			}
			const content = serializeChatExport({
				kind: "sessions",
				sessions: [resolved],
				scope: "single",
				format,
				options: {
					debugMode: plugin.settings.debugMode,
					debugTelemetry: plugin.settings.debugTelemetry,
				},
			});
			try {
				const filename = generateFilename(
					"single",
					format,
					session.title,
				);
				await plugin.app.vault.create(filename, content);
				new Notice(`Exported ${filename}`);
			} catch (error: any) {
				try {
					const filename = generateFilename(
						"single",
						format,
						session.title,
						true,
					);
					await plugin.app.vault.create(filename, content);
					new Notice(`Exported ${filename}`);
				} catch (retryError: any) {
					new Notice(`Export failed: ${retryError.message}`);
				}
			}
		},
		[plugin.app, plugin.settings.debugMode, plugin.settings.debugTelemetry],
	);

	const renderMarkdown = useCallback(
		async (markdown: string, target: HTMLElement, sourcePath?: string) => {
			const comp = new Component();
			await MarkdownRenderer.render(
				plugin.app,
				markdown,
				target,
				sourcePath ?? "",
				comp,
			);
		},
		[plugin.app],
	);

	return (
		<div className={`chat-panel${ui.zenMode ? " is-zen" : ""}`}>
			{!ui.zenMode && (
				<ChatToolbar
					plugin={plugin}
					resolvedProfile={resolvedProfile}
					sessionTitle={
						sessions.find((s) => s.id === activeSessionId)?.title
					}
					selectedAgents={selectedAgents}
					connectedUsers={connectedUsers}
					selectedProfileIds={ui.selectedProfileIds}
					resolvedSelectedProfiles={resolvedSelectedProfiles}
					modelOverrides={modelOverrides}
					onModelChange={handleModelChange}
					selectedRemoteUserIds={ui.selectedRemoteUserIds}
					showParticipantDropdown={ui.showParticipantDropdown}
					showRemoteUserDropdown={ui.showRemoteUserDropdown}
					participantDropdownRef={ui.participantDropdownRef}
					remoteUserDropdownRef={ui.remoteUserDropdownRef}
					autoApprove={autoApprove}
					autoNameSessions={autoNameSessions}
					zenMode={ui.zenMode}
					debateMode={ui.debateMode}
					searchVisible={searchVisible}
					relayEnabled={activeSessionRelayEnabled}
					relayConnected={relayConnected}
					remoteUserCount={connectedUsers.length}
					hasHistory={hasHistory}
					participantCount={ui.selectedProfileIds.size}
					onNewChat={handleNewChat}
					onLoadChat={() => ui.setShowSessionPicker(true)}
					onExportChat={handleExportChat}
					onOpenSync={() => {
						void plugin.triggerSync?.(false, { useModal: true });
					}}
					onToggleAutoApprove={handleToggleAutoApprove}
					onToggleAutoName={handleToggleAutoName}
					onManualRename={handleManualRename}
					onToggleZenMode={ui.toggleZenMode}
					onToggleDebateMode={ui.toggleDebateMode}
					onToggleSearch={toggleSearch}
					onToggleRelay={handleToggleRelay}
					onToggleParticipantDropdown={ui.toggleParticipantDropdown}
					onToggleRemoteUserDropdown={ui.toggleRemoteUserDropdown}
					onToggleProfile={ui.toggleProfile}
					onToggleRemoteUser={ui.toggleRemoteUser}
				/>
			)}
			{!ui.zenMode && (
				<ChatTabBar
					sessions={sessions}
					openSessionIds={openSessionIds}
					activeSessionId={activeSessionId}
					tabTitleWidth={plugin.settings.chatTabTitleWidth}
					onSelect={(sessionId) => openSessionInTab(sessionId)}
					onClose={handleCloseTab}
					onCloseOthers={handleCloseOtherTabs}
					onCloseToRight={handleCloseTabsToRight}
					onRename={handleRenameSession}
				/>
			)}
			{!ui.zenMode && searchVisible && (
				<>
					<SearchInput
						onSearch={setSearchQuery}
						placeholder="Search chats…"
					/>
					{searchQuery.trim() && (
						<SearchResults
							results={searchResults}
							loading={searchLoading}
							query={searchQuery}
							onSelectSession={handleSelectSearchResult}
						/>
					)}
				</>
			)}
			{ui.zenMode && (
				<button
					className="chat-btn chat-icon-btn chat-zen-exit"
					onClick={() => ui.setZenMode(false)}
					title="Exit zen mode"
				>
					<ObsidianIcon icon="eye-off" size={15} />
				</button>
			)}
			<ChatMainArea
				app={plugin.app}
				renderMarkdown={renderMarkdown}
				plugin={plugin}
				sessionId={activeSessionId}
				messages={messages}
				currentAiMessage={activeRuntime.currentAiMessage}
				currentContentParts={activeRuntime.currentContentParts}
				isStreaming={activeRuntime.isStreaming}
				debugMode={plugin.settings.debugMode}
				isEditing={ui.isEditing}
				thinkingEnabled={thinkingEnabled}
				showThinking={thinkingEnabled}
				scrollToMessageId={scrollToMessageId}
				restoreScrollTop={
					plugin.settings.restoreChatTabs
						? sessions.find(
								(session) => session.id === activeSessionId,
							)?.scrollPosition
						: undefined
				}
				pendingToolCall={activeRuntime.pendingToolCall}
				pendingToolDisplay={activeRuntime.pendingToolDisplay}
				typingUsers={typingUsers}
				onSend={handleSendWithSync}
				onStop={actions.handleStop}
				onTyping={() => syncAdapterRef.current?.sendTyping()}
				onAddMention={handleAddMention}
				onCancelEdit={actions.handleCancelEdit}
				onToggleThinking={() => setThinkingEnabled((t) => !t)}
				onAppend={actions.handleAppend}
				onInsertAtCursor={actions.handleInsertAtCursor}
				onApply={actions.handleApply}
				onRetry={actions.handleRetry}
				onEditMessage={actions.handleEditMessage}
				onApplyToTarget={actions.handleApplyToTarget}
				onCreateNote={actions.handleCreateNote}
				onAppendToTarget={actions.handleAppendToTarget}
				onOpenPastSession={openSessionInTab}
				onScrollPositionChange={handleScrollPositionChange}
				onApproveTool={actions.handleApproveTool}
				onRejectTool={actions.handleRejectTool}
				attachments={ui.messageAttachments}
				onAttachmentsChange={handleAttachmentsChange}
				pressEnterToSend={plugin.settings.pressEnterToSend}
				tokenTotal={(() => {
					const session = activeSessionId
						? sessions.find((s) => s.id === activeSessionId)
						: null;
					const sessionTotal = session
						? getSessionTotalTokens(session)
						: 0;
					const showFullRequest =
						plugin.settings.showFullRequestTokens;
					if (
						activeRuntime.isStreaming &&
						activeRuntime.runningTokenTotal > 0
					) {
						// When full payload mode is on, runningTokenTotal already
						// includes system + history + user + response tokens.
						// Show just that to avoid double-counting history.
						const displayTotal = showFullRequest
							? activeRuntime.runningTokenTotal
							: sessionTotal +
								activeRuntime.runningTokenTotal;
						return `~${displayTotal.toLocaleString()} tokens`;
					}
					if (sessionTotal > 0) {
						return `~${sessionTotal.toLocaleString()} tokens`;
					}
					return undefined;
				})()}
				draft={undefined}
				onDraftChange={undefined}
				editMessage={ui.editMessageText}
				selectionMode={ui.selectionMode}
				selectedMessageIds={ui.selectedMessageIds}
				onLongPress={ui.enterSelectionMode}
				onToggleSelection={ui.toggleMessageSelection}
			/>
			{ui.selectionMode && (
				<div className="chat-selection-toolbar" role="toolbar">
					<span>{ui.selectedMessageIds.size} selected</span>
					<button
						onClick={handleCopySelectedMessages}
						disabled={ui.selectedMessageIds.size === 0}
					>
						Copy
					</button>
					<button onClick={ui.clearMessageSelection}>Cancel</button>
				</div>
			)}
			<ChatOverlays
				plugin={plugin}
				savedSessions={savedSessions}
				activeSessionId={activeSessionId || null}
				showSessionPicker={ui.showSessionPicker}
				showExportModal={ui.showExportModal}
				showContextPicker={ui.showContextPicker}
				onLoadSession={handleLoadSession}
				onDeleteSession={handleDeleteSession}
				onRenameSession={handleRenameSession}
				onCloseSessionPicker={() => ui.setShowSessionPicker(false)}
				onCloseExportModal={() => ui.setShowExportModal(false)}
				onCloseContextPicker={() => ui.setShowContextPicker(false)}
				onAddContextItems={handleAddContextItems}
				onCopySession={handleSessionCopy}
				onExportSession={handleSessionExport}
			/>
		</div>
	);
};

export default ChatApp;

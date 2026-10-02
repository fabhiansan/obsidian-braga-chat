import { Notice, TFile } from "obsidian";
import type { ChatPluginLike } from "../views/ObsidianAIChatView";
import type {
	ChatMessage,
	ChatSession,
	ContextItem,
	ContentPart,
	GroupChatParticipant,
	ResolvedMessagePart,
	Attachment,
	AgentStepTelemetry,
	CompactionMetadata,
	CompactionTelemetry,
} from "../types";
import type { ApiCallTelemetryResult } from "../api";
import type { ProviderProfile } from "../settings";
import type { ToolCall, ToolResult } from "../agent/types";
import { toToolDisplayDescriptor } from "../agent/toolRegistry";
import { ToolExecutor } from "../agent/ToolExecutor";
import { runChatTurn } from "../agent/ChatTurnCoordinator";
import { ChatTurnOutput } from "../agent/ChatTurnOutput";
import { TurnActionController } from "./turnActions";
import { NoteEditingBridge } from "../noteEditing/NoteEditingBridge";
import { resolveContextItems } from "../context/ContextEngine";
import { resolveAttachments } from "../context/AttachmentEngine";
import {
	estimateTokens,
	estimateContentPartsTokens,
	estimateAttachmentTokens,
} from "../context/tokenEstimator";
import { buildModelHistory } from "../context/modelHistory";
import {
	buildCompactionPrompt,
	compactionHysteresisReleased,
	compactionMetadataMatchesTranscript,
	createCompactionMetadata,
	formatCompactionSummary,
	parseCompactionMetadata,
	parseCompactionResponseDetailed,
	compactionResponseFailureMessage,
	describeCompactionResponseDiagnostics,
	planSemanticCompaction,
	transcriptStartsWith,
} from "../context/semanticCompaction";
import { buildSystemPrompt } from "../lib/systemPrompt";
import { parseSlashCommand } from "../lib/slashCommand";
import {
	handleDebugCommand,
	type DebugCommandResult,
} from "../lib/debugCommands";
import { makeId } from "../lib/sessionUtils";
import { stripThinkingTags } from "../components/MessageBubble";
import type {
	ChatRuntimeState,
	ChatRuntimePatch,
} from "../hooks/useChatRuntimeState";
import type { UseChatUIResult } from "../hooks/useChatUI";
import type { ParticipantRouter } from "../agent/ParticipantRouter";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface TurnLifecycleDeps {
	plugin: ChatPluginLike;
	orchestrator: import("../agent/Orchestrator").Orchestrator | null;
	participantRouter: ParticipantRouter | null;
	resolvedProfile: ProviderProfile;
	isGroupChat: boolean;
	participants: GroupChatParticipant[];
	thinkingEnabled: boolean;
	sessionsRef: { current: ChatSession[] };
	activeSessionIdRef: { current: string | null };
	setSessions: (
		update: ((prev: ChatSession[]) => ChatSession[]) | ChatSession[],
	) => void;
	getRuntime: (sessionId: string | null | undefined) => ChatRuntimeState;
	patchRuntime: (
		sessionId: string | null | undefined,
		patch:
			| ChatRuntimePatch
			| ((current: ChatRuntimeState) => ChatRuntimePatch),
	) => void;
	clearRuntime: (sessionId: string | null | undefined) => void;
	setWasTruncated: (value: boolean) => void;
	setContextTokenCount: (count: number) => void;
	setContextItems: (items: ContextItem[]) => void;
	messagesRef: { current: ChatMessage[] };
	contextItemsRef: { current: ContextItem[] };
	ui: UseChatUIResult;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function formatPastSessionLinks(
	toolCalls: Array<{ call: ToolCall; result?: ToolResult }>,
	sessions: ChatSession[],
): string {
	const results = toolCalls
		.filter((entry) => entry.call.toolName === "search_past_sessions")
		.flatMap((entry) => entry.result?.sessionResults ?? [])
		.filter(
			(result, index, all) =>
				all.findIndex(
					(candidate) =>
						candidate.sessionId === result.sessionId &&
						candidate.messageId === result.messageId,
				) === index,
		);
	if (results.length === 0) return "";

	const links = results.map((session) => {
		const title =
			sessions.find((candidate) => candidate.id === session.sessionId)
				?.title ||
			`Session from ${new Date(session.timestamp).toLocaleDateString()}`;
		const params = new URLSearchParams({
			sessionId: session.sessionId,
			messageId: session.messageId,
		});
		const safeTitle = title.replace(/[\\[\]]/g, "\\$&");
		const snippet = session.snippet
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 180);
		return `- **[${safeTitle}](obsidian-ai://open-session?${params.toString()})**  \n  ${snippet}${session.snippet.length > 180 ? "…" : ""}`;
	});
	return `\n\n### Past sessions\n${links.join("\n")}`;
}

// ═══════════════════════════════════════════════════════
// TURN LIFECYCLE
// ═══════════════════════════════════════════════════════

/** Braga fork: how a relay room routes a message (see src/sync/relayAgents.ts). */
export interface SendOptions {
	/** Answer with this profile instead of the tab's active one. */
	profile?: ProviderProfile;
	/** Only post the message; no model answers (another member's agent was mentioned). */
	skipModel?: boolean;
	/** Fields kept on the posted user message, e.g. a remote sender. */
	userMessage?: Partial<ChatMessage>;
}

export class TurnLifecycle {
	private compactionBySession: Record<string, CompactionMetadata> = {};
	private compactionInFlight: Record<string, boolean> = {};
	private currentToolExecutor: ToolExecutor | null = null;
	private readonly actions: TurnActionController;
	private readonly getDeps: () => TurnLifecycleDeps;

	constructor(getDeps: () => TurnLifecycleDeps) {
		this.getDeps = getDeps;
		this.actions = new TurnActionController(
			getDeps,
			() => this.currentToolExecutor,
			(text, attachments) => this.send(text, attachments),
		);
	}

	private appendDebugMessage(response: string): void {
		const deps = this.getDeps();
		const debugMsg: ChatMessage = {
			id: makeId(),
			role: "assistant",
			content: response,
			timestamp: Date.now(),
			isDebug: true,
		};
		const currentActiveId = deps.activeSessionIdRef.current;
		if (!currentActiveId) return;
		deps.setSessions((prev) =>
			prev.map((session) =>
				session.id === currentActiveId
					? {
							...session,
							messages: [...session.messages, debugMsg],
							updatedAt: Date.now(),
						}
					: session,
			),
		);
	}

	private appendDebugMessageToSession(
		sessionId: string,
		response: string,
	): void {
		const deps = this.getDeps();
		const debugMsg: ChatMessage = {
			id: makeId(),
			role: "assistant",
			content: response,
			timestamp: Date.now(),
			isDebug: true,
		};
		deps.setSessions((prev) =>
			prev.map((session) =>
				session.id === sessionId
					? {
							...session,
							messages: [...session.messages, debugMsg],
							updatedAt: Date.now(),
						}
					: session,
			),
		);
	}

	private async callCompactionApi(
		prompt: string,
		profile: ProviderProfile | undefined,
	): Promise<{ text: string; telemetry: CompactionTelemetry }> {
		const systemMessage =
			"You summarize conversation history for another model. Return JSON only.";
		const api = this.getDeps().plugin.chatapi as any;
		const startedAt = Date.now();
		if (typeof api.callApiWithTelemetry === "function") {
			const result = (await api.callApiWithTelemetry(
				systemMessage,
				prompt,
				profile,
			)) as ApiCallTelemetryResult;
			return {
				text: result.text,
				telemetry: {
					requestTokenEstimate: result.requestTokenEstimate,
					providerUsage: result.providerUsage,
					responseTimeMs: result.responseTimeMs,
				},
			};
		}

		const text = await api.callApi(systemMessage, prompt, profile);
		return {
			text,
			telemetry: {
				requestTokenEstimate:
					estimateTokens(systemMessage) + estimateTokens(prompt),
				responseTimeMs: Date.now() - startedAt,
			},
		};
	}

	/** Run a user-requested compaction immediately and report the result in chat. */
	private async runManualCompaction(): Promise<string> {
		const deps = this.getDeps();
		const sessionId = deps.activeSessionIdRef.current;
		if (!sessionId) {
			return "**Compaction Test**\n\nNo active session.";
		}
		if (this.compactionInFlight[sessionId]) {
			return "**Compaction Test**\n\nA compaction request is already in progress for this session.";
		}

		const session = deps.sessionsRef.current.find(
			(candidate) => candidate.id === sessionId,
		);
		const transcript = (
			session?.messages ?? deps.messagesRef.current
		).filter((message) => !message.isDebug);
		const keepRecentMessages = Math.max(
			3,
			deps.plugin.settings.preserveRecentMessages ?? 4,
		);
		const summarized = transcript.slice(
			0,
			Math.max(0, transcript.length - keepRecentMessages),
		);
		if (summarized.length === 0) {
			return [
				"**Compaction Test**",
				"",
				`Need at least ${keepRecentMessages + 1} non-debug messages.`,
				`The current session has ${transcript.length}; the newest ${keepRecentMessages} are preserved exactly.`,
			].join("\n");
		}

		const compactionProfile =
			deps.resolvedProfile.provider === "agent"
				? undefined
				: deps.resolvedProfile;
		this.compactionInFlight[sessionId] = true;
		let responseDiagnostics: ReturnType<
			typeof parseCompactionResponseDetailed
		> | null = null;
		try {
			const compactionResult = await this.callCompactionApi(
				buildCompactionPrompt(summarized, {
					maxTokens: 8000,
					maxToolResultTokens: 1200,
					sessionId,
				}),
				compactionProfile,
			);
			const rawSummary = compactionResult.text;
			const currentTranscript = (
				deps.sessionsRef.current.find(
					(candidate) => candidate.id === sessionId,
				)?.messages ?? deps.messagesRef.current
			).filter((message) => !message.isDebug);
			if (!transcriptStartsWith(currentTranscript, transcript)) {
				throw new Error(
					"Transcript changed while compaction was running",
				);
			}
			responseDiagnostics = parseCompactionResponseDetailed(rawSummary);
			if (!responseDiagnostics.summary) {
				throw new Error(
					compactionResponseFailureMessage(responseDiagnostics),
				);
			}
			const parsed = responseDiagnostics.summary;
			const metadata = createCompactionMetadata({
				sourceMessages: summarized,
				transcriptMessages: transcript,
				summary: parsed,
				model: compactionProfile?.model,
				telemetry: compactionResult.telemetry,
			});
			this.compactionBySession[sessionId] = metadata;
			deps.setSessions((prev) =>
				prev.map((candidate) =>
					candidate.id === sessionId
						? { ...candidate, compactionMetadata: metadata }
						: candidate,
				),
			);
			new Notice("Conversation compacted for future requests.");
			return [
				"**Compaction Test**",
				"",
				`✅ Summary validated and saved for ${summarized.length} older message(s).`,
				`Kept the newest ${transcript.length - summarized.length} message(s) exact.`,
				"The complete transcript remains unchanged; future model requests can use the saved summary.",
				"",
				formatCompactionSummary(parsed),
			].join("\n");
		} catch (error) {
			const detail =
				error instanceof Error ? error.message : String(error);
			deps.plugin.logger?.log(
				"error",
				`[T48c] Manual compaction failed: ${detail}${responseDiagnostics ? ` (${describeCompactionResponseDiagnostics(responseDiagnostics)})` : ""}`,
			);
			return [
				"**Compaction Test**",
				"",
				`❌ Compaction failed: ${detail}`,
				"No compaction metadata was saved. Check the plugin debug log for details.",
			].join("\n");
		} finally {
			delete this.compactionInFlight[sessionId];
		}
	}

	// ─────────────────────────────────────────────────────
	// SEND
	// ─────────────────────────────────────────────────────
	send = async (
		text: string,
		attachments?: Attachment[],
		options: SendOptions = {},
	): Promise<void> => {
		const deps = this.getDeps();

		if (
			(!text.trim() && (!attachments || attachments.length === 0)) ||
			deps.getRuntime(deps.activeSessionIdRef.current).controller
		)
			return;
		const fromRelay = Boolean(options.userMessage?.remote);

		// Check for local debug commands before selecting the single- or group-chat
		// execution path. Built-in ! commands must never reach a model.
		const currentSession = deps.sessionsRef.current.find(
			(s) => s.id === deps.activeSessionIdRef.current,
		);
		const debugResult: DebugCommandResult = fromRelay
			? { handled: false }
			: handleDebugCommand(text, currentSession, deps.resolvedProfile, {
					toolHistoryMode:
						deps.plugin.settings.toolHistoryMode ?? "elide",
					maxRequestTokens: deps.plugin.settings.maxRequestTokens,
					maxContextMessages: deps.plugin.settings.maxContextMessages,
					maxToolResultTokens:
						deps.plugin.settings.maxToolResultTokens,
					preserveRecentMessages:
						deps.plugin.settings.preserveRecentMessages,
					requestResponseReserveTokens:
						deps.plugin.settings.requestResponseReserveTokens,
					enableAgentTools: deps.plugin.settings.enableAgentTools,
				});
		if (debugResult.handled) {
			const response =
				debugResult.action === "compact"
					? await this.runManualCompaction()
					: debugResult.response || "";
			this.appendDebugMessage(response);
			return;
		}

		// ─── GROUP CHAT PATH ───
		if (deps.isGroupChat && (deps.participantRouter || deps.orchestrator)) {
			const groupAttachments =
				attachments ?? deps.ui.messageAttachments ?? [];
			const groupResolvedParts =
				groupAttachments.length > 0
					? await resolveAttachments(
							groupAttachments,
							deps.plugin.app,
							deps.resolvedProfile.provider,
						)
					: [];
			const userTokenEstimate =
				estimateTokens(text) +
				groupAttachments.reduce(
					(sum, att) => sum + estimateAttachmentTokens(att),
					0,
				);
			const userMsg: ChatMessage = {
				id: makeId(),
				role: "user",
				content: text,
				timestamp: Date.now(),
				attachments:
					groupAttachments.length > 0 ? groupAttachments : undefined,
				resolvedParts:
					groupResolvedParts.length > 0
						? (groupResolvedParts as ResolvedMessagePart[])
						: undefined,
				estimatedTokens: userTokenEstimate,
			};
			const currentActiveId = deps.activeSessionIdRef.current;
			if (!currentActiveId) return;
			deps.setSessions((prev) =>
				prev.map((s) =>
					s.id === currentActiveId
						? {
								...s,
								messages: [...s.messages, userMsg],
								updatedAt: Date.now(),
							}
						: s,
				),
			);
			const controller = new AbortController();
			deps.patchRuntime(currentActiveId, {
				isStreaming: true,
				controller,
				currentAiMessage: "",
				currentContentParts: [],
				pendingToolCall: null,
				pendingToolDisplay: null,
				resolveTool: null,
				runningTokenTotal: 0,
			});

			// Use ParticipantRouter if available, otherwise fall back to Orchestrator
			const router = deps.participantRouter || deps.orchestrator!;
			const { targets } = router.parseAndRoute(text, groupAttachments);
			deps.ui.setTypingAgents(new Set(targets.map((t: any) => t.name)));

			try {
				const stream = deps.ui.debateMode
					? deps.orchestrator!.debate(
							text,
							deps.sessionsRef.current.find(
								(s) => s.id === currentActiveId,
							)?.messages ?? [],
							controller.signal,
							groupResolvedParts,
							2,
						)
					: deps.participantRouter
						? deps.participantRouter.dispatch(
								text,
								deps.sessionsRef.current.find(
									(s) => s.id === currentActiveId,
								)?.messages ?? [],
								controller.signal,
								groupResolvedParts,
							)
						: deps.orchestrator!.dispatch(
								text,
								deps.sessionsRef.current.find(
									(s) => s.id === currentActiveId,
								)?.messages ?? [],
								controller.signal,
								groupResolvedParts,
							);

				for await (const response of stream) {
					deps.ui.setTypingAgents((prev) => {
						const next = new Set(prev);
						next.delete(response.agentName);
						return next;
					});

					const assistantMsg: ChatMessage = {
						id: makeId(),
						role: "assistant",
						content: response.error
							? `⚠️ ${response.agentName} failed: ${response.error}`
							: response.text,
						timestamp: Date.now(),
						agentId: response.agentId,
						agentName: response.agentName,
						agentColor: response.agentColor,
						modelName: response.modelName,
						isError: !!response.error,
						toolCalls: response.toolCalls,
						estimatedTokens: response.tokenEstimate,
						providerUsage: response.providerUsage,
					};

					deps.setSessions((prev) =>
						prev.map((s) =>
							s.id === currentActiveId
								? {
										...s,
										messages: [...s.messages, assistantMsg],
										updatedAt: Date.now(),
									}
								: s,
						),
					);
				}
			} catch (error: any) {
				new Notice(`❌ Group chat error: ${error.message}`);
				const errorMsg: ChatMessage = {
					id: makeId(),
					role: "assistant",
					content: `⚠️ Council error: ${error.message}`,
					timestamp: Date.now(),
					isError: true,
				};
				deps.setSessions((prev) =>
					prev.map((s) =>
						s.id === currentActiveId
							? {
									...s,
									messages: [...s.messages, errorMsg],
									updatedAt: Date.now(),
								}
							: s,
					),
				);
			} finally {
				deps.patchRuntime(currentActiveId, {
					isStreaming: false,
					controller: null,
					runningTokenTotal: 0,
				});
				deps.ui.setTypingAgents(new Set());
			}
			return;
		}

		// ─── SINGLE CHAT PATH ───

		const slashCmd = fromRelay ? null : parseSlashCommand(text);
		let sendText = text;
		let sendContextItems = deps.contextItemsRef.current;
		let commandMeta: ChatMessage["command"] = undefined;

		if (slashCmd) {
			commandMeta = {
				type: slashCmd.command,
				target: slashCmd.target,
			};
			sendText =
				slashCmd.prompt ||
				`Please ${slashCmd.command} ${slashCmd.target}`;

			if (slashCmd.command === "edit" || slashCmd.command === "append") {
				const file = deps.plugin.app.metadataCache.getFirstLinkpathDest(
					slashCmd.target,
					"",
				);
				if (file && file instanceof TFile) {
					const exists = sendContextItems.some(
						(i) => i.type === "note" && i.path === file.path,
					);
					if (!exists) {
						sendContextItems = [
							...sendContextItems,
							{
								type: "note",
								path: file.path,
								name: file.basename,
								id: makeId(),
							},
						];
					}
				}
			}
		}

		const resolved = await resolveContextItems(
			sendContextItems,
			deps.plugin.app,
			deps.plugin.settings.maxContextTokens || 8000,
		);
		deps.setWasTruncated(resolved.wasTruncated);
		deps.setContextTokenCount(resolved.stats.estimatedTokens);

		const selectedIds = Array.from(deps.ui.selectedProfileIds);
		const currentActiveId = deps.activeSessionIdRef.current;
		if (!currentActiveId) return;

		// ─── HUMAN-ONLY TAB: No AI selected ───
		if (
			options.skipModel ||
			(selectedIds.length === 0 && !options.profile)
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
				...options.userMessage,
			};
			deps.setSessions((prev) =>
				prev.map((s) =>
					s.id === currentActiveId
						? {
								...s,
								messages: [...s.messages, userMsg],
								updatedAt: Date.now(),
							}
						: s,
				),
			);
			return;
		}

		// ChatApp has already resolved the active tab's identity, including the
		// legacy last-assistant model fallback. Use that same value for execution.
		const activeProfile: ProviderProfile =
			options.profile ?? deps.resolvedProfile;

		// Resolve attachments before computing token estimate
		let resolvedAttachmentParts: import("../api").MessageContentPart[] = [];
		if (attachments && attachments.length > 0) {
			resolvedAttachmentParts = await resolveAttachments(
				attachments,
				deps.plugin.app,
				activeProfile.provider,
			);
		}

		// Compute token estimate: context text + message text + attachments
		let userTokenEstimate = estimateTokens(
			(resolved.contextString ? resolved.contextString + "\n\n" : "") +
				sendText,
		);
		if (resolvedAttachmentParts.length > 0) {
			userTokenEstimate += estimateContentPartsTokens(
				resolvedAttachmentParts as Array<
					| { type: "text"; text: string }
					| { type: "image"; image: string }
					| { type: "file"; data: string; mimeType: string }
				>,
			);
		}

		const userMsg: ChatMessage = {
			id: makeId(),
			role: "user",
			content: text,
			timestamp: Date.now(),
			contextItems: sendContextItems,
			attachments:
				attachments && attachments.length > 0 ? attachments : undefined,
			resolvedParts:
				resolvedAttachmentParts.length > 0
					? (resolvedAttachmentParts as ResolvedMessagePart[])
					: undefined,
			estimatedTokens: userTokenEstimate,
			...options.userMessage,
		};

		deps.plugin.logger?.log(
			"info",
			`[Chat] user message — session ${currentActiveId.slice(0, 8)}, ` +
				`${attachments?.length ?? 0} attachment(s), ` +
				`${sendContextItems?.length ?? 0} context item(s), ` +
				`~${userTokenEstimate} tokens`,
		);
		deps.setSessions((prev) =>
			prev.map((s) =>
				s.id === currentActiveId
					? {
							...s,
							messages: [...s.messages, userMsg],
							updatedAt: Date.now(),
							contextItems: sendContextItems,
						}
					: s,
			),
		);
		const controller = new AbortController();
		deps.patchRuntime(currentActiveId, {
			isStreaming: true,
			currentAiMessage: "",
			currentContentParts: [],
			pendingToolCall: null,
			pendingToolDisplay: null,
			controller,
			resolveTool: null,
			runningTokenTotal: 0,
		});
		const streamStartTime = Date.now();

		const maxContextMessages =
			deps.plugin.settings.maxContextMessages || 10;
		const sessionIdForCompaction = deps.activeSessionIdRef.current;
		const activeSessionForCompaction = sessionIdForCompaction
			? deps.sessionsRef.current.find(
					(session) => session.id === sessionIdForCompaction,
				)
			: undefined;
		const currentModelMessages = deps.messagesRef.current.filter(
			(message) => !message.isDebug,
		);
		const parsedPersistedCompaction =
			activeSessionForCompaction?.compactionMetadata
				? parseCompactionMetadata(
						activeSessionForCompaction.compactionMetadata,
					)
				: undefined;
		const persistedCompaction =
			parsedPersistedCompaction &&
			compactionMetadataMatchesTranscript(
				parsedPersistedCompaction,
				currentModelMessages,
			)
				? parsedPersistedCompaction
				: undefined;
		let existingSummary = sessionIdForCompaction
			? (() => {
					const inMemory =
						this.compactionBySession[sessionIdForCompaction];
					return inMemory &&
						compactionMetadataMatchesTranscript(
							inMemory,
							currentModelMessages,
						)
						? inMemory
						: (persistedCompaction ?? undefined);
				})()
			: undefined;
		if (
			existingSummary &&
			compactionHysteresisReleased(currentModelMessages, {
				triggerTokens:
					deps.plugin.settings.compactionTriggerTokens ?? 24000,
				releaseTokens:
					deps.plugin.settings.compactionReleaseTokens ?? 16000,
				keepRecentMessages: Math.max(
					3,
					deps.plugin.settings.preserveRecentMessages ?? 4,
				),
			})
		) {
			existingSummary = undefined;
			if (sessionIdForCompaction) {
				delete this.compactionBySession[sessionIdForCompaction];
				deps.setSessions((prev) =>
					prev.map((session) => {
						if (session.id !== sessionIdForCompaction)
							return session;
						const {
							compactionMetadata: _metadata,
							...withoutMetadata
						} = session;
						return withoutMetadata;
					}),
				);
			}
		}
		const compactionSourceMessages = currentModelMessages.slice();
		const compactionPlan = planSemanticCompaction(
			compactionSourceMessages,
			{
				triggerTokens:
					deps.plugin.settings.compactionTriggerTokens ?? 24000,
				releaseTokens:
					deps.plugin.settings.compactionReleaseTokens ?? 16000,
				keepRecentMessages: Math.max(
					3,
					deps.plugin.settings.preserveRecentMessages ?? 4,
				),
				maxTokens: 8000,
				maxToolResultTokens: 1200,
				sessionId: sessionIdForCompaction ?? undefined,
			},
			Boolean(existingSummary),
		);
		let modelHistory = deps.messagesRef.current;
		let compactionSummary = existingSummary
			? formatCompactionSummary(existingSummary.summary)
			: "";
		if (
			compactionPlan.shouldCompact &&
			sessionIdForCompaction &&
			!this.compactionInFlight[sessionIdForCompaction]
		) {
			// Fire-and-forget: the current request is never delayed by compaction.
			// Use default provider profile for compaction (agent profiles don't support callApi).
			const compactionProfile =
				activeProfile.provider === "agent" ? undefined : activeProfile;
			this.compactionInFlight[sessionIdForCompaction] = true;
			void this.callCompactionApi(
				compactionPlan.prompt,
				compactionProfile,
			)
				.then(({ text: rawSummary, telemetry }) => {
					if (
						!transcriptStartsWith(
							deps.messagesRef.current.filter(
								(message) => !message.isDebug,
							),
							compactionSourceMessages,
						)
					) {
						throw new Error(
							"Transcript changed while compaction was running",
						);
					}
					const responseDiagnostics =
						parseCompactionResponseDetailed(rawSummary);
					if (!responseDiagnostics.summary) {
						throw new Error(
							`${compactionResponseFailureMessage(responseDiagnostics)} (${describeCompactionResponseDiagnostics(responseDiagnostics)})`,
						);
					}
					const parsed = responseDiagnostics.summary;
					const metadata = createCompactionMetadata({
						sourceMessages: compactionPlan.summarized,
						transcriptMessages: compactionSourceMessages,
						summary: parsed,
						model: compactionProfile?.model,
						telemetry,
					});
					this.compactionBySession[sessionIdForCompaction] = metadata;
					const summarizedCount = compactionPlan.summarized.length;
					const recentCount = compactionPlan.recent.length;
					const providerTotal = telemetry.providerUsage?.totalTokens;
					const usageLine = Number.isFinite(providerTotal)
						? ` Provider usage: ${providerTotal!.toLocaleString()} tokens.`
						: telemetry.requestTokenEstimate !== undefined
							? ` Estimated compaction request: ${telemetry.requestTokenEstimate.toLocaleString()} tokens.`
							: "";
					const debugMsg: ChatMessage = {
						id: makeId(),
						role: "assistant",
						content: [
							"**Context Compacted**",
							"",
							`✅ Automatic compaction completed. Summary saved for ${summarizedCount} older message(s); kept ${recentCount} recent message(s) exact.${usageLine}`,
							"This local event is recorded in the transcript and is excluded from future model requests.",
						].join("\n"),
						timestamp: Date.now(),
						isDebug: true,
					};
					deps.setSessions((prev) =>
						prev.map((session) =>
							session.id === sessionIdForCompaction
								? {
										...session,
										compactionMetadata: metadata,
										messages: [
											...session.messages,
											debugMsg,
										],
										updatedAt: Date.now(),
									}
								: session,
						),
					);
					new Notice("Conversation compacted for future requests.");
				})
				.catch((error) => {
					const detail =
						error instanceof Error ? error.message : String(error);
					deps.plugin.logger?.log(
						"error",
						`[T48c] Automatic compaction failed: ${detail}`,
					);
					this.appendDebugMessageToSession(
						sessionIdForCompaction,
						[
							"**Context Compaction**",
							"",
							`❌ Automatic compaction failed: ${detail}`,
							"No compaction metadata was saved.",
						].join("\n"),
					);
				})
				.finally(() => {
					delete this.compactionInFlight[sessionIdForCompaction];
				});
		} else if (existingSummary) {
			modelHistory = currentModelMessages.slice(
				-Math.max(3, deps.plugin.settings.preserveRecentMessages ?? 4),
			);
		}
		let userContent = sendText;
		if (resolved.contextString) {
			userContent = `${resolved.contextString}\n\n${sendText}`;
		}

		const isAgentProvider = activeProfile.provider === "agent";
		const useTools =
			deps.plugin.settings.enableAgentTools || isAgentProvider;
		const toolExecutor = new ToolExecutor(
			deps.plugin.app,
			deps.plugin.settings,
			deps.plugin.personaLoader ?? undefined,
			deps.plugin.searchIndex ?? undefined,
			() => currentActiveId,
			deps.plugin.integrationRegistry,
			deps.plugin.saveSettings
				? deps.plugin.saveSettings.bind(deps.plugin)
				: undefined,
			deps.plugin.manifest?.id,
			undefined,
			() => deps.sessionsRef.current,
			deps.plugin.logger,
		);
		this.currentToolExecutor = toolExecutor;
		const resolvedToolRegistry = toolExecutor.getResolvedToolRegistry();
		const toolRegistry = resolvedToolRegistry.tools;
		const autoApprove = deps.plugin.settings.autoApply;
		const maxAgentSteps = deps.plugin.settings.maxAgentSteps;

		let userMessageContent: string | import("../api").MessageContentPart[] =
			userContent;
		if (resolvedAttachmentParts.length > 0) {
			userMessageContent = [
				{ type: "text", text: userContent },
				...resolvedAttachmentParts,
			];
		}

		let systemPrompt = await buildSystemPrompt(
			sendContextItems,
			deps.plugin.personaLoader,
			slashCmd ?? undefined,
			useTools && !slashCmd,
			undefined,
			resolvedToolRegistry.definitions,
			deps.plugin.settings.intelligence?.identityContextBudget,
		);
		if (compactionSummary) {
			systemPrompt += `\n\n${compactionSummary}`;
		}
		const modelHistoryResult = buildModelHistory({
			systemPrompt,
			currentMessage: userMessageContent,
			history: modelHistory,
			maxMessages: maxContextMessages,
			maxToolResultTokens:
				deps.plugin.settings.maxToolResultTokens ?? 4000,
			toolHistoryMode: deps.plugin.settings.toolHistoryMode ?? "elide",
			agentMode: isAgentProvider || (useTools && !slashCmd),
			sessionId: sessionIdForCompaction ?? undefined,
			resultCatalogTokens: 600,
			budget: {
				maxRequestTokens:
					deps.plugin.settings.maxRequestTokens ?? 32000,
				maxMessages: maxContextMessages,
				preserveRecentMessages:
					deps.plugin.settings.preserveRecentMessages ?? 4,
				responseReserveTokens:
					deps.plugin.settings.requestResponseReserveTokens ?? 4096,
				additionalTokens: useTools
					? estimateTokens(JSON.stringify(toolRegistry) ?? "")
					: 0,
			},
		});
		if (modelHistoryResult.overBudget) {
			throw new Error(
				"The request exceeds the configured model context budget. Reduce the prompt or increase the request budget.",
			);
		}

		const chatMessages = modelHistoryResult.messages;

		const fullPayloadTokenEstimate = deps.plugin.settings
			.showFullRequestTokens
			? estimateTokens(JSON.stringify(chatMessages))
			: userTokenEstimate;

		// Update runtime with full payload estimate so UI shows correct starting count
		deps.patchRuntime(currentActiveId, {
			runningTokenTotal: fullPayloadTokenEstimate,
		});

		let fullText = "";
		const turnOutput = new ChatTurnOutput(stripThinkingTags);
		let contentParts: ContentPart[] = [];

		let assistantContent = fullText;
		let assistantTokenEstimate = 0;
		let providerUsage: import("../types").ProviderTokenUsage | undefined;
		let agentStepTelemetry: AgentStepTelemetry[] | undefined;

		try {
			if (isAgentProvider || (useTools && !slashCmd)) {
				const result = await runChatTurn({
					app: deps.plugin.app,
					profile: activeProfile,
					chatApi: deps.plugin.chatapi,
					toolExecutor,
					toolRegistry: resolvedToolRegistry,
					messages: chatMessages,
					signal: controller.signal,
					maxSteps: maxAgentSteps,
					autoApprove,
					maxRequestTokens:
						deps.plugin.settings.maxRequestTokens ?? 32000,
					sessionId: currentActiveId,
					maxContextMessages,
					preserveRecentMessages:
						deps.plugin.settings.preserveRecentMessages ?? 4,
					requestResponseReserveTokens:
						deps.plugin.settings.requestResponseReserveTokens ??
						4096,
					maxToolResultTokens:
						deps.plugin.settings.maxToolResultTokens ?? 4000,
					captureStepTelemetry:
						deps.plugin.settings.debugMode &&
						Boolean(
							deps.plugin.settings.debugTelemetry
								?.includeRequestBreakdown,
						),
					thinkingEnabled: deps.thinkingEnabled,
					onTextDelta: (text) => {
						fullText = text;
						turnOutput.setText(text);
						deps.patchRuntime(currentActiveId, {
							currentAiMessage: stripThinkingTags(text),
						});
					},
					onToolCall: (call) => {
						const parts = turnOutput.recordToolCall(call);
						deps.patchRuntime(currentActiveId, {
							currentContentParts: parts,
						});
					},
					requestApproval: async (call) => {
						const resolved = await new Promise<ToolResult | null>(
							(resolve) => {
								deps.patchRuntime(currentActiveId, {
									pendingToolCall: call,
									pendingToolDisplay: toToolDisplayDescriptor(
										resolvedToolRegistry.byId.get(
											call.toolName,
										),
									),
									resolveTool: resolve,
								});
							},
						);
						deps.patchRuntime(currentActiveId, {
							pendingToolCall: null,
							pendingToolDisplay: null,
							resolveTool: null,
						});
						if (resolved) {
							turnOutput.recordToolResult(call, resolved);
						}
						return resolved;
					},
					onToolResult: (call, result) => {
						const parts = turnOutput.recordToolResult(call, result);
						deps.patchRuntime(currentActiveId, {
							currentContentParts: parts,
						});
					},
					onTokenUpdate: (total) => {
						deps.patchRuntime(currentActiveId, {
							runningTokenTotal: fullPayloadTokenEstimate + total,
						});
					},
				});
				assistantContent = result.text;
				const sessionLinks = formatPastSessionLinks(
					turnOutput.snapshot().toolCalls,
					deps.sessionsRef.current,
				);
				if (sessionLinks) {
					assistantContent += sessionLinks;
					turnOutput.appendTextPart(sessionLinks);
				}
				assistantTokenEstimate = result.tokenEstimate;
				providerUsage = result.providerUsage;
				agentStepTelemetry = result.agentStepTelemetry;
			} else {
				// … standard streamChat path (no tools)
				let streamTokenTotal = userTokenEstimate;
				for await (const chunk of deps.plugin.chatapi.streamChat(
					chatMessages as any,
					controller.signal,
					activeProfile,
					deps.thinkingEnabled,
					(usage) => {
						providerUsage = usage;
					},
				)) {
					fullText += chunk;
					if (!slashCmd) {
						deps.patchRuntime(currentActiveId, {
							currentAiMessage: stripThinkingTags(fullText),
						});
					}
					// Update running token total incrementally for standard stream
					streamTokenTotal =
						fullPayloadTokenEstimate + estimateTokens(fullText);
					deps.patchRuntime(currentActiveId, {
						runningTokenTotal: streamTokenTotal,
					});
				}
				assistantContent = fullText;
				assistantTokenEstimate = estimateTokens(fullText);
				contentParts = [
					{
						type: "text",
						content: stripThinkingTags(fullText),
					},
				];
			}

			// Slash-command post-processing
			if (slashCmd?.command === "create" && fullText) {
				const fileName = slashCmd.target.endsWith(".md")
					? slashCmd.target
					: `${slashCmd.target}.md`;
				try {
					await deps.plugin.app.vault.create(fileName, fullText);
					new Notice(`✓ Created note: ${slashCmd.target}`);
					assistantContent = `✓ Created note: ${slashCmd.target}`;
				} catch (e: any) {
					new Notice(`⚠️ Could not create note: ${e.message}`);
					assistantContent = `⚠️ Could not create note: ${e.message}`;
				}
				assistantTokenEstimate = estimateTokens(assistantContent);
			} else if (slashCmd?.command === "edit" && fullText) {
				const success = await NoteEditingBridge.applyToTargetNote(
					deps.plugin.app,
					slashCmd.target,
					fullText,
					"Apply AI edit",
				);
				assistantContent = success
					? `✓ Applied edits to ${slashCmd.target}`
					: `⚠️ Could not apply edits to ${slashCmd.target}`;
				assistantTokenEstimate = estimateTokens(assistantContent);
			} else if (slashCmd?.command === "append" && fullText) {
				let file = deps.plugin.app.vault.getAbstractFileByPath(
					slashCmd.target,
				);
				if (!file || !(file instanceof TFile)) {
					const resolved =
						deps.plugin.app.metadataCache.getFirstLinkpathDest(
							slashCmd.target,
							"",
						);
					if (resolved && resolved instanceof TFile) {
						file = resolved;
					}
				}
				if (file && file instanceof TFile) {
					await NoteEditingBridge.appendToNote(
						deps.plugin.app,
						file,
						fullText,
					);
					assistantContent = `✓ Appended to ${slashCmd.target}`;
				} else {
					assistantContent = `⚠️ Note not found: ${slashCmd.target}`;
				}
				assistantTokenEstimate = estimateTokens(assistantContent);
			}

			// Finalize output collected by the tool-enabled turn coordinator.
			if (useTools && !slashCmd) {
				turnOutput.setText(fullText);
				turnOutput.finishToolText();
				contentParts = turnOutput.snapshot().contentParts;
			}
			const finalOutput =
				useTools && !slashCmd ? turnOutput.snapshot() : null;

			const cleanAssistantContent = stripThinkingTags(assistantContent);
			const assistantMsg: ChatMessage = {
				id: makeId(),
				role: "assistant",
				content: cleanAssistantContent,
				timestamp: Date.now(),
				command: commandMeta,
				estimatedTokens: assistantTokenEstimate,
				requestTokenEstimate: fullPayloadTokenEstimate,
				providerUsage,
				agentName: activeProfile.name,
				modelName: activeProfile.model,
				responseTimeMs: Date.now() - streamStartTime,
				toolCalls:
					finalOutput && finalOutput.toolCalls.length > 0
						? finalOutput.toolCalls
						: undefined,
				contentParts:
					finalOutput && finalOutput.contentParts.length > 0
						? finalOutput.contentParts
						: contentParts.length > 0
							? contentParts
							: undefined,
				agentStepTelemetry,
			};
			deps.plugin.logger?.log(
				"info",
				`[Chat] reply complete — session ${currentActiveId.slice(0, 8)}, ` +
					`model ${activeProfile.model}, ` +
					`~${assistantTokenEstimate} tokens, ` +
					`${assistantMsg.responseTimeMs ?? Date.now() - streamStartTime}ms`,
			);
			deps.setSessions((prev) =>
				prev.map((s) =>
					s.id === currentActiveId
						? {
								...s,
								messages: [...s.messages, assistantMsg],
								updatedAt: Date.now(),
								contextItems: sendContextItems,
							}
						: s,
				),
			);
		} catch (e: any) {
			// Preserve partial content for ALL interruptions (AbortError, TypeError, network errors, etc.)
			// The user should see what was received, not lose it.
			if (fullText) {
				let interruptedParts: ContentPart[] = [];
				if (useTools && !slashCmd) {
					turnOutput.setText(fullText);
					const output = turnOutput.snapshot();
					interruptedParts = [...output.contentParts];
					const remainingText = output.text
						? turnOutput.pendingText()
						: "";
					if (remainingText) {
						interruptedParts.push({
							type: "text",
							content: remainingText + " [interrupted]",
						});
					}
				} else {
					interruptedParts = [
						{
							type: "text",
							content:
								stripThinkingTags(fullText) + " [interrupted]",
						},
					];
				}
				const interruptedMsg: ChatMessage = {
					id: makeId(),
					role: "assistant",
					content: stripThinkingTags(fullText) + " [interrupted]",
					timestamp: Date.now(),
					command: commandMeta,
					estimatedTokens: estimateTokens(fullText),
					modelName: activeProfile.model,
					responseTimeMs: Date.now() - streamStartTime,
					contentParts: interruptedParts,
					isError: e.name !== "AbortError",
				};
				deps.plugin.logger?.log(
					"info",
					`[Chat] reply interrupted — session ${currentActiveId.slice(0, 8)} after ${Date.now() - streamStartTime}ms`,
				);
				deps.setSessions((prev) =>
					prev.map((s) =>
						s.id === currentActiveId
							? {
									...s,
									messages: [...s.messages, interruptedMsg],
									updatedAt: Date.now(),
									contextItems: sendContextItems,
								}
							: s,
					),
				);
			} else if (e.name !== "AbortError") {
				// No partial content received and it's a real error — show error message
				const errorMsg: ChatMessage = {
					id: makeId(),
					role: "assistant",
					content: `Error: ${e.message}`,
					timestamp: Date.now(),
					isError: true,
					command: commandMeta,
					estimatedTokens: estimateTokens(`Error: ${e.message}`),
				};
				deps.plugin.logger?.log(
					"error",
					`[Chat] turn error — session ${currentActiveId.slice(0, 8)}: ${e.message ?? String(e)}`,
				);
				deps.setSessions((prev) =>
					prev.map((s) =>
						s.id === currentActiveId
							? {
									...s,
									messages: [...s.messages, errorMsg],
									updatedAt: Date.now(),
									contextItems: sendContextItems,
								}
							: s,
					),
				);
			}
		} finally {
			deps.patchRuntime(currentActiveId, {
				isStreaming: false,
				currentAiMessage: "",
				currentContentParts: [],
				pendingToolCall: null,
				pendingToolDisplay: null,
				controller: null,
				resolveTool: null,
				runningTokenTotal: 0,
			});
			deps.ui.setIsEditing(false);
			deps.ui.setOriginalMessages([]);
			deps.ui.setEditMessageText("");
			deps.ui.setMessageAttachments([]);
			deps.setContextItems([]);
		}
	};

	// ─────────────────────────────────────────────────────
	// STOP
	// ─────────────────────────────────────────────────────
	stop = (): void => {
		this.actions.stop();
	};

	// ─────────────────────────────────────────────────────
	// RETRY
	// ─────────────────────────────────────────────────────
	retry = (messageId: string): void => {
		this.actions.retry(messageId);
	};

	// ─────────────────────────────────────────────────────
	// EDIT
	// ─────────────────────────────────────────────────────
	edit = (messageId: string): void => {
		this.actions.edit(messageId);
	};

	// ─────────────────────────────────────────────────────
	// CANCEL EDIT
	// ─────────────────────────────────────────────────────
	cancelEdit = (): void => {
		this.actions.cancelEdit();
	};

	// ─────────────────────────────────────────────────────
	// TOOL APPROVAL
	// ─────────────────────────────────────────────────────
	approveTool = async (): Promise<void> => {
		await this.actions.approveTool();
	};

	rejectTool = (): void => {
		this.actions.rejectTool();
	};
}

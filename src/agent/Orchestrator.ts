import { ChatApiManager } from "../api";
import {
	ChatMessage,
	GroupChatParticipant,
	ResolvedMessagePart,
	ProviderTokenUsage,
} from "../types";
import type { MessageContentPart } from "../api";
import { ProviderProfile } from "../settings";
import { parseMentions, ParsedMention } from "./MentionParser";
import type { ToolCall, ToolResult } from "./types";
import { AgentLoop } from "./AgentLoop";
import { ToolExecutor } from "./ToolExecutor";
import { estimateTokens } from "../context/tokenEstimator";
import { buildBudgetedHistory } from "../context/contextBudget";
import { describeToolsForPrompt } from "./toolRegistry";

export type DispatchMode = "sequential" | "parallel";
export type ContextStrategy = "full" | "isolated";
type ContextContent = string | MessageContentPart[];

export interface AgentResponse {
	agentId: string;
	agentName: string;
	agentColor: string;
	text: string;
	toolCalls?: Array<{ call: ToolCall; result?: ToolResult }>;
	tokenEstimate?: number;
	providerUsage?: ProviderTokenUsage;
	modelName?: string;
	error?: string;
}

export interface AgentEngine {
	id: string;
	name: string;
	color: string;
	profile: ProviderProfile;
}

export interface OrchestratorOptions {
	api: ChatApiManager;
	participants: GroupChatParticipant[];
	mode?: DispatchMode;
	contextStrategy?: ContextStrategy;
	enableTools?: boolean;
	autoApprove?: boolean;
	maxSteps?: number;
	/** Total model request budget, including response reserve. */
	maxRequestTokens?: number;
	/** Number of newest messages retained verbatim in group context. */
	preserveRecentMessages?: number;
	/** Maximum number of persisted context messages considered for a request. */
	maxContextMessages?: number;
	/** Tokens reserved for the response and agent tool-loop continuations. */
	requestResponseReserveTokens?: number;
	/** Maximum estimated tokens for a model-facing tool result. */
	maxToolResultTokens?: number;
	/** Tool executor for running Obsidian note tools. If provided with enableTools=true, agents will use tool calling. */
	toolExecutor?: ToolExecutor;
	/** IDs of remote users participating in this chat (relay user IDs) */
	remoteUsers?: string[];
}

/**
 * Coordinates multiple agent responses in a group chat.
 *
 * Usage:
 *   const orch = new Orchestrator({ api, participants });
 *   const responses = await orch.dispatch(userMessage, thread);
 */
export class Orchestrator {
	api: ChatApiManager;
	engines: AgentEngine[];
	mode: DispatchMode;
	contextStrategy: ContextStrategy;
	enableTools: boolean;
	autoApprove: boolean;
	maxSteps: number;
	maxRequestTokens: number;
	preserveRecentMessages: number;
	maxContextMessages: number;
	requestResponseReserveTokens: number;
	maxToolResultTokens: number;
	toolExecutor?: ToolExecutor;

	constructor(options: OrchestratorOptions) {
		this.api = options.api;
		this.engines = options.participants.map((p) => ({
			id: p.id,
			name: p.name,
			color: p.color,
			profile: this.resolveProfile(p.profileId),
		}));
		this.mode = options.mode ?? "sequential";
		this.contextStrategy = options.contextStrategy ?? "full";
		this.enableTools = options.enableTools ?? false;
		this.autoApprove = options.autoApprove ?? false;
		this.maxSteps = options.maxSteps ?? 5;
		this.maxRequestTokens = options.maxRequestTokens ?? 32000;
		this.preserveRecentMessages = options.preserveRecentMessages ?? 4;
		this.maxContextMessages = options.maxContextMessages ?? 10;
		this.requestResponseReserveTokens =
			options.requestResponseReserveTokens ?? 4096;
		this.maxToolResultTokens = options.maxToolResultTokens ?? 4000;
		this.toolExecutor = options.toolExecutor;
		this.remoteUsers = options.remoteUsers ?? [];
	}

	remoteUsers: string[] = [];

	setRemoteUsers(users: string[]) {
		this.remoteUsers = users;
	}

	private resolveProfile(profileId: string): ProviderProfile {
		// This will be wired to plugin.settings.providerProfiles
		// For now, return a minimal stub — the caller should override
		return {
			id: profileId,
			name: profileId,
			provider: "custom",
			model: "default",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
	}

	/**
	 * Parse user input and determine target agents.
	 * If no mentions: all agents respond.
	 * If mentions: only mentioned agents respond.
	 */
	parseAndRoute(
		text: string,
		attachments?: import("../types").Attachment[],
	): { targets: AgentEngine[]; cleanText: string } {
		const parsed = parseMentions(text);
		if (parsed.mentions.length > 0) {
			const targets = this.engines.filter(
				(e) =>
					parsed.mentions.includes(e.id) ||
					parsed.mentions.includes(e.name),
			);
			return {
				targets: targets.length > 0 ? targets : this.engines,
				cleanText: parsed.cleanText,
			};
		}
		return { targets: this.engines, cleanText: parsed.cleanText };
	}

	/**
	 * Run a multi-round debate where agents respond to each other.
	 * Round 1: all agents respond to user message.
	 * Round 2+: agents see all previous responses and can add follow-ups.
	 * Stops when maxRounds reached or no agent has anything to add.
	 */
	async *debate(
		text: string,
		thread: ChatMessage[],
		signal?: AbortSignal,
		resolvedParts: ResolvedMessagePart[] = [],
		maxRounds: number = 2,
	): AsyncGenerator<AgentResponse> {
		const { targets, cleanText } = this.parseAndRoute(text);
		const workingThread = [...thread];

		// Round 1: all agents respond to user
		const round1Responses: AgentResponse[] = [];
		for (const engine of targets) {
			const response = await this.sendToAgent(
				engine,
				workingThread,
				cleanText,
				signal,
				resolvedParts,
			);
			round1Responses.push(response);
			yield response;
			if (signal?.aborted) return;
		}

		// Add round 1 responses to thread context
		for (const r of round1Responses) {
			workingThread.push({
				id: `round1-${r.agentId}`,
				role: "assistant",
				content: r.text,
				timestamp: Date.now(),
				agentId: r.agentId,
				agentName: r.agentName,
				agentColor: r.agentColor,
				modelName: r.modelName,
			});
		}

		// Round 2+: agents can respond to each other
		for (let round = 2; round <= maxRounds; round++) {
			const roundResponses: AgentResponse[] = [];
			let anyResponse = false;

			for (const engine of targets) {
				// Ask agent if it wants to respond to the conversation
				const prompt = this.buildDebatePrompt(
					engine.name,
					round,
					round1Responses,
					cleanText,
				);
				const response = await this.sendToAgent(
					engine,
					workingThread,
					prompt,
					signal,
				);

				// Only include if agent actually wants to add something
				const trimmed = response.text.trim();
				if (trimmed && !this.isPass(trimmed)) {
					response.text = trimmed;
					roundResponses.push(response);
					yield response;
					anyResponse = true;
				}
				if (signal?.aborted) return;
			}

			if (!anyResponse) break; // No one had anything to say

			// Add round responses to thread
			for (const r of roundResponses) {
				workingThread.push({
					id: `round${round}-${r.agentId}`,
					role: "assistant",
					content: r.text,
					timestamp: Date.now(),
					agentId: r.agentId,
					agentName: r.agentName,
					agentColor: r.agentColor,
					modelName: r.modelName,
				});
			}
		}
	}

	private buildDebatePrompt(
		agentName: string,
		round: number,
		prevResponses: AgentResponse[],
		originalQuestion: string,
	): string {
		const otherResponses = prevResponses
			.filter((r) => r.agentName !== agentName)
			.map((r) => `${r.agentName}: ${r.text}`)
			.join("\n\n");

		return (
			`The user asked: "${originalQuestion}"` +
			`\n\nOther assistants shared these perspectives:` +
			`\n\n${otherResponses}` +
			`\n\n---` +
			`\n\nBased on your knowledge and perspective, what would you add? ` +
			`Do you agree, disagree, want to correct something, or offer a different angle? ` +
			`Be concise (2-3 sentences).` +
			`\n\nIf you're satisfied with what's been said and have nothing new to add, reply with exactly: PASS` +
			`\n\nYour response:`
		);
	}

	private isPass(text: string): boolean {
		return /^\s*PASS\s*$/i.test(text) || /^\s*pass\s*$/i.test(text);
	}
	buildContext(
		agentId: string,
		thread: ChatMessage[],
		cleanText: string,
		resolvedParts: ResolvedMessagePart[] = [],
	): Array<{
		role: "user" | "assistant" | "system";
		content: ContextContent;
	}> {
		const systemPrompt = this.buildSystemPrompt(agentId);
		const context: Array<{
			role: "user" | "assistant" | "system";
			content: ContextContent;
		}> = [{ role: "system", content: systemPrompt }];

		for (const msg of thread) {
			if (this.contextStrategy === "isolated") {
				// Isolated: agent only sees user messages + its own responses
				if (msg.role === "user" || msg.agentId === agentId) {
					const content = msg.resolvedParts?.length
						? [
								{ type: "text" as const, text: msg.content },
								...msg.resolvedParts,
							]
						: msg.content;
					context.push({
						role: msg.role === "user" ? "user" : "assistant",
						content,
					});
				}
			} else {
				// Full transparency: agent sees everything with attribution
				let content = msg.content;
				if (msg.role === "assistant" && msg.agentName) {
					content = `[${msg.agentName}]: ${msg.content}`;
				}
				// Attribute remote user messages
				if (
					msg.role === "user" &&
					msg.remote &&
					msg.fromUserId &&
					this.remoteUsers.includes(msg.fromUserId)
				) {
					content = `[Remote User ${msg.fromUserId}]: ${msg.content}`;
				}
				const multimodalContent = msg.resolvedParts?.length
					? [
							{ type: "text" as const, text: content },
							...msg.resolvedParts,
						]
					: content;
				context.push({
					role: msg.role === "user" ? "user" : "assistant",
					content: multimodalContent,
				});
			}
		}

		context.push({
			role: "user",
			content: resolvedParts.length
				? ([
						{ type: "text" as const, text: cleanText },
						...resolvedParts,
					] as MessageContentPart[])
				: cleanText,
		});
		return context;
	}

	/**
	 * Dispatch a user message to target agents.
	 * Returns responses as they arrive (streaming-compatible).
	 */
	async *dispatch(
		text: string,
		thread: ChatMessage[],
		signal?: AbortSignal,
		resolvedParts: ResolvedMessagePart[] = [],
	): AsyncGenerator<AgentResponse> {
		const { targets, cleanText } = this.parseAndRoute(text);
		const workingThread = [...thread];

		if (this.mode === "parallel") {
			// Launch all in parallel, yield as they complete
			const promises = targets.map(async (engine) => {
				const response = await this.sendToAgent(
					engine,
					workingThread,
					cleanText,
					signal,
					resolvedParts,
				);
				return response;
			});

			for (const promise of promises) {
				yield await promise;
			}
		} else {
			// Sequential: one at a time, each agent sees prior agents' responses
			for (const engine of targets) {
				const response = await this.sendToAgent(
					engine,
					workingThread,
					cleanText,
					signal,
					resolvedParts,
				);
				yield response;
				// Feed this response back so subsequent agents see it in context
				// Sanitize: strip any attribution prefixes the model may have echoed
				const sanitizedText = this.sanitizeAgentOutput(
					response.text,
					response.agentName,
				);
				workingThread.push({
					id: `dispatch-${response.agentId}-${Date.now()}`,
					role: "assistant",
					content: sanitizedText,
					timestamp: Date.now(),
					agentId: response.agentId,
					agentName: response.agentName,
					agentColor: response.agentColor,
					modelName: response.modelName,
				});
			}
		}
	}

	/**
	 * Send a message to a single agent and collect its response.
	 */
	private async sendToAgent(
		engine: AgentEngine,
		thread: ChatMessage[],
		cleanText: string,
		signal?: AbortSignal,
		resolvedParts: ResolvedMessagePart[] = [],
	): Promise<AgentResponse> {
		try {
			const contextMessages = this.buildContext(
				engine.id,
				thread,
				cleanText,
				resolvedParts,
			);
			const systemMessage = contextMessages[0];
			const currentMessage = contextMessages[contextMessages.length - 1];
			const budgetedHistory = buildBudgetedHistory({
				systemPrompt: systemMessage?.content,
				currentMessage: currentMessage?.content,
				history: contextMessages.slice(1, -1),
				options: {
					maxRequestTokens: this.maxRequestTokens,
					maxMessages: this.maxContextMessages,
					preserveRecentMessages: this.preserveRecentMessages,
					responseReserveTokens: this.requestResponseReserveTokens,
					additionalTokens: this.enableTools
						? estimateTokens(
								JSON.stringify(
									this.toolExecutor?.getModelTools(),
								) ?? "",
							)
						: 0,
				},
			});
			if (budgetedHistory.overBudget) {
				throw new Error(
					"The group request exceeds the configured model context budget. Reduce the prompt or increase the request budget.",
				);
			}
			const messages = [
				systemMessage,
				...budgetedHistory.history,
				currentMessage,
			];

			// Tool-enabled path: use AgentLoop (same as single-user chat)
			if (this.enableTools && this.toolExecutor) {
				let fullText = "";
				const toolCallsLog: Array<{
					call: ToolCall;
					result?: ToolResult;
				}> = [];

				const agent = new AgentLoop({
					chatApi: this.api,
					toolExecutor: this.toolExecutor,
					maxSteps: this.maxSteps,
					autoApprove: this.autoApprove,
					maxRequestTokens: this.maxRequestTokens,
					maxContextMessages: this.maxContextMessages,
					preserveRecentMessages: this.preserveRecentMessages,
					requestResponseReserveTokens:
						this.requestResponseReserveTokens,
					maxToolResultTokens: this.maxToolResultTokens,
					profile: engine.profile,
					onTextDelta: (text) => {
						fullText = text;
					},
					onToolCall: (call) => {
						toolCallsLog.push({ call });
					},
					requestApproval: async (call) => {
						// In group chat, auto-approve if enabled; otherwise reject with a note.
						// Manual approval UI for group chat is a future enhancement.
						if (this.autoApprove) {
							return await this.toolExecutor!.execute(call);
						}
						return {
							error: "Tool call rejected: manual approval is not supported in group chat. Enable auto-approve to use tools in council mode.",
						};
					},
					onToolResult: (call, result) => {
						const idx = toolCallsLog.findIndex(
							(tc) => tc.call.toolCallId === call.toolCallId,
						);
						if (idx >= 0) {
							toolCallsLog[idx] = {
								...toolCallsLog[idx],
								result,
							};
						}
					},
				});

				const result = await agent.run(
					messages,
					this.toolExecutor.getModelTools(),
					signal ?? new AbortController().signal,
				);

				return {
					agentId: engine.id,
					agentName: engine.name,
					agentColor: engine.color,
					text: this.sanitizeAgentOutput(
						result.text || fullText,
						engine.name,
					),
					toolCalls:
						toolCallsLog.length > 0 ? toolCallsLog : undefined,
					tokenEstimate: result.tokenEstimate,
					providerUsage: result.providerUsage,
					modelName: engine.profile.model,
				};
			}

			// Simple non-tooling path (original MVP behavior preserved)
			let fullText = "";
			let providerUsage: ProviderTokenUsage | undefined;
			const stream = this.api.streamChat(
				messages,
				undefined,
				engine.profile,
				undefined,
				(usage) => {
					providerUsage = usage;
				},
			);
			for await (const chunk of stream) {
				if (signal?.aborted) break;
				fullText += chunk;
			}

			return {
				agentId: engine.id,
				agentName: engine.name,
				agentColor: engine.color,
				text: this.sanitizeAgentOutput(fullText, engine.name),
				tokenEstimate: estimateTokens(fullText),
				providerUsage,
				modelName: engine.profile.model,
			};
		} catch (error: any) {
			return {
				agentId: engine.id,
				agentName: engine.name,
				agentColor: engine.color,
				text: "",
				error: error.message || "Unknown error",
				modelName: engine.profile.model,
			};
		}
	}

	/**
	 * Extract only this agent's own response from generated text.
	 * Models may echo context prefixes or generate responses for other agents.
	 * We strip all prefixes and truncate at the first sign of another agent's output.
	 */
	private sanitizeAgentOutput(text: string, agentName: string): string {
		let cleaned = text.trim();

		// Strip any leading attribution prefix (own or others)
		const anyPrefix = /^\[[^\]]+\]:\s*/;
		cleaned = cleaned.replace(anyPrefix, "");

		// Truncate at the first occurrence of another agent's prefix.
		// This prevents the model from "completing" the conversation for others.
		const otherAgentPrefix = /\n?\[[^\]]+\]:\s*/;
		const cutoff = cleaned.search(otherAgentPrefix);
		if (cutoff !== -1) {
			cleaned = cleaned.slice(0, cutoff).trim();
		}

		return cleaned;
	}

	private buildSystemPrompt(agentId: string): string {
		const engine = this.engines.find((e) => e.id === agentId);
		const name = engine?.name ?? "Assistant";
		let prompt =
			`You are ${name}, participating in a collaborative discussion with other AI assistants. ` +
			`You each bring different strengths and knowledge. ` +
			`You MUST offer your own independent view. Do not simply agree with or repeat what other assistants have said. ` +
			`Add new information, challenge weak points, or offer a different angle. ` +
			`When reviewing other assistants' perspectives, explicitly agree, disagree, add nuance, or correct errors. ` +
			`Speak only for yourself. NEVER speak for other agents or pretend to be them. ` +
			`Generate ONLY your own single response. Do NOT write responses for other agents. ` +
			`Address the user or specific agents by name when relevant. ` +
			`Be concise and helpful.` +
			`\n\nYou are integrated into an Obsidian note-taking app and can help with notes, research, and tasks.`;

		// Add [Participants] section with agents and remote users
		prompt += "\n\n[Participants]";
		if (this.engines.length > 0) {
			prompt += `\n- AI assistants: ${this.engines.map((e) => e.name).join(", ")}`;
		}
		if (this.remoteUsers.length > 0) {
			prompt += `\n- Remote users: ${this.remoteUsers.join(", ")}`;
		}
		prompt +=
			"\n\nMessages from other participants will be prefixed with their name. " +
			"Your own responses should NOT include your name prefix — the system adds it automatically. " +
			"Respond directly without quoting or repeating prior messages.";

		if (this.enableTools) {
			const definitions =
				this.toolExecutor?.getResolvedToolRegistry().definitions ?? [];
			prompt +=
				"\n\nYou have access to these currently available tools for managing Obsidian notes:" +
				(definitions.length > 0
					? `\n${describeToolsForPrompt(definitions)}`
					: "\n(No tools are currently available.)") +
				"\n\nWhen the user asks to find, list, or search for notes, ALWAYS use search_notes, list_notes, or search_note_content." +
				" When the user asks for a Dataview/DQL query, use query_dataview when it is available; it accepts DQL, not DataviewJS." +
				" For several search terms, prefer one search_note_content call with match_mode=and or any instead of separate searches." +
				" When the user asks whether you can search past sessions, chats, conversations, or what you discussed previously, say that you can search saved chat history and call search_past_sessions with the relevant keywords." +
				" Do not say you cannot search — you have the search_notes, list_notes, and search_note_content tools." +
				" When a bounded tool returns has_more=true, call the same tool again with its next_cursor only if the user needs more results; keep the original filters unchanged. For PDFs, request the returned next_page with start_page." +
				" Before editing a note you are unfamiliar with, use read_note to see its current content." +
				" When read_note returns a content_fingerprint, pass it as expected_content_fingerprint on a follow-up edit." +
				"\n\nImportant: When using edit_note, provide the COMPLETE new note content." +
				" Do not use diff syntax or markdown code blocks.";
		}

		return prompt;
	}
}

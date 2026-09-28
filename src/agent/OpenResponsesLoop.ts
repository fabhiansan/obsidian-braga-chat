// src/agent/OpenResponsesLoop.ts
// Turn-based conversation loop for OpenResponses agent communication

import { AgentApiManager } from "../api/AgentApiManager";
import type { OpenResponsesEvent } from "../api/OpenResponsesParser";
import type { ToolExecutor } from "./ToolExecutor";
import type { ToolCall, ToolResult } from "./types";
import { estimateTokens } from "../context/tokenEstimator";
import type { OpenResponsesTool } from "../api/AgentApiManager";
import { projectToolResultForModel } from "../context/toolResultProjection";

interface OpenResponsesLoopOptions {
	agentApi: AgentApiManager;
	toolExecutor: ToolExecutor;
	maxSteps: number;
	autoApprove: boolean;
	maxToolResultTokens?: number;
	/** Session identity used for exact references on bounded results. */
	sessionId?: string;
	/** Shared token allowance for all outputs in one continuation. */
	requestResponseReserveTokens?: number;
	onTextDelta?: (text: string) => void;
	onToolCall?: (call: ToolCall) => void;
	requestApproval?: (call: ToolCall) => Promise<ToolResult | null>;
	onToolResult?: (call: ToolCall, result: ToolResult) => void;
	onTokenUpdate?: (runningTotal: number) => void;
}

export class OpenResponsesLoop {
	private agentApi: AgentApiManager;
	private toolExecutor: ToolExecutor;
	private maxSteps: number;
	private autoApprove: boolean;
	private maxToolResultTokens: number;
	private sessionId?: string;
	private requestResponseReserveTokens: number;
	private onTextDelta?: (text: string) => void;
	private onToolCall?: (call: ToolCall) => void;
	private requestApproval?: (call: ToolCall) => Promise<ToolResult | null>;
	private onToolResult?: (call: ToolCall, result: ToolResult) => void;
	private onTokenUpdate?: (runningTotal: number) => void;

	private accumulatedText = "";
	private pendingFunctionCalls: Map<
		string,
		{ name: string; arguments: string }
	> = new Map();

	constructor(options: OpenResponsesLoopOptions) {
		this.agentApi = options.agentApi;
		this.toolExecutor = options.toolExecutor;
		this.maxSteps = options.maxSteps;
		this.autoApprove = options.autoApprove;
		this.maxToolResultTokens = options.maxToolResultTokens ?? 4000;
		this.sessionId = options.sessionId;
		this.requestResponseReserveTokens =
			options.requestResponseReserveTokens ?? 4096;
		this.onTextDelta = options.onTextDelta;
		this.onToolCall = options.onToolCall;
		this.requestApproval = options.requestApproval;
		this.onToolResult = options.onToolResult;
		this.onTokenUpdate = options.onTokenUpdate;
	}

	/**
	 * Run the agent loop.
	 *
	 * Flow:
	 * 1. Send user messages to agent
	 * 2. Stream response → collect text + function_call events
	 * 3. If function_call detected → execute tool → send result → continue
	 * 4. Repeat until no more function_calls or maxSteps reached
	 */
	public async run(
		messages: Array<{
			role: "user" | "assistant" | "system";
			content: string;
		}>,
		tools: OpenResponsesTool[],
		signal?: AbortSignal,
	): Promise<string> {
		let step = 0;
		let finalText = "";
		let lastResponseId = "";
		const stepTokenEstimates: number[] = [];

		// Convert messages to OpenResponses input format
		const input = messages.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		let runningTotal = 0;
		let totalAccumulatedText = ""; // Track text across all steps for UI

		const consumeStream = async (
			events: AsyncIterable<OpenResponsesEvent>,
		): Promise<void> => {
			// Reset per-response state, but keep totalAccumulatedText for the UI.
			this.accumulatedText = "";
			this.pendingFunctionCalls.clear();

			for await (const event of events) {
				if (signal?.aborted) break;

				switch (event.type) {
					case "text-delta":
						this.accumulatedText += event.delta;
						totalAccumulatedText += event.delta;
						this.onTextDelta?.(totalAccumulatedText);
						// Incremental token counting during streaming
						runningTotal += estimateTokens(event.delta);
						this.onTokenUpdate?.(runningTotal);
						break;

					case "function_call":
						// Collect partial function calls (arguments may be streamed)
						this.pendingFunctionCalls.set(event.call_id, {
							name: event.name,
							arguments: event.arguments,
						});
						break;

					case "function_call_done":
						// Complete function call — update with final arguments
						this.pendingFunctionCalls.set(event.call_id, {
							name: event.name,
							arguments: event.arguments,
						});
						break;

					case "finish":
						lastResponseId = event.response_id;
						break;

					case "error":
						throw new Error(event.message);
				}
			}

			finalText = this.accumulatedText;
		};

		// The original request must be sent exactly once. Every subsequent
		// response is obtained through a stateful function-call continuation.
		await consumeStream(
			this.agentApi.streamAgentResponse(
				{
					input,
					tools,
					stream: true,
				},
				signal,
			),
		);

		while (
			this.pendingFunctionCalls.size > 0 &&
			step < this.maxSteps &&
			!signal?.aborted
		) {
			step++;
			console.log(
				`[OpenResponsesLoop] Tool round ${step}/${this.maxSteps}`,
			);

			// Tool call detected — count args only (text already counted incrementally)
			const stepArgsTokens = Array.from(
				this.pendingFunctionCalls.values(),
			).reduce((sum, fc) => sum + estimateTokens(fc.arguments || ""), 0);
			runningTotal += stepArgsTokens;
			this.onTokenUpdate?.(runningTotal);

			// Execute pending function calls
			const rawFunctionCallOutputs: Array<{
				call_id: string;
				output: string;
				call: ToolCall;
				result: ToolResult;
			}> = [];

			for (const [call_id, fc] of this.pendingFunctionCalls) {
				if (signal?.aborted) break;
				let args: Record<string, unknown>;
				let argumentError: string | undefined;
				try {
					args = JSON.parse(fc.arguments || "{}");
					if (
						!args ||
						typeof args !== "object" ||
						Array.isArray(args)
					) {
						argumentError = "tool arguments must be a JSON object";
						args = {};
					}
				} catch {
					argumentError = "tool arguments are not valid JSON";
					args = {};
				}

				const toolCall: ToolCall = {
					toolCallId: call_id,
					toolName: fc.name,
					args,
				};

				this.onToolCall?.(toolCall);

				let result: ToolResult;

				if (argumentError) {
					result = { error: `Invalid arguments: ${argumentError}` };
				} else if (this.autoApprove) {
					result = await this.toolExecutor.execute(toolCall, signal);
				} else {
					const approved = await this.requestApproval?.(toolCall);
					if (signal?.aborted) break;
					if (approved) {
						result = approved;
					} else {
						result = {
							success: false,
							content: "Tool call rejected by user.",
							error: "Rejected",
						};
					}
				}

				// Format result for OpenResponses
				const output = JSON.stringify({
					success: result.success ?? !result.error,
					content: result.content,
					error: result.error,
					...result, // include all other fields
				});
				rawFunctionCallOutputs.push({
					call_id,
					output,
					call: toolCall,
					result,
				});
			}
			if (signal?.aborted) break;

			// The full results remain available through onToolResult and the
			// persisted transcript. Share the continuation allowance across all
			// outputs so parallel tool calls cannot multiply the configured budget.
			const sharedBudget =
				this.maxToolResultTokens > 0 &&
				this.requestResponseReserveTokens > 0
					? Math.min(
							this.maxToolResultTokens *
								rawFunctionCallOutputs.length,
							this.requestResponseReserveTokens,
						)
					: this.maxToolResultTokens;
			const perOutputBudget =
				rawFunctionCallOutputs.length > 0 && sharedBudget > 0
					? Math.max(
							1,
							Math.floor(
								sharedBudget / rawFunctionCallOutputs.length,
							),
						)
					: sharedBudget;
			const functionCallOutputs = rawFunctionCallOutputs.map((output) => {
				const projection = projectToolResultForModel({
					text: output.output,
					call: output.call,
					result: output.result,
					maxTokens: perOutputBudget,
					sessionId: this.sessionId,
				});
				const persistedResult = projection.reference
					? {
							...output.result,
							result_reference: projection.reference,
						}
					: output.result;
				this.onToolResult?.(output.call, persistedResult);
				return {
					call_id: output.call_id,
					output: projection.text,
				};
			});

			// Send tool results back to agent for continuation
			console.log(
				`[OpenResponsesLoop] Sending ${functionCallOutputs.length} tool results for step ${step + 1}`,
			);
			if (!lastResponseId) {
				throw new Error(
					"Cannot continue OpenResponses request without a response ID.",
				);
			}

			// Count tool results
			const stepResultTokens = functionCallOutputs.reduce(
				(sum, output) => sum + estimateTokens(output.output),
				0,
			);
			runningTotal += stepResultTokens;
			this.onTokenUpdate?.(runningTotal);

			// Continue streaming with tool results. consumeStream handles tool
			// calls here as well, allowing multi-round tool chains to remain on
			// the stateful continuation path.
			await consumeStream(
				this.agentApi.continueWithToolResult(
					lastResponseId,
					functionCallOutputs,
					tools,
					signal,
				),
			);
			// Text already counted incrementally during streaming; no need to re-count
			this.onTokenUpdate?.(runningTotal);

			// Track tokens for this step: args + tool results (text counted incrementally)
			stepTokenEstimates.push(stepArgsTokens + stepResultTokens);
		}

		if (this.pendingFunctionCalls.size > 0 && step >= this.maxSteps) {
			console.warn(
				`[OpenResponsesLoop] Max steps (${this.maxSteps}) reached`,
			);
		}

		const totalTokens =
			runningTotal > 0 ? runningTotal : estimateTokens(finalText);
		this.onTokenUpdate?.(totalTokens);

		return finalText;
	}
}

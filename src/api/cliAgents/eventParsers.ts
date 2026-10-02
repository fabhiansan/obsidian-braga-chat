/**
 * Turns the JSONL output of local coding-agent CLIs (Claude Code, Codex,
 * opencode) into AI SDK stream parts. Pure functions — no process handling —
 * so each format can be unit-tested with recorded output.
 *
 * The agents run their own tools. Their tool activity is shown as reasoning
 * text ("🔧 Edit notes/x.md") rather than as tool-call parts, so Chat Lab's
 * own tool loop never tries to execute them.
 */
import type {
	LanguageModelV4StreamPart,
	LanguageModelV4Usage,
} from "@ai-sdk/provider";

export type CliAgentKind = "claude-code" | "codex" | "opencode";

export interface CliEventParser {
	/** Parses one stdout line (one JSON event). */
	feed(line: string): void;
	/** Closes open blocks and emits the finish part. */
	finish(): void;
	/** True once the agent reported an error. */
	readonly failed: boolean;
}

type Emit = (part: LanguageModelV4StreamPart) => void;

interface TokenCounts {
	input?: number;
	cacheRead?: number;
	cacheWrite?: number;
	output?: number;
	reasoning?: number;
}

function toUsage(tokens: TokenCounts): LanguageModelV4Usage {
	const cacheRead = tokens.cacheRead ?? 0;
	const cacheWrite = tokens.cacheWrite ?? 0;
	const noCache = tokens.input;
	return {
		inputTokens: {
			total:
				noCache === undefined
					? undefined
					: noCache + cacheRead + cacheWrite,
			noCache,
			cacheRead: tokens.cacheRead,
			cacheWrite: tokens.cacheWrite,
		},
		outputTokens: {
			total: tokens.output,
			text:
				tokens.output === undefined
					? undefined
					: tokens.output - (tokens.reasoning ?? 0),
			reasoning: tokens.reasoning,
		},
	};
}

/**
 * Tracks open text/reasoning blocks so parsers can just call text() and
 * reasoning(). Separate agent messages are joined with a blank line.
 */
class BlockWriter {
	private open: { type: "text" | "reasoning"; id: string } | null = null;
	private counter = 0;
	private wroteText = false;
	private pendingBreak = false;
	failed = false;

	constructor(private readonly emit: Emit) {}

	/** Marks the start of a new agent message; the next text gets a separator. */
	newMessage(): void {
		if (this.wroteText) this.pendingBreak = true;
	}

	text(delta: string): void {
		if (!delta) return;
		this.ensure("text");
		if (this.pendingBreak) {
			delta = `\n\n${delta}`;
			this.pendingBreak = false;
		}
		this.emit({ type: "text-delta", id: this.open!.id, delta });
		this.wroteText = true;
	}

	reasoning(delta: string): void {
		if (!delta) return;
		this.ensure("reasoning");
		this.emit({ type: "reasoning-delta", id: this.open!.id, delta });
	}

	activity(line: string): void {
		this.reasoning(`${line}\n`);
	}

	error(message: string): void {
		this.failed = true;
		this.emit({ type: "error", error: new Error(message) });
	}

	finish(tokens: TokenCounts, raw: string | undefined): void {
		this.close();
		this.emit({
			type: "finish",
			usage: toUsage(tokens),
			finishReason: {
				unified: this.failed ? "error" : "stop",
				raw,
			},
		});
	}

	private ensure(type: "text" | "reasoning"): void {
		if (this.open?.type === type) return;
		this.close();
		const id = `${type}-${this.counter++}`;
		this.open = { type, id };
		this.emit({ type: `${type}-start`, id });
	}

	private close(): void {
		if (!this.open) return;
		this.emit({ type: `${this.open.type}-end`, id: this.open.id });
		this.open = null;
	}
}

function parseJson(line: string): any | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith("{")) return null;
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

/** Short description of a tool input, e.g. the file path or command. */
export function summarizeToolInput(input: unknown): string {
	if (!input || typeof input !== "object") return "";
	const record = input as Record<string, unknown>;
	for (const key of [
		"file_path",
		"filePath",
		"path",
		"command",
		"pattern",
		"query",
		"url",
		"description",
	]) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) {
			const oneLine = value.replace(/\s+/g, " ").trim();
			return oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine;
		}
	}
	return "";
}

function toolLine(name: string, input: unknown): string {
	const detail = summarizeToolInput(input);
	return detail ? `🔧 ${name} ${detail}` : `🔧 ${name}`;
}

/** `claude -p --output-format stream-json --verbose --include-partial-messages` */
function createClaudeCodeParser(emit: Emit): CliEventParser {
	const out = new BlockWriter(emit);
	let tokens: TokenCounts = {};
	let stopReason: string | undefined;

	return {
		get failed() {
			return out.failed;
		},
		feed(line) {
			const event = parseJson(line);
			if (!event || event.parent_tool_use_id) return;
			switch (event.type) {
				case "stream_event": {
					const e = event.event;
					if (
						e?.type === "content_block_start" &&
						e.content_block?.type === "text"
					) {
						out.newMessage();
					} else if (e?.type === "content_block_delta") {
						if (e.delta?.type === "text_delta") out.text(e.delta.text);
						else if (e.delta?.type === "thinking_delta")
							out.reasoning(e.delta.thinking);
					}
					break;
				}
				case "assistant":
					for (const block of event.message?.content ?? []) {
						if (block?.type === "tool_use")
							out.activity(toolLine(block.name, block.input));
					}
					break;
				case "result": {
					const u = event.usage ?? {};
					tokens = {
						input: u.input_tokens,
						cacheRead: u.cache_read_input_tokens,
						cacheWrite: u.cache_creation_input_tokens,
						output: u.output_tokens,
					};
					stopReason = event.stop_reason ?? event.subtype;
					if (event.is_error) {
						out.error(
							typeof event.result === "string" && event.result
								? event.result
								: `Claude Code failed (${event.subtype ?? "error"})`,
						);
					}
					break;
				}
			}
		},
		finish() {
			out.finish(tokens, stopReason);
		},
	};
}

/** `codex exec --json` */
function createCodexParser(emit: Emit): CliEventParser {
	const out = new BlockWriter(emit);
	let tokens: TokenCounts = {};

	return {
		get failed() {
			return out.failed;
		},
		feed(line) {
			const event = parseJson(line);
			if (!event) return;
			const item = event.item;
			switch (event.type) {
				case "item.started":
					if (item?.type === "command_execution")
						out.activity(`$ ${summarizeToolInput(item)}`);
					break;
				case "item.completed":
					switch (item?.type) {
						case "agent_message":
							out.newMessage();
							out.text(item.text ?? "");
							break;
						case "reasoning":
							out.reasoning(`${item.text ?? ""}\n`);
							break;
						case "file_change":
							for (const change of item.changes ?? [])
								out.activity(`✏️ ${change.kind ?? "edit"} ${change.path}`);
							break;
						case "mcp_tool_call":
							out.activity(`🔧 ${item.server}.${item.tool}`);
							break;
						case "web_search":
							out.activity(`🔎 ${item.query ?? ""}`);
							break;
					}
					break;
				case "turn.completed": {
					const u = event.usage ?? {};
					const cached = u.cached_input_tokens ?? 0;
					tokens = {
						input:
							u.input_tokens === undefined
								? undefined
								: u.input_tokens - cached,
						cacheRead: u.cached_input_tokens,
						output: u.output_tokens,
						reasoning: u.reasoning_output_tokens,
					};
					break;
				}
				case "turn.failed":
					out.error(event.error?.message ?? "Codex turn failed");
					break;
				case "error":
					out.error(event.message ?? "Codex error");
					break;
			}
		},
		finish() {
			out.finish(tokens, undefined);
		},
	};
}

/** `opencode run --format json` */
function createOpencodeParser(emit: Emit): CliEventParser {
	const out = new BlockWriter(emit);
	const seenParts = new Set<string>();
	const tokens: TokenCounts = {};
	const add = (key: keyof TokenCounts, value: unknown) => {
		if (typeof value === "number") tokens[key] = (tokens[key] ?? 0) + value;
	};

	return {
		get failed() {
			return out.failed;
		},
		feed(line) {
			const event = parseJson(line);
			if (!event) return;
			const part = event.part ?? {};
			if (part.id && event.type !== "step_finish") {
				if (seenParts.has(part.id)) return;
				seenParts.add(part.id);
			}
			switch (event.type) {
				case "text":
					out.newMessage();
					out.text(part.text ?? "");
					break;
				case "reasoning":
					out.reasoning(`${part.text ?? ""}\n`);
					break;
				case "tool_use":
					out.activity(toolLine(part.tool ?? "tool", part.state?.input));
					break;
				case "step_finish":
					add("input", part.tokens?.input);
					add("output", part.tokens?.output);
					add("cacheRead", part.tokens?.cache?.read);
					add("cacheWrite", part.tokens?.cache?.write);
					break;
				case "error": {
					const err = event.error ?? {};
					out.error(
						err.data?.message ?? err.message ?? err.name ?? "opencode error",
					);
					break;
				}
			}
		},
		finish() {
			out.finish(tokens, undefined);
		},
	};
}

export function createEventParser(
	kind: CliAgentKind,
	emit: Emit,
): CliEventParser {
	switch (kind) {
		case "claude-code":
			return createClaudeCodeParser(emit);
		case "codex":
			return createCodexParser(emit);
		case "opencode":
			return createOpencodeParser(emit);
	}
}

import { describe, expect, it } from "vitest";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { createEventParser, type CliAgentKind } from "./eventParsers";
import { buildCliArgs, renderPrompt } from "./CliAgentLanguageModel";

function run(kind: CliAgentKind, events: object[]) {
	const parts: LanguageModelV4StreamPart[] = [];
	const parser = createEventParser(kind, (p) => parts.push(p));
	for (const e of events) parser.feed(JSON.stringify(e));
	parser.feed("not json — ignored");
	parser.finish();
	const collect = (type: string) =>
		parts
			.filter((p) => p.type === type)
			.map((p) => (p as { delta: string }).delta)
			.join("");
	return {
		parts,
		text: collect("text-delta"),
		reasoning: collect("reasoning-delta"),
		finish: parts.find((p) => p.type === "finish") as Extract<
			LanguageModelV4StreamPart,
			{ type: "finish" }
		>,
		errors: parts.filter((p) => p.type === "error"),
	};
}

const delta = (text: string) => ({
	type: "stream_event",
	parent_tool_use_id: null,
	event: { type: "content_block_delta", delta: { type: "text_delta", text } },
});
const textStart = {
	type: "stream_event",
	parent_tool_use_id: null,
	event: { type: "content_block_start", content_block: { type: "text" } },
};

describe("Claude Code stream-json", () => {
	it("streams text, shows tool use as reasoning and reports usage", () => {
		const r = run("claude-code", [
			{ type: "system", subtype: "init", session_id: "s1" },
			textStart,
			delta("Saya baca "),
			delta("dulu."),
			{
				type: "assistant",
				parent_tool_use_id: null,
				message: {
					content: [
						{
							type: "tool_use",
							name: "Edit",
							input: { file_path: "wiki/a.md" },
						},
					],
				},
			},
			// Sub-agent output is skipped.
			{ ...delta("hidden"), parent_tool_use_id: "tool-1" },
			textStart,
			delta("Selesai."),
			{
				type: "result",
				subtype: "success",
				is_error: false,
				stop_reason: "end_turn",
				usage: {
					input_tokens: 10,
					cache_read_input_tokens: 100,
					cache_creation_input_tokens: 5,
					output_tokens: 7,
				},
			},
		]);
		expect(r.text).toBe("Saya baca dulu.\n\nSelesai.");
		expect(r.reasoning).toBe("🔧 Edit wiki/a.md\n");
		expect(r.finish.finishReason.unified).toBe("stop");
		expect(r.finish.usage.inputTokens.total).toBe(115);
		expect(r.finish.usage.outputTokens.total).toBe(7);
		// Every started block is ended.
		const starts = r.parts.filter((p) => p.type.endsWith("-start")).length;
		const ends = r.parts.filter((p) => p.type.endsWith("-end")).length;
		expect(starts).toBe(ends);
	});

	it("reports an error result", () => {
		const r = run("claude-code", [
			{ type: "result", subtype: "error", is_error: true, result: "Not logged in" },
		]);
		expect(r.errors).toHaveLength(1);
		expect(r.finish.finishReason.unified).toBe("error");
	});
});

describe("Codex exec --json", () => {
	it("joins agent messages and lists commands and file changes", () => {
		const r = run("codex", [
			{ type: "thread.started", thread_id: "t1" },
			{
				type: "item.completed",
				item: { type: "agent_message", text: "I'll read note.md." },
			},
			{
				type: "item.started",
				item: { type: "command_execution", command: "cat note.md" },
			},
			{
				type: "item.completed",
				item: {
					type: "file_change",
					changes: [{ path: "note.md", kind: "update" }],
				},
			},
			{ type: "item.completed", item: { type: "agent_message", text: "halo" } },
			{
				type: "turn.completed",
				usage: {
					input_tokens: 45,
					cached_input_tokens: 29,
					output_tokens: 13,
					reasoning_output_tokens: 8,
				},
			},
		]);
		expect(r.text).toBe("I'll read note.md.\n\nhalo");
		expect(r.reasoning).toBe("$ cat note.md\n✏️ update note.md\n");
		expect(r.finish.usage.inputTokens.total).toBe(45);
		expect(r.finish.usage.outputTokens.text).toBe(5);
	});

	it("reports a failed turn", () => {
		const r = run("codex", [
			{ type: "turn.failed", error: { message: "usage limit" } },
		]);
		expect(r.errors).toHaveLength(1);
	});
});

describe("opencode run --format json", () => {
	it("dedupes parts and sums step tokens", () => {
		const text = { type: "text", part: { id: "p2", type: "text", text: "halo" } };
		const r = run("opencode", [
			{ type: "step_start", part: { id: "s1" } },
			{
				type: "tool_use",
				part: { id: "p1", tool: "read", state: { input: { path: "note.md" } } },
			},
			{ type: "step_finish", part: { id: "f1", tokens: { input: 7, output: 2 } } },
			text,
			text,
			{ type: "step_finish", part: { id: "f2", tokens: { input: 3, output: 1 } } },
		]);
		expect(r.text).toBe("halo");
		expect(r.reasoning).toBe("🔧 read note.md\n");
		expect(r.finish.usage.inputTokens.noCache).toBe(10);
		expect(r.finish.usage.outputTokens.total).toBe(3);
	});
});

describe("CLI arguments and prompt", () => {
	it("passes the model only when it is not the default", () => {
		expect(buildCliArgs("claude-code", "default")).not.toContain("--model");
		expect(buildCliArgs("claude-code", "opus")).toEqual(
			expect.arrayContaining(["--model", "opus"]),
		);
		expect(buildCliArgs("codex", "gpt-5").slice(-3)).toEqual(["-m", "gpt-5", "-"]);
	});

	it("passes the thinking effort in each CLI's own form", () => {
		expect(buildCliArgs("claude-code", "opus", "max").slice(-2)).toEqual([
			"--effort",
			"max",
		]);
		expect(buildCliArgs("codex", "gpt-5", "high").slice(-3)).toEqual([
			"-c",
			'model_reasoning_effort="high"',
			"-",
		]);
		expect(
			buildCliArgs("opencode", "factory/deepseek-v4.1-flash", "low"),
		).toEqual(expect.arrayContaining(["-m", "factory/deepseek-v4.1-flash#low"]));
		expect(buildCliArgs("opencode", "default", "low")).not.toContain("-m");
	});

	it("renders system prompt and transcript", () => {
		const prompt = renderPrompt([
			{ role: "system", content: "Persona" },
			{ role: "user", content: [{ type: "text", text: "Halo" }] },
			{ role: "assistant", content: [{ type: "text", text: "Hai" }] },
			{ role: "user", content: [{ type: "text", text: "Ringkas note ini" }] },
		]);
		expect(prompt).toContain("<chat_app_context>\nPersona");
		expect(prompt).toContain(
			"[user]\nHalo\n\n[assistant]\nHai\n\n[user]\nRingkas note ini",
		);
	});
});

/**
 * AI SDK language model backed by a local coding-agent CLI (Claude Code,
 * Codex or opencode), so a profile can use the CLI's own login — a Claude
 * subscription, ChatGPT account or opencode account — instead of an API key.
 *
 * Each request starts a fresh CLI run in the vault folder with the whole chat
 * transcript as the prompt. The agent edits notes with its own tools. Desktop
 * only: it spawns a child process.
 */
import type {
	LanguageModelV4,
	LanguageModelV4CallOptions,
	LanguageModelV4Content,
	LanguageModelV4GenerateResult,
	LanguageModelV4Prompt,
	LanguageModelV4StreamPart,
	LanguageModelV4StreamResult,
	LanguageModelV4Usage,
} from "@ai-sdk/provider";
import type { ChildProcess } from "child_process";
import { createEventParser, type CliAgentKind } from "./eventParsers";

export type { CliAgentKind } from "./eventParsers";

export const CLI_AGENT_KINDS: readonly CliAgentKind[] = [
	"claude-code",
	"codex",
	"opencode",
];

export const isCliAgentProvider = (provider: string): provider is CliAgentKind =>
	(CLI_AGENT_KINDS as readonly string[]).includes(provider);

/** Model value meaning "don't pass a model flag; use the CLI's default". */
export const CLI_DEFAULT_MODEL = "default";

export const CLI_DEFAULT_BINARY: Record<CliAgentKind, string> = {
	"claude-code": "claude",
	codex: "codex",
	opencode: "opencode",
};

const CLI_LABEL: Record<CliAgentKind, string> = {
	"claude-code": "Claude Code",
	codex: "Codex",
	opencode: "opencode",
};

let workspaceDir: string | null = null;

/** Set once on plugin load: the vault folder the agents work in. */
export function setCliAgentWorkspace(dir: string | null): void {
	workspaceDir = dir;
}

// Obsidian started from the Dock gets a minimal PATH, without Homebrew, mise
// or ~/.local/bin. Ask the login shell once for the real one.
let shellPathPromise: Promise<string> | null = null;

function resolveShellPath(): Promise<string> {
	if (shellPathPromise) return shellPathPromise;
	shellPathPromise = new Promise((resolve) => {
		const fallback = [
			process.env.PATH,
			"/opt/homebrew/bin",
			"/usr/local/bin",
			`${process.env.HOME}/.local/bin`,
		]
			.filter(Boolean)
			.join(":");
		if (process.platform === "win32") return resolve(process.env.PATH ?? "");
		const { execFile } =
			require("child_process") as typeof import("child_process");
		execFile(
			process.env.SHELL || "/bin/zsh",
			["-ilc", 'printf "__PATH__%s__PATH__" "$PATH"'],
			{ timeout: 5000 },
			(_error, stdout) => {
				const match = /__PATH__(.*)__PATH__/.exec(String(stdout ?? ""));
				resolve(match?.[1] ? `${match[1]}:${fallback}` : fallback);
			},
		);
	});
	return shellPathPromise;
}

export function buildCliArgs(kind: CliAgentKind, model: string): string[] {
	const modelFlag =
		model && model !== CLI_DEFAULT_MODEL
			? [kind === "claude-code" ? "--model" : "-m", model]
			: [];
	switch (kind) {
		case "claude-code":
			// acceptEdits: file edits run without asking; shell commands are denied.
			return [
				"-p",
				"--output-format",
				"stream-json",
				"--verbose",
				"--include-partial-messages",
				"--permission-mode",
				"acceptEdits",
				...modelFlag,
			];
		case "codex":
			return [
				"exec",
				"--json",
				"--skip-git-repo-check",
				"--sandbox",
				"workspace-write",
				...modelFlag,
				"-",
			];
		case "opencode":
			// --standalone: the shared background service ignores our cwd and
			// would work in whatever folder it was first started from.
			return [
				"run",
				"--format",
				"json",
				"--auto",
				"--standalone",
				...modelFlag,
			];
	}
}

function partsToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (part?.type === "text") return part.text;
			if (part?.type === "file") return "[attachment omitted]";
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

/** Renders the chat (system prompt + history) as one prompt for the CLI. */
export function renderPrompt(prompt: LanguageModelV4Prompt): string {
	const system: string[] = [];
	const turns: string[] = [];
	for (const message of prompt) {
		if (message.role === "system") {
			system.push(message.content);
		} else if (message.role === "user" || message.role === "assistant") {
			const text = partsToText(message.content).trim();
			if (text) turns.push(`[${message.role}]\n${text}`);
		}
	}
	const sections: string[] = [];
	if (system.length > 0) {
		sections.push(
			`<chat_app_context>\n${system.join("\n\n")}\n</chat_app_context>`,
		);
	}
	sections.push(`<conversation>\n${turns.join("\n\n")}\n</conversation>`);
	sections.push(
		"You are answering inside an Obsidian chat panel. The current directory is " +
			"the Obsidian vault; use your own tools to read or edit notes when the " +
			"request needs it. Tools listed in chat_app_context belong to the chat " +
			"app and are not available to you. Reply to the last [user] message.",
	);
	return sections.join("\n\n");
}

export interface CliAgentModelConfig {
	kind: CliAgentKind;
	model: string;
	/** Executable name or absolute path; empty uses the default name. */
	binary?: string;
}

export class CliAgentLanguageModel implements LanguageModelV4 {
	readonly specificationVersion = "v4";
	readonly provider: string;
	readonly modelId: string;
	readonly supportedUrls = {};

	constructor(private readonly config: CliAgentModelConfig) {
		this.provider = `cli.${config.kind}`;
		this.modelId = config.model || CLI_DEFAULT_MODEL;
	}

	async doStream(
		options: LanguageModelV4CallOptions,
	): Promise<LanguageModelV4StreamResult> {
		const { kind } = this.config;
		const binary = this.config.binary?.trim() || CLI_DEFAULT_BINARY[kind];
		const args = buildCliArgs(kind, this.config.model);
		const input = renderPrompt(options.prompt);
		const PATH = await resolveShellPath();
		const { spawn } = require("child_process") as typeof import("child_process");

		let child: ChildProcess | null = null;
		const stream = new ReadableStream<LanguageModelV4StreamPart>({
			start: (controller) => {
				const emit = (part: LanguageModelV4StreamPart) =>
					controller.enqueue(part);
				const parser = createEventParser(kind, emit);
				emit({ type: "stream-start", warnings: [] });

				const abort = () => child?.kill("SIGTERM");
				if (options.abortSignal?.aborted) {
					controller.close();
					return;
				}
				options.abortSignal?.addEventListener("abort", abort, {
					once: true,
				});

				const cwd = workspaceDir ?? undefined;
				child = spawn(binary, args, {
					cwd,
					// opencode resolves its project from $PWD, not the process cwd.
					env: { ...process.env, PATH, ...(cwd ? { PWD: cwd } : {}) },
					stdio: ["pipe", "pipe", "pipe"],
				});

				let stdoutBuffer = "";
				let stderrTail = "";
				child.stdout!.setEncoding("utf8");
				child.stdout!.on("data", (chunk: string) => {
					stdoutBuffer += chunk;
					const lines = stdoutBuffer.split("\n");
					stdoutBuffer = lines.pop() ?? "";
					for (const line of lines) parser.feed(line);
				});
				child.stderr!.setEncoding("utf8");
				child.stderr!.on("data", (chunk: string) => {
					stderrTail = (stderrTail + chunk).slice(-2000);
				});

				let settled = false;
				const settle = (error?: string) => {
					if (settled) return;
					settled = true;
					options.abortSignal?.removeEventListener("abort", abort);
					if (stdoutBuffer) parser.feed(stdoutBuffer);
					if (error && !parser.failed && !options.abortSignal?.aborted) {
						emit({ type: "error", error: new Error(error) });
					}
					parser.finish();
					controller.close();
				};

				child.on("error", (err: NodeJS.ErrnoException) => {
					settle(
						err.code === "ENOENT"
							? `${CLI_LABEL[kind]} CLI not found ("${binary}"). Install it or set the full path in the profile's CLI path field.`
							: err.message,
					);
				});
				child.on("close", (code) => {
					settle(
						code === 0 || code === null
							? undefined
							: `${CLI_LABEL[kind]} exited with code ${code}${stderrTail ? `: ${stderrTail.trim()}` : ""}`,
					);
				});

				child.stdin!.on("error", () => {
					// The process may exit before reading stdin; "close" reports it.
				});
				child.stdin!.end(input);
			},
			cancel: () => {
				child?.kill("SIGTERM");
			},
		});

		return { stream, request: { body: { binary, args } } };
	}

	async doGenerate(
		options: LanguageModelV4CallOptions,
	): Promise<LanguageModelV4GenerateResult> {
		const { stream } = await this.doStream(options);
		let text = "";
		let reasoning = "";
		let usage: LanguageModelV4Usage | undefined;
		let finishReason: LanguageModelV4GenerateResult["finishReason"] = {
			unified: "other",
			raw: undefined,
		};
		const reader = stream.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value.type === "text-delta") text += value.delta;
			else if (value.type === "reasoning-delta") reasoning += value.delta;
			else if (value.type === "error") throw value.error;
			else if (value.type === "finish") {
				usage = value.usage;
				finishReason = value.finishReason;
			}
		}
		const content: LanguageModelV4Content[] = [];
		if (reasoning) content.push({ type: "reasoning", text: reasoning });
		if (text) content.push({ type: "text", text });
		return {
			content,
			finishReason,
			usage: usage ?? {
				inputTokens: {
					total: undefined,
					noCache: undefined,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: {
					total: undefined,
					text: undefined,
					reasoning: undefined,
				},
			},
			warnings: [],
		};
	}
}

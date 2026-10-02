/**
 * Display names and supported thinking-effort levels for CLI agent models,
 * read from each CLI's own local files. Nothing here is required: when a file
 * is missing the picker shows raw model ids and no effort choices.
 */
import type { CliAgentKind } from "./eventParsers";

export interface CliModelInfo {
	label?: string;
	/** Effort levels the CLI accepts for this model, in display order. */
	efforts: string[];
}

export type CliModelInfoMap = Record<string, CliModelInfo>;

const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];

export const CLAUDE_MODEL_INFO: CliModelInfoMap = {
	default: { label: "Default", efforts: CLAUDE_EFFORTS },
	sonnet: { label: "Sonnet", efforts: CLAUDE_EFFORTS },
	opus: { label: "Opus", efforts: CLAUDE_EFFORTS },
	haiku: { label: "Haiku", efforts: CLAUDE_EFFORTS },
};

/** Codex: `$CODEX_HOME/models_cache.json` plus the default model from config.toml. */
export function parseCodexModelInfo(
	cache: any,
	configToml = "",
): CliModelInfoMap {
	const info: CliModelInfoMap = {};
	for (const m of cache?.models ?? []) {
		if (!m?.slug) continue;
		info[m.slug] = {
			label: m.display_name || undefined,
			efforts: (m.supported_reasoning_levels ?? [])
				.map((level: any) => level?.effort)
				.filter((e: unknown): e is string => typeof e === "string"),
		};
	}
	const configured = /^\s*model\s*=\s*"([^"]+)"/m.exec(configToml)?.[1];
	info.default = {
		label: configured
			? `Default (${info[configured]?.label ?? configured})`
			: "Default",
		efforts: configured ? (info[configured]?.efforts ?? []) : [],
	};
	return info;
}

/**
 * opencode: the models.dev catalog cache (`~/.cache/opencode/models.json`),
 * overridden by providers defined in opencode config files. Keys are
 * "provider/model", as `opencode models` prints them.
 */
export function parseOpencodeModelInfo(
	catalog: any,
	configs: any[],
): CliModelInfoMap {
	const info: CliModelInfoMap = { default: { label: "Default", efforts: [] } };
	for (const [providerId, provider] of Object.entries<any>(catalog ?? {})) {
		for (const [modelId, model] of Object.entries<any>(
			provider?.models ?? {},
		)) {
			const effort = (model?.reasoning_options ?? []).find(
				(o: any) => o?.type === "effort",
			);
			info[`${providerId}/${modelId}`] = {
				label: model?.name || undefined,
				efforts: Array.isArray(effort?.values) ? effort.values : [],
			};
		}
	}
	for (const config of configs) {
		for (const [providerId, provider] of Object.entries<any>(
			config?.provider ?? {},
		)) {
			for (const [modelId, model] of Object.entries<any>(
				provider?.models ?? {},
			)) {
				const key = `${providerId}/${modelId}`;
				const variants = model?.variants
					? Object.entries<any>(model.variants)
							.filter(([, v]) => !v?.disabled)
							.map(([name]) => name)
					: undefined;
				info[key] = {
					label: model?.name || info[key]?.label,
					efforts: variants ?? info[key]?.efforts ?? [],
				};
			}
		}
	}
	return info;
}

/** Strips // and /* *\/ comments and trailing commas so JSONC parses. */
export function parseJsonc(text: string): any {
	const noComments = text.replace(
		/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
		(_m, str) => str ?? "",
	);
	return JSON.parse(noComments.replace(/,(\s*[}\]])/g, "$1"));
}

const cache = new Map<CliAgentKind, CliModelInfoMap>();

export function getCachedCliModelInfo(
	kind: CliAgentKind,
): CliModelInfoMap | undefined {
	return cache.get(kind);
}

/** Reads (and caches) model info; `refresh` re-reads the files. */
export async function loadCliModelInfo(
	kind: CliAgentKind,
	workspace: string | null,
	refresh = false,
): Promise<CliModelInfoMap> {
	const cached = cache.get(kind);
	if (cached && !refresh) return cached;
	let info: CliModelInfoMap = {};
	try {
		info = await readModelInfo(kind, workspace);
	} catch (error) {
		console.warn(`[braga-chat] Could not read ${kind} model info`, error);
	}
	cache.set(kind, info);
	return info;
}

async function readModelInfo(
	kind: CliAgentKind,
	workspace: string | null,
): Promise<CliModelInfoMap> {
	if (kind === "claude-code") return CLAUDE_MODEL_INFO;
	const { readFile } = require("fs/promises") as typeof import("fs/promises");
	const read = (path: string) => readFile(path, "utf8").catch(() => null);
	const home = process.env.HOME ?? "";
	if (kind === "codex") {
		const dir = process.env.CODEX_HOME || `${home}/.codex`;
		const cacheText = await read(`${dir}/models_cache.json`);
		return parseCodexModelInfo(
			cacheText ? JSON.parse(cacheText) : {},
			(await read(`${dir}/config.toml`)) ?? "",
		);
	}
	const cacheDir = process.env.XDG_CACHE_HOME || `${home}/.cache`;
	const configDir = process.env.XDG_CONFIG_HOME || `${home}/.config`;
	const catalogText = await read(`${cacheDir}/opencode/models.json`);
	const configPaths = [
		`${configDir}/opencode/opencode.json`,
		`${configDir}/opencode/opencode.jsonc`,
		...(workspace
			? [`${workspace}/opencode.json`, `${workspace}/opencode.jsonc`]
			: []),
	];
	const configs: any[] = [];
	for (const path of configPaths) {
		const text = await read(path);
		if (!text) continue;
		try {
			configs.push(parseJsonc(text));
		} catch {
			// A config opencode itself can't parse is not ours to report.
		}
	}
	return parseOpencodeModelInfo(
		catalogText ? JSON.parse(catalogText) : {},
		configs,
	);
}

/** The effort to pass for this model, or undefined when it isn't supported. */
export function supportedEffort(
	info: CliModelInfoMap | undefined,
	model: string,
	effort: string | undefined,
): string | undefined {
	if (!effort) return undefined;
	return info?.[model]?.efforts.includes(effort) ? effort : undefined;
}

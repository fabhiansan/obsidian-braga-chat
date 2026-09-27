import type { App } from "obsidian";
import type { ToolResult } from "../../types";
import {
	ToolHandlerBase,
	type ToolHandlerContext,
} from "../ToolHandlerContext";

const DEFAULT_MAX_OUTPUT_CHARS = 8000;
const MAX_OUTPUT_CHARS = 12000;

interface DataviewQueryResult {
	successful?: boolean;
	value?: string;
	error?: unknown;
}

interface DataviewApi {
	tryQueryMarkdown?: (source: string) => Promise<string>;
	queryMarkdown?: (source: string) => Promise<string | DataviewQueryResult>;
}

interface DataviewPlugin {
	api?: DataviewApi;
}

/** Access Dataview's optional public plugin API without a hard dependency. */
function getDataviewApi(app: App): DataviewApi | undefined {
	const plugins = (
		app as unknown as {
			plugins?: { plugins?: Record<string, DataviewPlugin | undefined> };
		}
	).plugins;
	return plugins?.plugins?.dataview?.api;
}

export function hasDataviewQueryApi(app: App): boolean {
	const api = getDataviewApi(app);
	return (
		typeof api?.tryQueryMarkdown === "function" ||
		typeof api?.queryMarkdown === "function"
	);
}

/** Read-only DQL queries against the optional Dataview index. */
export class DataviewHandlers extends ToolHandlerBase {
	constructor(context: ToolHandlerContext) {
		super(context);
	}

	async queryDataview(args: {
		query: string;
		max_output_chars?: number;
	}): Promise<ToolResult> {
		const query = args.query.trim();
		if (!query) return { error: "A Dataview query is required." };
		if (query.length > 5000) {
			return {
				error: "Dataview queries are limited to 5000 characters.",
			};
		}

		const api = getDataviewApi(this.app);
		if (!api) {
			return {
				error: "Dataview is unavailable. Enable the Dataview plugin and try again.",
			};
		}

		const maxOutputChars = Math.min(
			Math.max(args.max_output_chars ?? DEFAULT_MAX_OUTPUT_CHARS, 1000),
			MAX_OUTPUT_CHARS,
		);

		try {
			const markdown = await this.runQuery(api, query);
			const truncated = markdown.length > maxOutputChars;
			const truncationNote = "\n\n[Dataview output truncated.]";
			const content = truncated
				? `${markdown.slice(0, maxOutputChars - truncationNote.length).trimEnd()}${truncationNote}`
				: markdown.trim() || "(No results.)";
			return { success: true, query, content, truncated };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			return { error: `Dataview query failed: ${message}` };
		}
	}

	private async runQuery(api: DataviewApi, query: string): Promise<string> {
		if (api.tryQueryMarkdown) {
			return await api.tryQueryMarkdown.call(api, query);
		}

		if (!api.queryMarkdown) {
			throw new Error("The Dataview query API is unavailable.");
		}
		const result = await api.queryMarkdown.call(api, query);
		if (typeof result === "string") return result;
		if (result.successful && typeof result.value === "string") {
			return result.value;
		}
		throw new Error(String(result.error ?? "Invalid DQL query."));
	}
}

import Ajv, { type ValidateFunction } from "ajv";
import { jsonSchema, tool } from "ai";
import type { ToolCall, ToolResult } from "./types";
import { noteTools } from "./tools";
import type {
	ProviderCapability,
	ProviderAvailability,
	ProviderRisk,
} from "../integrations/types";

/** Host-owned risk classes. Provider risk is normalized into this vocabulary. */
export type HostToolRisk =
	| "read"
	| "local-create"
	| "local-write"
	| "remote-read"
	| "remote-write"
	| "destructive";

export type ToolAvailability = "available" | "disabled" | "misconfigured";

/** Small, safe description used by prompts and the approval card. */
export type ToolPresentation =
	| "note-read"
	| "text-overwrite"
	| "text-append"
	| "text-create"
	| "batch-create"
	| "patch"
	| "section"
	| "search"
	| "folder-create"
	| "move"
	| "delete"
	| "folders"
	| "generic";

export interface ToolDisplayDescriptor {
	id: string;
	title: string;
	risk: HostToolRisk;
	source: ToolDefinition["source"];
	providerId?: string;
	providerName?: string;
	presentation?: ToolPresentation;
}

export interface ToolResolutionContext {
	enableMemoryAuditTool?: boolean;
	developerMode?: boolean;
	dataviewAvailable?: boolean;
}

export interface ToolDefinition {
	id: string;
	version: 1;
	title: string;
	description: string;
	inputSchema: unknown;
	/** The AI SDK projection used by the native model client. */
	modelTool: Record<string, unknown>;
	risk: HostToolRisk;
	source: "builtin" | "provider";
	providerId?: string;
	providerName?: string;
	presentation?: ToolPresentation;
	availability?: (context: ToolResolutionContext) => ToolAvailability;
	/** The capability handler for this definition, when the tool is enabled. */
	execute?: (
		call: ToolCall,
		context: ToolResolutionContext,
	) => Promise<ToolResult>;
}

export type ToolArgumentValidation =
	| { ok: true; args: Record<string, unknown> }
	| { ok: false; error: string };

export interface ResolvedToolRegistry {
	definitions: ToolDefinition[];
	tools: Record<string, Record<string, unknown>>;
	byId: ReadonlyMap<string, ToolDefinition>;
}

/**
 * Return the short, human-readable tool list used in the system prompt.
 * Keeping this next to the definitions prevents the prompt from drifting
 * away from the tools that are actually available for this request.
 */
export function describeToolsForPrompt(
	definitions: ReadonlyArray<Pick<ToolDefinition, "id" | "description">>,
): string {
	return definitions
		.map(({ id, description }) => `- ${id}: ${description}`)
		.join("\n");
}

const BUILTIN_RISKS: Record<string, HostToolRisk> = {
	read_note: "read",
	edit_note: "local-write",
	append_to_note: "local-write",
	create_note: "local-create",
	create_notes: "local-create",
	patch_note: "local-write",
	edit_section: "local-write",
	search_notes: "read",
	search_note_content: "read",
	list_notes: "read",
	count_notes: "read",
	get_note_metadata: "read",
	create_folder: "local-create",
	move_note: "local-write",
	delete_note: "destructive",
	list_folders: "read",
	check_paths: "read",
	search_web: "remote-read",
	read_pdf: "remote-read",
	create_memory: "local-create",
	update_memory: "local-write",
	delete_memory: "destructive",
	list_memories: "read",
	search_memories: "read",
	read_memory_audit: "read",
	evaluate_staged: "local-write",
	cull_core: "local-write",
	search_past_sessions: "read",
	read_tool_result: "read",
	query_dataview: "read",
	update_setting: "local-write",
};

function titleForTool(id: string): string {
	return id
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function presentationForTool(id: string): ToolPresentation {
	const presentations: Record<string, ToolPresentation> = {
		read_note: "note-read",
		edit_note: "text-overwrite",
		append_to_note: "text-append",
		create_note: "text-create",
		create_notes: "batch-create",
		patch_note: "patch",
		edit_section: "section",
		search_notes: "search",
		search_note_content: "search",
		create_folder: "folder-create",
		move_note: "move",
		delete_note: "delete",
		list_folders: "folders",
	};
	return presentations[id] ?? "generic";
}

export function toToolDisplayDescriptor(
	definition: ToolDefinition | undefined,
): ToolDisplayDescriptor | null {
	if (!definition) return null;
	return {
		id: definition.id,
		title: definition.title,
		risk: definition.risk,
		source: definition.source,
		providerId: definition.providerId,
		providerName: definition.providerName,
		presentation: definition.presentation ?? "generic",
	};
}

function memoryAuditAvailability(
	context: ToolResolutionContext,
): ToolAvailability {
	return context.enableMemoryAuditTool ? "available" : "disabled";
}

function updateSettingAvailability(
	context: ToolResolutionContext,
): ToolAvailability {
	return context.developerMode ? "available" : "disabled";
}

function dataviewAvailability(
	context: ToolResolutionContext,
): ToolAvailability {
	return context.dataviewAvailable ? "available" : "disabled";
}

function formatValidationIssue(issue: unknown): string {
	if (!issue || typeof issue !== "object") return "invalid arguments";
	const item = issue as { path?: unknown; message?: unknown };
	const path =
		Array.isArray(item.path) && item.path.length > 0
			? `${item.path.join(".")}: `
			: "";
	return `${path}${typeof item.message === "string" ? item.message : "invalid value"}`;
}

type JsonSchemaRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonSchemaRecord {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateJsonObjectSchema(
	schema: JsonSchemaRecord,
	args: Record<string, unknown>,
): ToolArgumentValidation {
	try {
		let validate = jsonSchemaValidators.get(schema);
		if (!validate) {
			validate = jsonSchemaAjv.compile(schema);
			jsonSchemaValidators.set(schema, validate);
		}
		if (validate(args)) return { ok: true, args };
		const issue = validate.errors?.[0];
		const path = issue?.instancePath || "$args";
		return {
			ok: false,
			error: `${path}: ${issue?.message ?? "invalid arguments"}`,
		};
	} catch {
		return { ok: false, error: "tool schema cannot be validated locally" };
	}
}

const jsonSchemaAjv = new Ajv({ allErrors: false, strict: false });
const jsonSchemaValidators = new WeakMap<object, ValidateFunction>();

function rawJsonObjectSchema(
	inputSchema: unknown,
): JsonSchemaRecord | undefined {
	if (!isRecord(inputSchema)) return undefined;
	if (isRecord(inputSchema.jsonSchema)) return inputSchema.jsonSchema;
	if (
		inputSchema.type === "object" ||
		isRecord(inputSchema.properties) ||
		Array.isArray(inputSchema.required)
	) {
		return inputSchema;
	}
	return undefined;
}

/**
 * Validate model-supplied arguments before any built-in or provider code runs.
 * Built-in schemas are Zod schemas; provider schemas may be Standard Schema,
 * AI SDK JSON Schema wrappers, or ordinary JSON Schema objects.
 */
export async function validateToolArguments(
	definition: ToolDefinition,
	args: unknown,
): Promise<ToolArgumentValidation> {
	if (!args || typeof args !== "object" || Array.isArray(args)) {
		return { ok: false, error: "tool arguments must be an object" };
	}

	const objectArgs = args as Record<string, unknown>;
	const schema = definition.inputSchema as {
		safeParse?: (value: unknown) => {
			success: boolean;
			data?: unknown;
			error?: { issues?: unknown[] };
		};
		jsonSchema?: unknown;
		["~standard"]?: {
			version?: number;
			validate?: (
				value: unknown,
			) =>
				| { value: unknown }
				| { issues: unknown[] }
				| Promise<{ value: unknown } | { issues: unknown[] }>;
		};
	};

	if (typeof schema?.safeParse === "function") {
		const parsed = schema.safeParse(objectArgs);
		if (!parsed.success) {
			const issues = parsed.error?.issues ?? [];
			return {
				ok: false,
				error:
					issues.length > 0
						? issues.map(formatValidationIssue).join("; ")
						: "invalid arguments",
			};
		}
		if (
			!parsed.data ||
			typeof parsed.data !== "object" ||
			Array.isArray(parsed.data)
		) {
			return { ok: false, error: "tool arguments must be an object" };
		}
		return { ok: true, args: parsed.data as Record<string, unknown> };
	}

	const standard = schema?.["~standard"] as
		| {
				version?: number;
				validate?: (
					value: unknown,
				) =>
					| { value: unknown }
					| { issues: unknown[] }
					| Promise<{ value: unknown } | { issues: unknown[] }>;
		  }
		| undefined;
	if (typeof standard?.validate === "function") {
		const result = await standard.validate(objectArgs);
		if ("issues" in result) {
			return {
				ok: false,
				error:
					result.issues.length > 0
						? result.issues.map(formatValidationIssue).join("; ")
						: "invalid arguments",
			};
		}
		if (
			!result.value ||
			typeof result.value !== "object" ||
			Array.isArray(result.value)
		) {
			return { ok: false, error: "tool arguments must be an object" };
		}
		return { ok: true, args: result.value as Record<string, unknown> };
	}

	const jsonSchema = rawJsonObjectSchema(schema);
	if (jsonSchema) return validateJsonObjectSchema(jsonSchema, objectArgs);

	return {
		ok: false,
		error: "tool schema cannot be validated locally",
	};
}

function assertObjectLikeInputSchema(
	toolId: string,
	inputSchema: unknown,
): void {
	if (!inputSchema || typeof inputSchema !== "object") {
		throw new Error(
			`Tool ${toolId} must declare an object-like input schema.`,
		);
	}
	const schema = inputSchema as {
		safeParse?: unknown;
		jsonSchema?: unknown;
		["~standard"]?: { validate?: unknown };
		_def?: { typeName?: unknown; type?: unknown };
	};
	if (rawJsonObjectSchema(inputSchema)) return;
	if (typeof schema.safeParse === "function") {
		const typeName = schema._def?.typeName ?? schema._def?.type;
		if (
			typeName !== undefined &&
			typeName !== "ZodObject" &&
			typeName !== "object"
		) {
			throw new Error(
				`Tool ${toolId} must declare an object-like input schema.`,
			);
		}
		return;
	}
	if (schema.jsonSchema && typeof schema.jsonSchema === "object") return;
	if (typeof schema["~standard"]?.validate === "function") return;
	throw new Error(
		`Tool ${toolId} must declare a locally inspectable input schema.`,
	);
}

/** Build canonical descriptors over the existing built-in AI SDK tools. */
export function createBuiltInToolDefinitions(
	tools: Record<string, Record<string, unknown>> = noteTools,
): ToolDefinition[] {
	return Object.entries(tools).map(([id, modelTool]) => {
		const description = String(modelTool.description ?? "");
		const inputSchema = modelTool.inputSchema;
		if (!description || inputSchema === undefined) {
			throw new Error(
				`Built-in tool ${id} is missing its model contract.`,
			);
		}
		assertObjectLikeInputSchema(id, inputSchema);
		return {
			id,
			version: 1,
			title: titleForTool(id),
			description,
			inputSchema,
			modelTool,
			risk: BUILTIN_RISKS[id] ?? "read",
			source: "builtin",
			presentation: presentationForTool(id),
			availability:
				id === "read_memory_audit"
					? memoryAuditAvailability
					: id === "update_setting"
						? updateSettingAvailability
						: id === "query_dataview"
							? dataviewAvailability
							: () => "available",
		};
	});
}

/**
 * Create built-in definitions with execute handlers bound.
 *
 * The host supplies the capability handlers. Keeping the definitions and the
 * handlers together here makes the model-facing contract and execution path
 * use the same resolved registry.
 */
export function createBuiltInToolDefinitionsWithExecutors(
	executors: Record<
		string,
		(
			call: import("./types").ToolCall,
			context: ToolResolutionContext,
		) => Promise<import("./types").ToolResult>
	>,
	tools: Record<string, Record<string, unknown>> = noteTools,
): ToolDefinition[] {
	const definitions = createBuiltInToolDefinitions(tools);
	return definitions.map((definition) => {
		const execute = executors[definition.id] as
			| ((
					call: import("./types").ToolCall,
					context: ToolResolutionContext,
			  ) => Promise<import("./types").ToolResult>)
			| undefined;
		return execute ? { ...definition, execute } : definition;
	});
}

export function normalizeProviderRisk(risk: ProviderRisk): HostToolRisk {
	switch (risk) {
		case "read":
			return "read";
		case "write":
			return "local-write";
		case "remote-write":
			return "remote-write";
		case "destructive":
			return "destructive";
	}
}

/**
 * The AI SDK's `tool()` only accepts Zod/Standard schemas or its own
 * `jsonSchema()` wrapper. Providers may legally hand us a bare JSON-schema
 * object (per the Integration Provider contract); passing one through
 * makes the SDK try to *call* it while building the model request
 * (TypeError: ... is not a function). Normalize to an SDK-native schema.
 */
function toModelInputSchema(inputSchema: unknown): unknown {
	const candidate = inputSchema as {
		safeParse?: unknown;
		"~standard"?: { validate?: unknown };
		jsonSchema?: unknown;
		validate?: unknown;
	};
	if (typeof candidate?.safeParse === "function") return inputSchema;
	if (typeof candidate?.["~standard"]?.validate === "function")
		return inputSchema;
	// Already an SDK jsonSchema() wrapper (has both jsonSchema and validate).
	if (
		isRecord(candidate) &&
		typeof candidate.validate === "function" &&
		isRecord(candidate.jsonSchema)
	) {
		return inputSchema;
	}
	const raw = isRecord(candidate?.jsonSchema)
		? candidate.jsonSchema
		: inputSchema;
	return jsonSchema(raw as Parameters<typeof jsonSchema>[0]);
}

export function providerCapabilityToToolDefinition(
	providerId: string,
	capability: ProviderCapability,
): ToolDefinition {
	assertObjectLikeInputSchema(capability.id, capability.inputSchema);
	const modelTool = tool({
		description: capability.description,
		inputSchema: toModelInputSchema(capability.inputSchema) as any,
	}) as unknown as Record<string, unknown>;
	return {
		id: capability.id,
		version: 1,
		title: capability.title,
		description: capability.description,
		inputSchema: capability.inputSchema,
		modelTool,
		risk: normalizeProviderRisk(capability.risk),
		source: "provider",
		providerId,
		presentation: "generic",
		availability: () =>
			capability.availability === "disabled" ||
			capability.availability === "misconfigured"
				? capability.availability
				: "available",
	};
}

function assertUniqueDefinitions(definitions: ToolDefinition[]): void {
	const seen = new Set<string>();
	for (const definition of definitions) {
		if (seen.has(definition.id)) {
			throw new Error(`Duplicate tool ID: ${definition.id}`);
		}
		seen.add(definition.id);
	}
}

/** Resolve availability and derive the model-facing registry from descriptors. */
export function resolveToolRegistry(
	definitions: ToolDefinition[],
	context: ToolResolutionContext = {},
): ResolvedToolRegistry {
	assertUniqueDefinitions(definitions);
	const resolved = definitions.filter(
		(definition) =>
			(definition.availability?.(context) ?? "available") === "available",
	);
	const byId = new Map(
		resolved.map((definition) => [definition.id, definition]),
	);
	return {
		definitions: resolved,
		tools: Object.fromEntries(
			resolved.map((definition) => [definition.id, definition.modelTool]),
		),
		byId,
	};
}

export function createBuiltInToolRegistry(
	context: ToolResolutionContext = {},
): ResolvedToolRegistry {
	return resolveToolRegistry(createBuiltInToolDefinitions(), context);
}

/** Provider APIs expose a legacy availability enum; keep the mapping explicit. */
export function normalizeProviderAvailability(
	availability: ProviderAvailability | undefined,
): ToolAvailability {
	return availability ?? "available";
}

import { tool } from "ai";
import { z } from "zod";
import { MUTABLE_SETTING_KEYS } from "../lib/selfSettingsTools";

// Cast tool() to any to bypass AI SDK v6's deeply nested generic type inference
// which causes TypeScript to hang / OOM. Runtime behavior is unchanged.
const t = tool as any;

export const readNoteTool = t({
	description:
		"Read the full content of an Obsidian note by its name or path. " +
		"Use this before editing to understand the current content.",
	inputSchema: z.object({
		path: z
			.string()
			.describe(
				'Note name or path, e.g. "Project Notes" or "Folder/Project Notes"',
			),
	}),
});

export const editNoteTool = t({
	description:
		"Overwrite the entire content of an existing note. " +
		"Only use when the user explicitly asks to rewrite, edit, or replace a note. " +
		"Return the complete new content — do not use diff syntax.",
	inputSchema: z.object({
		path: z.string().describe('Note name or path, e.g. "Project Notes"'),
		content: z.string().describe("The complete new note content"),
		expected_content_fingerprint: z
			.string()
			.optional()
			.describe(
				"Fingerprint from read_note; refuse the edit if the note changed.",
			),
	}),
});

export const appendToNoteTool = t({
	description:
		"Append content to the end of an existing note. " +
		"Use for adding summaries, logs, or follow-ups without changing existing content.",
	inputSchema: z.object({
		path: z.string().describe('Note name or path, e.g. "Project Notes"'),
		content: z.string().describe("Content to append"),
		expected_content_fingerprint: z
			.string()
			.optional()
			.describe(
				"Fingerprint from read_note; refuse the edit if the note changed.",
			),
	}),
});

export const createNoteTool = t({
	description:
		"Create a new note in the vault with the given content. " +
		"Use when the user asks to create a new document, summary, or draft.",
	inputSchema: z.object({
		path: z
			.string()
			.describe('Note name or path, e.g. "Meeting Summaries/2026-05-03"'),
		content: z.string().describe("Initial note content"),
	}),
});

export const createNotesTool = t({
	description:
		"Create multiple new notes in one approved operation. Use this instead of repeated create_note calls when the user asks for several notes or a large set of files. " +
		"This tool never overwrites existing notes: paths that already exist are skipped and reported while other requested notes are created. Maximum 100 notes per call.",
	inputSchema: z.object({
		notes: z
			.array(
				z.object({
					path: z
						.string()
						.describe('New note path, e.g. "Chinese/Verbs/ai.md"'),
					content: z
						.string()
						.describe("Initial content for this note"),
				}),
			)
			.min(2)
			.max(100)
			.describe("The new notes to create"),
	}),
});

export const patchNoteTool = t({
	description:
		"Find and replace text inside an existing note. " +
		"Use for small, precise edits — fixing a word, updating a link, or changing a date. " +
		"Only replaces the first match unless replace_all is true.",
	inputSchema: z.object({
		path: z.string().describe('Note name or path, e.g. "Project Notes"'),
		search: z
			.string()
			.describe(
				"Exact text to find. Must match literally (case-sensitive).",
			),
		replace: z
			.string()
			.describe("Text to insert in place of the search string."),
		replace_all: z
			.boolean()
			.optional()
			.describe("Replace every occurrence instead of just the first."),
		expected_content_fingerprint: z
			.string()
			.optional()
			.describe(
				"Fingerprint from read_note; refuse the edit if the note changed.",
			),
	}),
});

export const editSectionTool = t({
	description:
		"Rewrite a specific section of a note identified by its heading. " +
		"Use when the user wants to change content under a heading without touching the rest of the note. " +
		"The new_content must include the heading line itself.",
	inputSchema: z.object({
		path: z.string().describe('Note name or path, e.g. "Project Notes"'),
		section_heading: z
			.string()
			.describe(
				'The heading text to target (without #), e.g. "Morning Routine"',
			),
		new_content: z
			.string()
			.describe(
				"The complete replacement text for this section, including the heading line.",
			),
		expected_content_fingerprint: z
			.string()
			.optional()
			.describe(
				"Fingerprint from read_note; refuse the edit if the note changed.",
			),
	}),
});

export const searchNotesTool = t({
	description:
		"Search for notes in the vault by name or path. " +
		"Use this first when the user asks to find notes or verify atomic-note coverage. " +
		"Returns canonical note paths with metadata; folder filters accept canonical paths or unambiguous folder names.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				'Search query (case-insensitive substring match), e.g. "meeting" or "daily". Use empty string "" to list all notes.',
			),
		sort_by: z
			.enum(["name", "modified", "created"])
			.optional()
			.default("name")
			.describe("Sort results by name, modified date, or created date."),
		limit: z
			.number()
			.optional()
			.default(20)
			.describe(
				"Maximum number of results to return (default 20, max 50).",
			),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
		folder: z
			.string()
			.optional()
			.describe(
				'Restrict search to a specific folder path, e.g. "Meeting Notes"',
			),
	}),
});

export const listNotesTool = t({
	description:
		"List notes in the vault, optionally filtered by folder. " +
		"Use this before content search when the user asks to browse, list, or verify note coverage — especially when no specific search query is given. " +
		"Returns a formatted list with metadata. Also shows subfolders if present.",
	inputSchema: z.object({
		folder: z
			.string()
			.optional()
			.describe(
				"Folder path to list notes from. Omit to list all notes in the vault.",
			),
		sort_by: z
			.enum(["name", "modified", "created"])
			.optional()
			.default("name")
			.describe("Sort results by name, modified date, or created date."),
		limit: z
			.number()
			.optional()
			.default(30)
			.describe(
				"Maximum number of results to return (default 30, max 100).",
			),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
		include_subfolders: z
			.boolean()
			.optional()
			.default(true)
			.describe(
				"Whether to include subfolder names in the result (default true).",
			),
		depth: z
			.number()
			.optional()
			.default(1)
			.describe(
				"How many levels of subfolders to show (default 1, max 3).",
			),
	}),
});

export const getNoteMetadataTool = t({
	description:
		"Get detailed metadata about a specific note — file size, creation date, modification date, word count, etc. " +
		"Use this when the user asks about note properties, recent changes, or file statistics.",
	inputSchema: z.object({
		path: z.string().describe('Note name or path, e.g. "Project Notes"'),
	}),
});

export const queryDataviewTool = t({
	description:
		"Run a read-only Dataview Query Language (DQL) query against the vault. " +
		"Use when the user asks for results computed from Dataview fields, such as filtered or sorted note tables. " +
		"This accepts DQL only; it does not execute DataviewJS.",
	inputSchema: z.object({
		query: z
			.string()
			.trim()
			.min(1)
			.max(5000)
			.describe(
				'Dataview Query Language source, e.g. TABLE file.mtime FROM "Projects" SORT file.mtime DESC',
			),
		max_output_chars: z
			.number()
			.int()
			.min(1000)
			.max(12000)
			.optional()
			.default(8000)
			.describe("Maximum characters returned (default 8000, max 12000)."),
	}),
});

export const createFolderTool = t({
	description:
		"Create a new folder in the Obsidian vault. " +
		"Use when the user asks to create a folder, directory, or organize notes into a new folder.",
	inputSchema: z.object({
		path: z
			.string()
			.describe(
				'Folder path to create, e.g. "Research/Papers" or "Meeting Notes/2026"',
			),
	}),
});

export const moveNoteTool = t({
	description:
		"Move or rename a note in the vault. " +
		"Use when the user asks to move a note to a different folder, or rename it. " +
		"If the destination folder does not exist, it will be created automatically.",
	inputSchema: z.object({
		path: z
			.string()
			.describe(
				'Current note name or path, e.g. "Project Notes" or "Old/Project Notes"',
			),
		new_path: z
			.string()
			.describe(
				'New destination path, e.g. "Research/Project Notes" or "Project Notes v2"',
			),
	}),
});

export const deleteNoteTool = t({
	description:
		"Delete a note from the vault. " +
		"Use when the user explicitly asks to delete, remove, or trash a note. " +
		"Returns an error if the note does not exist.",
	inputSchema: z.object({
		path: z
			.string()
			.describe('Note name or path to delete, e.g. "Draft Notes"'),
	}),
});

export const countNotesTool = t({
	description:
		"Count notes in a folder or the entire vault. " +
		"Use when the user asks how many notes exist, how large a folder is, or for vault statistics. " +
		"Returns total count, including notes not shown by list_notes due to limit.",
	inputSchema: z.object({
		folder: z
			.string()
			.optional()
			.describe(
				"Folder path to count notes in. Omit to count all notes in the vault.",
			),
	}),
});

export const listFoldersTool = t({
	description:
		"List folders in the vault. " +
		"Use when the user asks about vault structure, what folders exist, or where to place notes. " +
		"Returns a tree of folder paths.",
	inputSchema: z.object({
		path: z
			.string()
			.optional()
			.describe(
				"Optional parent folder to list subfolders from. Omit to list top-level folders.",
			),
	}),
});

export const searchWebTool = t({
	description:
		"Search the web for current information. " +
		"Use when the user asks about recent events, news, facts you may not know, or anything requiring up-to-date information from the internet. " +
		"Returns a list of search results with title, URL, and snippet for each result.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				"The search query string. Be specific and include key terms for better results.",
			),
		limit: z
			.number()
			.optional()
			.default(5)
			.describe(
				"Maximum number of results to return (default 5, max 20).",
			),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
	}),
});

export const readPdfTool = t({
	description:
		"Read and extract text from a PDF file. " +
		"Use when the user references a PDF, wants to analyze a paper, or needs content from a PDF document. " +
		"Works with URLs (online PDFs) or vault file paths. " +
		"Returns the extracted text content with page breakdown and metadata.",
	inputSchema: z.object({
		source: z
			.string()
			.describe(
				"PDF URL or vault file path, e.g. 'https://arxiv.org/pdf/2301.00001.pdf' or 'Papers/quantum-gravity.pdf'",
			),
		max_pages: z
			.number()
			.optional()
			.default(50)
			.describe(
				"Maximum pages to extract (default 50). Use lower for large PDFs to save tokens.",
			),
		start_page: z
			.number()
			.optional()
			.default(1)
			.describe("First PDF page to extract, starting at 1."),
	}),
});

export const createMemoryTool = t({
	description:
		"Create a persistent memory about the user, their preferences, " +
		"projects, or insights from the conversation. " +
		"Use when the user shares something worth remembering for future sessions. " +
		"Examples: 'I prefer Julia over Python', 'My QHE paper is due next month', " +
		"'I have two children', 'I work on loop quantum gravity'. " +
		"Be specific and concise. Include dates when relevant.",
	inputSchema: z.object({
		category: z
			.enum([
				"user_fact",
				"project",
				"preference",
				"insight",
				"reference",
			])
			.describe(
				"user_fact = personal info about user; " +
					"project = ongoing work/project; " +
					"preference = likes/dislikes/work style; " +
					"insight = interesting realization; " +
					"reference = paper/book/link worth remembering",
			),
		content: z
			.string()
			.describe(
				"The memory content — specific, concise, future-readable",
			),
		tags: z
			.array(z.string())
			.optional()
			.describe("Tags for filtering, e.g. ['physics', 'qhe', 'family']"),
	}),
});

export const updateMemoryTool = t({
	description:
		"Update an existing memory entry by its ID. " +
		"Use when the user wants to correct, expand, or reclassify a memory. " +
		"Only the fields you provide will be changed.",
	inputSchema: z.object({
		id: z.string().describe("The memory entry ID, e.g. 'a1b2c3d4'"),
		category: z
			.enum([
				"user_fact",
				"project",
				"preference",
				"insight",
				"reference",
			])
			.optional()
			.describe("New category, if changing"),
		content: z.string().optional().describe("New content, if changing"),
		tags: z
			.array(z.string())
			.optional()
			.describe("New tags, if changing (replaces existing tags)"),
	}),
});

export const deleteMemoryTool = t({
	description:
		"Delete a memory entry by its ID. " +
		"Use when the user wants to forget something or remove an incorrect memory.",
	inputSchema: z.object({
		id: z.string().describe("The memory entry ID to delete"),
	}),
});

export const listMemoriesTool = t({
	description:
		"List stored memories, optionally filtered by category or tag. " +
		"Use when the user asks 'what do you remember about me' or wants to review memories.",
	inputSchema: z.object({
		category: z
			.enum([
				"user_fact",
				"project",
				"preference",
				"insight",
				"reference",
			])
			.optional()
			.describe("Filter by category"),
		tag: z.string().optional().describe("Filter by tag (e.g. 'physics')"),
		limit: z
			.number()
			.optional()
			.default(20)
			.describe("Maximum entries to return (default 20, max 50)"),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
	}),
});

export const searchMemoriesTool = t({
	description:
		"Search memories by keyword across content and tags. " +
		"Use when the user asks about something specific they may have told you before.",
	inputSchema: z.object({
		query: z
			.string()
			.describe("Search query — keywords to find in memories"),
		limit: z
			.number()
			.optional()
			.default(10)
			.describe("Maximum results (default 10, max 50)"),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
	}),
});

export const readMemoryAuditTool = t({
	description:
		"Read the memory audit log — a record of create, update, and delete operations. " +
		"Use when the user asks about memory history, what was changed, or to debug memory issues. " +
		"Requires the memory audit tool to be enabled in Settings.",
	inputSchema: z.object({
		limit: z
			.number()
			.optional()
			.default(20)
			.describe("Maximum audit entries to return (default 20, max 50)"),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
	}),
});

export const evaluateStagedMemoryTool = t({
	description:
		"Evaluate staged memories and promote high-value entries into core memory. " +
		"Use after creating memories or when maintaining the memory store.",
	inputSchema: z.object({}),
});

export const cullCoreMemoryTool = t({
	description:
		"Cull low-value entries from core memory and move them to the archive. " +
		"Use when core memory needs maintenance.",
	inputSchema: z.object({}),
});

export const checkPathsTool = t({
	description:
		"Check whether one or more note paths exist in the vault. " +
		"Use this for fast batch existence checks — especially useful for atomic-note vaults where each concept has its own file. " +
		"Returns existence status, canonical path, and word count for each path checked.",
	inputSchema: z.object({
		paths: z
			.array(z.string())
			.min(1)
			.max(100)
			.describe(
				"Array of note paths or basenames to check, e.g. ['Learning Chinese/vocabulary/冰箱', 'Learning Chinese/vocabulary/厨房']",
			),
	}),
});

export const searchNoteContentTool = t({
	description:
		"Search inside the content of notes in the vault. " +
		"Use this when the user asks to find text, quotes, ideas, or topics they wrote about — not just note names. " +
		"For atomic-note coverage, use check_paths or list_notes first; content hits can include logs, lesson notes, and generated indexes. " +
		"Pass a narrow folder whenever possible. Snippets are opt-in to keep results compact.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				'Search query. The default phrase mode matches the exact sequence; use match_mode "and" or "any" for word-based matching.',
			),
		folder: z
			.string()
			.optional()
			.describe(
				'Restrict search to a specific folder path, e.g. "Research"',
			),
		sort_by: z
			.enum(["relevance", "modified", "created", "name"])
			.optional()
			.default("relevance")
			.describe(
				"Sort results by relevance (match count), modified date, created date, or name.",
			),
		limit: z
			.number()
			.optional()
			.default(20)
			.describe(
				"Maximum number of results to return (default 20, max 50).",
			),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
		context_lines: z
			.number()
			.optional()
			.default(2)
			.describe(
				"Lines of context around each match to include in excerpts (default 2, max 5).",
			),
		match_mode: z
			.enum(["and", "phrase", "any"])
			.optional()
			.default("phrase")
			.describe(
				"Match mode: 'phrase' = exact sequence (default), 'and' = all words must appear, 'any' = any word matches.",
			),
		include_filename: z
			.boolean()
			.optional()
			.default(false)
			.describe(
				"Also search in note filenames/basenames, not just content (default false).",
			),
		include_snippets: z
			.boolean()
			.optional()
			.default(false)
			.describe(
				"Include text excerpts in results (default false). Set true when prose context is needed.",
			),
	}),
});

export const searchPastSessionsTool = t({
	description:
		"Search past chat sessions by topic, keyword, or content. " +
		"Use when the user references something from a previous conversation, " +
		"asks 'what did we discuss about X', or when you need historical context.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				"Search query — keywords or topic to find in past sessions",
			),
		limit: z
			.number()
			.optional()
			.default(5)
			.describe(
				"Maximum number of results to return (default 5, max 20)",
			),
		cursor: z
			.string()
			.optional()
			.describe(
				"Opaque cursor returned when another result page is available.",
			),
	}),
});

export const readToolResultTool = t({
	description:
		"Read an exact bounded section of an earlier persisted tool result. " +
		"Use the session_id and tool_call_id from an available result reference " +
		"when a preview or summary does not contain enough detail.",
	inputSchema: z.object({
		session_id: z
			.string()
			.describe("The chat session containing the result"),
		tool_call_id: z
			.string()
			.describe("The stable tool-call ID in the reference"),
		offset: z.number().int().min(0).optional(),
		limit: z.number().int().min(1).max(12000).optional(),
		query: z.string().optional(),
	}),
});

export const readSettingsTool = t({
	description:
		"Read the current plugin settings. " +
		"Use this to self-diagnose configuration issues or understand current behavior. " +
		"Sensitive fields like API keys and credentials are automatically redacted.",
	inputSchema: z.object({}),
});

export const updateSettingTool = t({
	description:
		"Update a single plugin setting. Only available when developer mode is enabled. " +
		"Use this to adjust token budgets, toggles, or behavior flags mid-conversation. " +
		"Only whitelisted keys can be changed; credentials and paths are immutable.",
	inputSchema: z.object({
		key: z
			.string()
			.describe(
				`The setting key to update. Whitelisted: ${MUTABLE_SETTING_KEYS.join(", ")}`,
			),
		value: z
			.any()
			.describe(
				"The new value for the setting. Must match the expected type.",
			),
	}),
});

export const getPluginInfoTool = t({
	description:
		"Get information about the plugin: name, version, author, description, and available capabilities. " +
		"Use this when the user asks what version you are, what you can do, or who made you.",
	inputSchema: z.object({}),
});

export const noteTools = {
	read_note: readNoteTool,
	edit_note: editNoteTool,
	append_to_note: appendToNoteTool,
	create_note: createNoteTool,
	create_notes: createNotesTool,
	patch_note: patchNoteTool,
	edit_section: editSectionTool,
	search_notes: searchNotesTool,
	list_notes: listNotesTool,
	count_notes: countNotesTool,
	get_note_metadata: getNoteMetadataTool,
	query_dataview: queryDataviewTool,
	create_folder: createFolderTool,
	move_note: moveNoteTool,
	delete_note: deleteNoteTool,
	list_folders: listFoldersTool,
	check_paths: checkPathsTool,
	search_web: searchWebTool,
	read_pdf: readPdfTool,
	create_memory: createMemoryTool,
	update_memory: updateMemoryTool,
	delete_memory: deleteMemoryTool,
	list_memories: listMemoriesTool,
	search_memories: searchMemoriesTool,
	read_memory_audit: readMemoryAuditTool,
	evaluate_staged: evaluateStagedMemoryTool,
	cull_core: cullCoreMemoryTool,
	search_note_content: searchNoteContentTool,
	search_past_sessions: searchPastSessionsTool,
	read_tool_result: readToolResultTool,
	read_settings: readSettingsTool,
	update_setting: updateSettingTool,
	get_plugin_info: getPluginInfoTool,
};

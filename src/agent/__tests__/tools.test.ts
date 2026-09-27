import { describe, it, expect } from "vitest";
import { z } from "zod";
import { noteTools } from "../tools";

const EXPECTED_TOOLS = [
	"read_note",
	"edit_note",
	"append_to_note",
	"create_note",
	"create_notes",
	"patch_note",
	"edit_section",
	"search_notes",
	"search_note_content",
	"list_notes",
	"count_notes",
	"get_note_metadata",
	"query_dataview",
	"create_folder",
	"move_note",
	"delete_note",
	"list_folders",
	"check_paths",
	"search_web",
	"read_pdf",
	"create_memory",
	"update_memory",
	"delete_memory",
	"list_memories",
	"search_memories",
	"read_memory_audit",
	"evaluate_staged",
	"cull_core",
	"search_past_sessions",
	"read_tool_result",
	"read_settings",
	"update_setting",
	"get_plugin_info",
];

describe("noteTools", () => {
	it("contains all expected tools", () => {
		for (const name of EXPECTED_TOOLS) {
			expect(noteTools).toHaveProperty(name);
			expect(noteTools[name as keyof typeof noteTools]).toBeDefined();
		}
		expect([...Object.keys(noteTools)].sort()).toEqual(
			[...EXPECTED_TOOLS].sort(),
		);
	});

	it("every tool has a non-empty description", () => {
		for (const [name, tool] of Object.entries(noteTools)) {
			expect(
				tool.description,
				`Tool ${name} should have a description`,
			).toBeTruthy();
			expect(
				tool.description.length,
				`Tool ${name} description should not be empty`,
			).toBeGreaterThan(0);
		}
	});

	it("every tool has an inputSchema", () => {
		for (const [name, tool] of Object.entries(noteTools)) {
			expect(
				tool.inputSchema,
				`Tool ${name} should have inputSchema`,
			).toBeDefined();
		}
	});
});

describe("search_note_content schema", () => {
	const schema = noteTools.search_note_content.inputSchema as z.ZodSchema;

	it("defaults to compact phrase searches", () => {
		const parsed = schema.parse({ query: "there is" });
		expect(parsed.match_mode).toBe("phrase");
		expect(parsed.include_snippets).toBe(false);
	});
});

describe("read_note schema", () => {
	const schema = noteTools.read_note.inputSchema as z.ZodSchema;

	it("accepts valid input", () => {
		const result = schema.parse({ path: "My Note" });
		expect(result).toEqual({ path: "My Note" });
	});

	it("rejects missing path", () => {
		expect(() => schema.parse({})).toThrow();
	});

	it("rejects non-string path", () => {
		expect(() => schema.parse({ path: 123 })).toThrow();
	});
});

describe("edit_note schema", () => {
	const schema = noteTools.edit_note.inputSchema as z.ZodSchema;

	it("accepts valid input", () => {
		const result = schema.parse({
			path: "My Note",
			content: "New content",
		});
		expect(result).toEqual({ path: "My Note", content: "New content" });
	});

	it("rejects missing content", () => {
		expect(() => schema.parse({ path: "My Note" })).toThrow();
	});
});

describe("create_notes schema", () => {
	const schema = noteTools.create_notes.inputSchema as z.ZodSchema;

	it("accepts a bounded batch of new notes", () => {
		const result = schema.parse({
			notes: [
				{ path: "Chinese/Verbs/ai", content: "# ai" },
				{ path: "Chinese/Verbs/ba", content: "# ba" },
			],
		}) as { notes: Array<{ path: string }> };
		expect(result.notes).toHaveLength(2);
	});

	it("rejects a singleton or more than 100 notes", () => {
		expect(() =>
			schema.parse({ notes: [{ path: "Only", content: "x" }] }),
		).toThrow();
		expect(() =>
			schema.parse({
				notes: Array.from({ length: 101 }, (_, i) => ({
					path: `N${i}`,
					content: "x",
				})),
			}),
		).toThrow();
	});
});

describe("patch_note schema", () => {
	const schema = noteTools.patch_note.inputSchema as z.ZodSchema;

	it("accepts valid input with required fields", () => {
		const result = schema.parse({
			path: "My Note",
			search: "old text",
			replace: "new text",
		});
		expect(result).toEqual({
			path: "My Note",
			search: "old text",
			replace: "new text",
		});
	});

	it("accepts input with replace_all option", () => {
		const result = schema.parse({
			path: "My Note",
			search: "old",
			replace: "new",
			replace_all: true,
		});
		expect(result.replace_all).toBe(true);
	});

	it("rejects missing search field", () => {
		expect(() =>
			schema.parse({ path: "My Note", replace: "new" }),
		).toThrow();
	});
});

describe("search_notes schema", () => {
	const schema = noteTools.search_notes.inputSchema as z.ZodSchema;

	it("accepts query-only input", () => {
		const result = schema.parse({ query: "meeting" });
		expect(result.query).toBe("meeting");
		expect(result.sort_by).toBe("name"); // default
		expect(result.limit).toBe(20); // default
	});

	it("accepts full input with all options", () => {
		const result = schema.parse({
			query: "daily",
			sort_by: "modified",
			limit: 50,
			folder: "Journal",
		});
		expect(result).toEqual({
			query: "daily",
			sort_by: "modified",
			limit: 50,
			folder: "Journal",
		});
	});

	it("accepts a continuation cursor without changing the search contract", () => {
		const result = schema.parse({
			query: "daily",
			limit: 10,
			cursor: "opaque-cursor",
		});
		expect(result.cursor).toBe("opaque-cursor");
	});

	it("rejects invalid sort_by enum value", () => {
		expect(() =>
			schema.parse({ query: "test", sort_by: "size" }),
		).toThrow();
	});

	it("accepts large limit values (no max constraint in schema)", () => {
		// NOTE: schema does not enforce max 100; description mentions it as guidance
		const result = schema.parse({ query: "test", limit: 200 });
		expect(result.limit).toBe(200);
	});
});

describe("list_notes schema", () => {
	const schema = noteTools.list_notes.inputSchema as z.ZodSchema;

	it("uses correct defaults", () => {
		const result = schema.parse({});
		expect(result.sort_by).toBe("name");
		expect(result.limit).toBe(30);
		expect(result.include_subfolders).toBe(true);
		expect(result.depth).toBe(1);
	});

	it("accepts custom depth up to 3", () => {
		const result = schema.parse({ depth: 3 });
		expect(result.depth).toBe(3);
	});

	it("accepts depth above 3 (no max constraint in schema)", () => {
		// NOTE: schema does not enforce max 3; description mentions it as guidance
		const result = schema.parse({ depth: 5 });
		expect(result.depth).toBe(5);
	});
});

describe("read_pdf schema", () => {
	const schema = noteTools.read_pdf.inputSchema as z.ZodSchema;

	it("defaults to the first page and accepts a later page", () => {
		expect(schema.parse({ source: "paper.pdf" }).start_page).toBe(1);
		expect(schema.parse({ source: "paper.pdf", start_page: 51 })).toEqual(
			expect.objectContaining({ start_page: 51 }),
		);
	});
});

describe("create_memory schema", () => {
	const schema = noteTools.create_memory.inputSchema as z.ZodSchema;

	it("accepts valid input with category enum", () => {
		const result = schema.parse({
			category: "user_fact",
			content: "User prefers dark mode",
		});
		expect(result.category).toBe("user_fact");
	});

	it("accepts optional tags", () => {
		const result = schema.parse({
			category: "preference",
			content: "Likes minimal UI",
			tags: ["ui", "design"],
		});
		expect(result.tags).toEqual(["ui", "design"]);
	});

	it("rejects invalid category", () => {
		expect(() =>
			schema.parse({ category: "invalid", content: "test" }),
		).toThrow();
	});

	it("rejects missing content", () => {
		expect(() => schema.parse({ category: "insight" })).toThrow();
	});
});

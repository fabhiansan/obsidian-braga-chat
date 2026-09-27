import { Platform } from "obsidian";
import { ContextItem } from "../types";
import { SlashCommand } from "./slashCommand";
import { PersonaLoader } from "../intelligence/PersonaLoader";
import {
	createBuiltInToolDefinitions,
	describeToolsForPrompt,
} from "../agent/toolRegistry";
import type { ToolDefinition } from "../agent/toolRegistry";

export interface SystemPromptParticipant {
	name: string;
	type: "agent" | "remote" | "local";
}

export async function buildSystemPrompt(
	contextItems: ContextItem[],
	personaLoader: PersonaLoader | null,
	slashCmd?: SlashCommand,
	toolsEnabled = false,
	participants?: SystemPromptParticipant[],
	toolDefinitions?: ReadonlyArray<Pick<ToolDefinition, "id" | "description">>,
	identityContextBudget?: number,
): Promise<string> {
	let identityContext = "";
	if (personaLoader) {
		try {
			identityContext = await personaLoader.loadFullContext(
				identityContextBudget !== undefined
					? { maxTokens: identityContextBudget }
					: undefined,
			);
		} catch {
			// Graceful fallback if persona loading fails
		}
	}

	let prompt = "";
	if (identityContext) {
		prompt = identityContext + "\n\n";
	}
	if (personaLoader) {
		prompt +=
			"\n\nMemory is organized into three tiers: core memories are high-value and loaded into this prompt; staged memories are newly created and awaiting evaluation; archived memories are retained for search but are not loaded by default. Use evaluate_staged to curate new memories and cull_core to move low-value core memories to the archive.";
	}
	prompt +=
		"You are a helpful assistant integrated into an Obsidian note-taking app.";

	// ── System Context (date, time, platform) ──
	const now = new Date();
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const platformInfo = `Platform: ${Platform.isMobile ? "mobile" : "desktop"}`;

	prompt += `\n\n[System Context]`;
	prompt += `\n- Current date: ${now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
	prompt += `\n- Current time: ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
	prompt += `\n- Timezone: ${tz}`;
	if (platformInfo) prompt += `\n- ${platformInfo}`;
	prompt += `\n- Locale: ${typeof navigator !== "undefined" ? navigator.language : "unknown"}`;
	const hasActiveNote = contextItems.some((i) => i.type === "active-note");

	if (toolsEnabled) {
		prompt +=
			"\n\nYou have access to these tools:" +
			`\n${describeToolsForPrompt(toolDefinitions ?? createBuiltInToolDefinitions())}` +
			"\n\nWhen the user asks to find, list, or search for notes, ALWAYS use search_notes, list_notes, or search_note_content." +
			" When the user asks for a Dataview/DQL query, use query_dataview when it is available; it accepts DQL, not DataviewJS." +
			" For several search terms, prefer one search_note_content call with match_mode=and or any instead of separate searches." +
			" When the user asks whether you can search past sessions, chats, conversations, or what you discussed previously, say that you can search saved chat history and call search_past_sessions with the relevant keywords." +
			" Do not say you cannot search — you have the search_notes, list_notes, and search_note_content tools." +
			" When a bounded tool returns has_more=true, call the same tool again with its next_cursor only if the user needs more results; keep the original filters unchanged. For PDFs, request the returned next_page with start_page." +
			" Before editing a note you are unfamiliar with, use read_note to see its current content." +
			"\n\nImportant: When using edit_note, provide the COMPLETE new note content. Do not use diff syntax or markdown code blocks." +
			"\n\nFor moving notes: use move_note(path, new_path). Parent folders are created automatically if needed." +
			"\nFor multiple new notes: use one create_notes call with all note paths and contents. Existing paths are expected to be safely skipped; do not omit the rest of the batch. Do not claim to batch or parallelize work with create_note; it only creates one note." +
			"\nFor creating folders: use create_folder(path). Then use move_note to place notes inside.";
	}

	if (slashCmd) {
		switch (slashCmd.command) {
			case "edit":
				prompt += `\n\nThe user wants to edit the note "${slashCmd.target}". Return ONLY the complete revised note content. Do not wrap it in markdown code blocks or add explanations.`;
				break;
			case "create":
				prompt += `\n\nThe user wants to create a new note named "${slashCmd.target}". Return the complete note content.`;
				break;
			case "append":
				prompt += `\n\nThe user wants to append to the note "${slashCmd.target}". Return only the new content to append.`;
				break;
		}
	} else if (hasActiveNote) {
		prompt +=
			"\n\nThe active note is included in context. When the user asks you to edit, rewrite, or improve the note, return ONLY the complete revised note content. Do not wrap it in markdown code blocks or add explanations.";
	}
	if (participants && participants.length > 0) {
		prompt += "\n\n[Participants]";
		const agents = participants.filter((p) => p.type === "agent");
		const remotes = participants.filter((p) => p.type === "remote");
		const local = participants.find((p) => p.type === "local");
		if (agents.length > 0) {
			prompt += `\n- AI assistants: ${agents.map((a) => a.name).join(", ")}`;
		}
		if (local) {
			prompt += `\n- Local user: ${local.name}`;
		}
		if (remotes.length > 0) {
			prompt += `\n- Remote users: ${remotes.map((r) => r.name).join(", ")}`;
		}
		prompt +=
			"\n\nMessages from other participants will be prefixed with their name.";
	}

	return prompt;
}

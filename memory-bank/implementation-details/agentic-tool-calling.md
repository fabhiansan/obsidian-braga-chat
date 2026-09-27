# Agentic Tool Calling Implementation
*Created: 2026-05-03 02:40:00 IST*
*Last Updated: 2026-08-25 23:55:03 IST*

## Overview

The LLM acts as an agent that can read, edit, create, move, delete, and organize Obsidian notes via native function calling. The Vercel AI SDK provides the tool calling primitives. This document describes the complete implementation.

**Status**: ✅ Tool layer implemented. AgentLoop extracted. PendingToolCard created. Tool result formatting active.

### Optional Dataview DQL Queries (2026-09-27)

The read-only `query_dataview` tool is exposed only when the loaded Dataview
plugin provides its public `tryQueryMarkdown` or `queryMarkdown` API. It runs
DQL only, caps query input at 5,000 characters, and caps formatted output at
12,000 characters (8,000 by default). It does not execute DataviewJS. The
capability uses the shared registry and executor so availability, prompting,
native tool calls, and OpenResponses calls use the same definition.

TypeScript and the production bundle passed. Live Obsidian acceptance with
Dataview installed remains unverified.

## Current Audit Boundary — 2026-08-25

The registry now contains 24 built-in tools plus opt-in read-only provider
capabilities. The original architecture remains functional, but definitions,
dispatch, prompt descriptions, previews, result formatting, availability, and
risk have drifted across independent modules.

Open gaps are tracked by T60:

- Native `AgentLoop` retains only the last call emitted in a model step.
- OpenResponses does not consume the resolved provider-aware registry and its
  serializer requires compatibility coverage against current tool objects.
- Local schema validation is not enforced through one transport-independent boundary.
- The static prompt advertises removed `search_content` input and omits tools.
- Disabled memory/audit capabilities remain model-visible.
- The binary auto-apply setting does not distinguish read, local mutation,
  remote work, and destructive operations.

The target design is documented in
`tool-capability-registry-and-execution-pipeline.md`. T38 owns approval/audit,
T46 owns physical decomposition, and T60a–c own registry, transport, and
execution-pipeline hardening.

## Provider-Adaptive Streaming Boundary — T60e

The current `AgentLoop` receives SDK tool events but notifies the UI only after
the response stream ends; `OpenResponsesLoop` similarly collects function calls
before invoking its callback. Partial arguments and hidden reasoning are not
shown. T60e defines the follow-up contract for provisional display, complete
argument validation before execution, and generic provider-neutral progress
states. It must be implemented on the separate branch
`feat/t60e-provider-adaptive-streaming-ui`; T15 owns the visual presentation.

## Design Philosophy

- **Own the loop**: Vercel AI SDK v6 removed `maxSteps` from `streamText` and introduced `ToolLoopAgent` as an experimental class. We avoid the experimental abstraction and manage the loop ourselves for long-term stability.
- **User in control**: `autoApply` setting defaults to `false`; every tool call renders an approval card.
- **Progressive enhancement**: If the provider/model doesn't support tool calling, degrade gracefully to text-only responses.
- **Reuse existing machinery**: `NoteEditingBridge` and `vault.*` APIs handle the actual file operations; the agent layer only decides *when* to call them.
- **SDK-agnostic events**: `api.ts` translates SDK-specific stream events into our own `StreamEvent` union. If the SDK changes event shapes in v7, only the adapter changes.
- **Basename-friendly**: The LLM often passes note names without `.md`. `resolveNote()` handles three-tier resolution so tools work with either basenames or full paths.
- **Formatted results**: Tool results are formatted as markdown (tables, lists, summaries) before passing back to the LLM, preventing raw JSON dumps in chat.

---

## Phase 2: Discovery & Rendering Enhancement - ✅ COMPLETE (2026-05-14)

### Problem
The initial `search_notes` tool (filename/path substring match) was too limited. The AI could not:
1. Browse vault contents without a query string
2. Sort results by date modified/created
3. Get file metadata (size, dates, word count)
4. Search **inside** note bodies
5. Create folders, move notes, delete notes, or list folder structure

Additionally, tool results rendered as raw JSON text in chat messages, making them unreadable.

### Implemented Additions

| # | Tool | Purpose | Status |
|---|------|---------|--------|
| 1 | `list_notes` | Browse vault contents with `sort_by` (name/modified/created), `limit`, `folder` filter | ✅ |
| 2 | `get_note_metadata` | File stats: created, modified, size, wordCount | ✅ |
| 3 | `search_notes` v2 | `sort_by`, `limit`, `folder` params. `search_content` removed (was broken). | ✅ |
| 4 | `create_folder` | Create new folders in vault | ✅ |
| 5 | `move_note` | Move/rename notes (auto-creates parent folders) | ✅ |
| 6 | `delete_note` | Delete notes (system trash) | ✅ |
| 7 | `list_folders` | List vault folder structure | ✅ |
| 8 | `AgentLoop` extraction | Dedicated class for stream→tool→result cycle | ✅ |
| 9 | `PendingToolCard` | Dedicated component for approval UI | ✅ |
| 10 | Custom result rendering | Search/list → markdown tables; folders → bulleted list; metadata → formatted summary | ✅ |

### Rendering Implementation

Tool results are formatted as markdown before inserting into messages:
- `search_notes` / `list_notes` → markdown table with `[[wiki-links]]`
- `list_folders` → bulleted list
- `get_note_metadata` → formatted summary with `**Property**: Value`
- `read_note` → clean content (no JSON wrapper)
- Edit/append/create/patch/move/delete/folder → brief success text

Implementation: `formatToolResult()` in `src/agent/AgentLoop.ts` (lines 38-108). Results passed as `type: "text"` to LLM instead of raw `type: "json"` blobs.

---

## SDK Version Context

**Installed**: `ai` v6.0.174

**Critical v6 changes from v4/v5**:
- `maxSteps` / `maxToolRoundtrips` removed from `streamText`
- `streamText({ tools })` defaults to **one step only** (`stopWhen: stepCountIs(1)`)
- `ToolLoopAgent` introduced as experimental agent abstraction
- `fullStream` yields `TextStreamPart<TOOLS>` union with events: `text-delta`, `tool-call`, `tool-result`, `tool-error`, `tool-input-start/end/delta`
- Tools WITH `execute` functions auto-run during streaming
- Tools WITHOUT `execute` functions yield `tool-call` and the stream stops

**Our approach**: Define tools WITHOUT `execute`, consume `tool-call` events, pause for approval, execute manually via `ToolExecutor`, append results to messages, and call `streamText` again.

---

## Tool Registry

### Bulk Note Creation (2026-08-05)

`create_notes` is the bulk counterpart to `create_note`. It accepts 2–100
`{ path, content }` entries and is intended for genuinely large, explicit file
creation requests such as Dataview-generated note sets. The system prompt tells
the model to use it instead of claiming it can "batch" or "parallelize" the
single-note tool.

Safety and approval boundary:

- The normal pending-tool approval applies to the entire batch when auto-apply is off.
- Every target path is checked before the first write for an allowed vault location and uniqueness inside the batch. Those invalid plans fail without writing a note.
- The operation never overwrites an existing note. An existing target is an idempotent skip, so it does not prevent the other requested notes from being created. A path that appears during execution is treated as the same safe skip; an unexpected vault error returns the created and skipped paths from the partial operation.
- The approval card shows the count, an explicit no-overwrite/existing-notes-skip statement, and a compact preview of the first paths.

`create_note` remains available for a single document. `create_notes` is also
registered through the OpenResponses conversion because that conversion reads
the shared `noteTools` registry.

### Saved Conversation Retrieval (2026-07-29)

`search_past_sessions` is a read-only tool for saved chat history. It is explicitly described in system prompts so agents distinguish it from vault-note search. `ToolExecutor` removes the active session from results before limiting them, preventing an agent from citing the conversation it is currently answering in. The response renderer appends de-duplicated titled links and excerpts to the assistant reply. Full behavior: [Past-Session Search and Shared Tabs](past-session-search-and-tabs.md).

### Tool Definitions (`src/agent/tools.ts`)

Tools are pure Zod schemas **without `execute` functions**. The LLM sees them; execution happens in `ToolExecutor` after user approval.

```typescript
import { z } from 'zod';

export const noteTools = {
  // --- Content Tools (6) ---
  read_note: {
    description: 'Read the full content of a note. Use before editing to understand current content.',
    parameters: z.object({ path: z.string().describe('Note name or path') }),
  },
  edit_note: {
    description: 'Overwrite the entire content of a note. Provide COMPLETE new content.',
    parameters: z.object({ path: z.string(), content: z.string() }),
  },
  append_to_note: {
    description: 'Add content to the end of a note without changing existing content.',
    parameters: z.object({ path: z.string(), content: z.string() }),
  },
  create_note: {
    description: 'Create a new note in the vault.',
    parameters: z.object({ path: z.string(), content: z.string() }),
  },
  patch_note: {
    description: 'Find and replace text inside a note (small precise edits).',
    parameters: z.object({ path: z.string(), search: z.string(), replace: z.string(), replace_all: z.boolean().optional() }),
  },
  edit_section: {
    description: 'Rewrite content under a specific heading.',
    parameters: z.object({ path: z.string(), section_heading: z.string(), new_content: z.string() }),
  },

  // --- Discovery Tools (3) ---
  search_notes: {
    description: 'Search for notes by filename or path. Use sort_by=name|modified|created, limit, and folder.',
    parameters: z.object({
      query: z.string(),
      sort_by: z.enum(['name', 'modified', 'created']).optional(),
      limit: z.number().optional(),
      folder: z.string().optional(),
    }),
  },
  list_notes: {
    description: 'Browse all notes in the vault or a folder. Use sort_by and limit.',
    parameters: z.object({
      folder: z.string().optional(),
      sort_by: z.enum(['name', 'modified', 'created']).optional(),
      limit: z.number().optional(),
    }),
  },
  get_note_metadata: {
    description: 'Get file stats (size, dates, word count) for a specific note.',
    parameters: z.object({ path: z.string() }),
  },

  // --- Vault Management Tools (4) ---
  create_folder: {
    description: 'Create a new folder in the vault.',
    parameters: z.object({ path: z.string().describe('Folder path, e.g. "Research/Papers"') }),
  },
  move_note: {
    description: 'Move or rename a note. Parent folders created automatically.',
    parameters: z.object({ path: z.string(), new_path: z.string() }),
  },
  delete_note: {
    description: 'Delete a note from the vault.',
    parameters: z.object({ path: z.string() }),
  },
  list_folders: {
    description: 'List folders in the vault. Use to understand vault structure.',
    parameters: z.object({ path: z.string().optional().describe('Parent folder to list subfolders from') }),
  },
};
```

**Note**: `zod` is already installed. No new dependencies.

---

## Path Resolution (`resolveNote`)

`ToolExecutor` includes a `resolveNote(path: string): TFile | null` helper that tries three strategies in order:

1. **Exact path** - `vault.getAbstractFileByPath(path)`
2. **Append `.md`** - `vault.getAbstractFileByPath(path + ".md")`
3. **Wiki-link resolution** - `metadataCache.getFirstLinkpathDest(path, "")`

This ensures tools work whether the LLM passes `"Project Notes"`, `"Project Notes.md"`, or a wiki-link style name.

---

## Agent Core

### `AgentLoop` (`src/agent/AgentLoop.ts`) - ✅ IMPLEMENTED

Orchestrates multi-step tool calling with the Vercel AI SDK. Extracted from `ChatApp.tsx` into a dedicated class.

```typescript
export interface AgentLoopOptions {
  chatApi: ChatApiManager;
  toolExecutor: ToolExecutor;
  maxSteps: number;
  autoApprove: boolean;
  onTextDelta: (text: string) => void;
  onToolCall: (call: ToolCall) => void;
  requestApproval: (call: ToolCall) => Promise<ToolResult | null>;
}

export class AgentLoop {
  constructor(opts: AgentLoopOptions) {}

  async run(
    messages: Array<any>,
    tools: any,
    signal: AbortSignal,
  ): Promise<{ text: string; tokenEstimate: number; stepsTaken: number }> {
    // 1. Stream LLM response with tools (single step via stopWhen)
    // 2. Detect tool calls from stream events
    // 3. Execute tool (auto-approved or via user confirmation)
    // 4. Format result as markdown
    // 5. Feed result back into conversation
    // 6. Repeat until no more tool calls or maxSteps reached
  }
}
```

**Key features:**
- Callback interface: `onTextDelta` (streaming text), `onToolCall` (detection), `requestApproval` (Promise-based approval)
- `formatToolResult()` formats all tool results as markdown before passing to LLM
- AbortSignal propagation for clean cancellation
- Step logging for debugging

**ChatApp integration:**
```typescript
const agent = new AgentLoop({
  chatApi: plugin.chatapi,
  toolExecutor: new ToolExecutor(plugin.app),
  maxSteps: maxAgentSteps,
  autoApprove,
  onTextDelta: (text) => { fullText = text; setCurrentAiMessage(text); },
  onToolCall: (call) => { console.log('tool-call pending:', call.toolName, call.args); },
  requestApproval: async (call) => {
    setPendingToolCall(call);
    const resolved = await new Promise<ToolResult | null>((resolve) => {
      resolveToolRef.current = resolve;
    });
    setPendingToolCall(null);
    return resolved;
  },
});
const result = await agent.run(chatMessages, noteTools, controller.signal);
```

### `ToolExecutor` (`src/agent/ToolExecutor.ts`)

Executes approved tool calls against the Obsidian vault.

```typescript
class ToolExecutor {
  constructor(private app: App) {}

  async execute(call: ToolCall): Promise<ToolResult> {
    switch (call.name) {
      case 'read_note': return this.readNote(call.args);
      case 'edit_note': return this.editNote(call.args);
      case 'append_to_note': return this.appendToNote(call.args);
      case 'create_note': return this.createNote(call.args);
      case 'patch_note': return this.patchNote(call.args);
      case 'edit_section': return this.editSection(call.args);
      default: return { error: `Unknown tool: ${call.name}` };
    }
  }

  private resolveNote(path: string): TFile | null {
    // 1. exact path
    let file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) return file;
    // 2. append .md
    file = this.app.vault.getAbstractFileByPath(path + '.md');
    if (file instanceof TFile) return file;
    // 3. wiki-link resolution
    file = this.app.metadataCache.getFirstLinkpathDest(path, '');
    if (file instanceof TFile) return file;
    return null;
  }

  private async readNote(args: { path: string }): Promise<ToolResult> {
    const file = this.resolveNote(args.path);
    if (!file) return { error: `Note not found: ${args.path}` };
    const content = await this.app.vault.read(file);
    return { content, path: file.path };
  }

  private async editNote(args: { path: string; content: string }): Promise<ToolResult> {
    const file = this.resolveNote(args.path);
    if (!file) return { error: `Note not found: ${args.path}` };
    await this.app.vault.modify(file, args.content);
    new Notice(`✓ Edited ${file.basename}`);
    return { success: true, path: file.path };
  }

  private async appendToNote(args: { path: string; content: string }): Promise<ToolResult> {
    const file = this.resolveNote(args.path);
    if (!file) return { error: `Note not found: ${args.path}` };
    const existing = await this.app.vault.read(file);
    await this.app.vault.modify(file, existing + '\n\n' + args.content);
    new Notice(`✓ Appended to ${file.basename}`);
    return { success: true, path: file.path };
  }

  private async createNote(args: { path: string; content: string }): Promise<ToolResult> {
    const fileName = args.path.endsWith('.md') ? args.path : `${args.path}.md`;
    if (this.resolveNote(fileName)) return { error: `Note already exists: ${fileName}` };
    await this.app.vault.create(fileName, args.content);
    new Notice(`✓ Created ${fileName}`);
    return { success: true, path: fileName };
  }

  private async patchNote(args: { path: string; search: string; replace: string; replace_all?: boolean }): Promise<ToolResult> {
    const file = this.resolveNote(args.path);
    if (!file) return { error: `Note not found: ${args.path}` };
    const content = await this.app.vault.read(file);
    if (!content.includes(args.search)) return { error: 'Search text not found in note. Consider read_note first to see exact content.' };
    const newContent = args.replace_all
      ? content.split(args.search).join(args.replace)
      : content.replace(args.search, args.replace);
    await this.app.vault.modify(file, newContent);
    const count = args.replace_all ? content.split(args.search).length - 1 : 1;
    new Notice(`✓ Patched ${file.basename} (${count} replacement${count > 1 ? 's' : ''})`);
    return { success: true, path: file.path };
  }

  private async editSection(args: { path: string; heading: string; content: string }): Promise<ToolResult> {
    const file = this.resolveNote(args.path);
    if (!file) return { error: `Note not found: ${args.path}` };
    const lines = (await this.app.vault.read(file)).split('\n');
    const headingLine = lines.findIndex(l => l.trim() === `# ${args.heading}`);
    if (headingLine === -1) return { error: `Heading "${args.heading}" not found.` };
    const nextHeading = lines.findIndex((l, i) => i > headingLine && l.startsWith('# '));
    const endLine = nextHeading === -1 ? lines.length : nextHeading;
    const newLines = [...lines.slice(0, headingLine + 1), args.content, ...lines.slice(endLine)];
    await this.app.vault.modify(file, newLines.join('\n'));
    new Notice(`✓ Edited section "${args.heading}" in ${file.basename}`);
    return { success: true, path: file.path };
  }
}
```

---

## Streaming Architecture

### Current vs New

**Current (text-only):**
```
streamText({ model, messages })
  → textStream yields string chunks
  → ChatApp appends to currentAiMessage
```

**New (tools + approval):**
```
streamText({ model, messages, tools, stopWhen: stepCountIs(1) })
  → fullStream yields TextStreamPart events
  → Inline loop translates to StreamEvent
  → ChatApp renders text chunks + pending tool cards
  → On approval: ToolExecutor runs, result added to messages
  → streamText called again (next step)
```

### StreamEvent Union (`src/agent/types.ts`)

```typescript
type StreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; call: ToolCall }
  | { type: 'tool-result'; callId: string; result: ToolResult }
  | { type: 'tool-error'; callId: string; error: string }
  | { type: 'step-finish'; step: number }
  | { type: 'finish'; reason: string }
  | { type: 'error'; message: string };

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  success?: boolean;
  content?: string;
  error?: string;
  path?: string;
}
```

### Implementation in `api.ts`

```typescript
public async *streamChatWithTools(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  tools: Record<string, { description: string; parameters: z.ZodTypeAny }>,
  signal?: AbortSignal,
): AsyncIterable<StreamEvent> {
  const model = createLanguageModel(getActiveProviderProfile(this.settings));
  if (!model) throw new Error('Chat client is not initialized.');

  const result = streamText({
    model,
    messages,
    tools,
    stopWhen: stepCountIs(1),
    abortSignal: signal,
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-delta':
        yield { type: 'text-delta', text: part.text };
        break;
      case 'tool-call':
        yield { type: 'tool-call', call: { id: part.toolCallId, name: part.toolName, args: part.args } };
        break;
      case 'tool-result':
        yield { type: 'tool-result', callId: part.toolCallId, result: part.result as ToolResult };
        break;
      case 'tool-error':
        yield { type: 'tool-error', callId: part.toolCallId, error: part.error };
        break;
      case 'text-end':
        yield { type: 'step-finish', step: 0 };
        break;
    }
  }

  yield { type: 'finish', reason: 'done' };
}
```

**Note**: Exact property names on `part` (e.g. `toolCallId`, `toolName`, `args`) depend on the SDK's `TypedToolCall` type. We verify these at compile time against the installed version.

---

## Chat UI: Pending Tool Cards

### `PendingToolCard.tsx` (`src/components/PendingToolCard.tsx`) - ✅ IMPLEMENTED

Dedicated component for tool call approval UI. Extracted from inline JSX in `ChatApp.tsx`.

**Features:**
- Summarizes each of the 13 tools with friendly icons and metadata:
  - `read_note` → 📖 Read Note
  - `edit_note`/`create_note`/`append_to_note` → line count, char count, preview excerpt (max 200 chars)
  - `patch_note` → Find/Replace rows with truncated text
  - `edit_section` → Section heading + preview
  - `search_notes` → Query display
  - `create_folder` → 📁 folder path
  - `move_note` → From → To arrow
  - `delete_note` → 🗑️ warning styling
  - `list_folders` → Parent path
- Sticky Approve/Reject buttons at bottom of scrollable card
- Scrollable content area with `max-height` constraint

**Props:**
```typescript
interface PendingToolCardProps {
  toolCall: ToolCall;
  onApprove: () => void;
  onReject: () => void;
}
```

---

## Tool Call Notification Display — T13b ✅ COMPLETE

### `ToolCallNotification.tsx` — Detail View Rendering (2026-08-28)

The `ToolCallDetail()` function renders expanded tool result details in chat
history. After T13b, all tools show meaningful detail via a smart fallback
chain.

### Exact Display Per Tool

| Tool | Inline Summary (Collapsed) | Expanded Detail View |
|------|---------------------------|----------------------|
| `read_note` | ✓ Read note `path` | First 500 chars of content + `…` if truncated |
| `edit_note` | ✓ Edited note `path` | Affected path: `path` |
| `append_to_note` | ✓ Appended to note `path` | Affected path: `path` |
| `patch_note` | ✓ Patched note `path` | Affected path: `path` |
| `create_note` | ✓ Created note `path` | Affected path: `path` |
| `move_note` | ✓ Moved note `from → to` | Path change: `oldPath → path` |
| `delete_note` | ✓ Deleted note `path` | Deleted path: `path` |
| `edit_section` | ✓ Edited section `path — "heading"` | Affected path: `path` |
| `create_notes` | ✓ Created notes `N created · M skipped` | List of created paths + skipped paths |
| `search_notes` | ✓ Searched notes `Query: "…"` | Matches table: `[[basename]]` + size |
| `search_note_content` | ✓ Searched note content `Query: "…"` | Matches table: `[[basename]]` + size |
| `list_notes` | ✓ Listed notes | Table of `[[basename]]` + size |
| `list_folders` | ✓ Listed folders | Bullet list of folder names |
| `get_note_metadata` | ✓ Got metadata `path` | Size, words, created, modified dates |
| `web_search` | ✓ Web search `path` | Result count header + first 500 chars of results |
| `read_pdf` | ✓ Read pdf `path` | First 500 chars (includes page range header) |
| `read_web_page` | ✓ Read web page `path` | First 500 chars of page content |
| `read_memory` / `search_memories` | ✓ read memory / search memories | First 500 chars of content |

### Fallback Chain (in order)

1. **Error?** → Red error text
2. **`read_note` + `content`** → 500-char preview
3. **`search_notes` or `search_note_content` + `matches`** → Table of `[[basename]]` + size
4. **`list_notes` + `notes`** → Table of `[[basename]]` + size
5. **`list_folders` + `folders`** → Bullet list
6. **`get_note_metadata`** → Size, words, dates
7. **`create_notes`** → "Created N notes" + skipped list
8. **`web_search` + `content`** → "N of total results for 'query'" + preview
9. **`result.content`** → 500-char preview (catches read_pdf, read_web_page, memory tools)
10. **`result.path`** → Path (with `oldPath → path` for moves)
11. **`result.matches`** → Matches table (fallback for future tools)
12. **Nothing matched** → "{tool_name} completed successfully"

### Implementation

**File:** `src/components/presentational/ToolCallNotification.tsx`

Two changes:
1. `search_note_content` shares `matches[]` table rendering with `search_notes`
2. Generic fallback chain added before final catch-all:
   - `result.content` → truncated preview (500 chars)
   - `result.path` → affected path (with `oldPath → path` for moves)
   - `result.matches` → matches table
   - Else → generic success text

**Impact:** ~10 tools now show meaningful detail. Future tools returning `content`, `path`, or `matches` auto-render without code changes.

**Owner:** T13b

---

## Approval Flow

### autoApply = false (default)

```
LLM emits tool-call event
  → ChatApp pauses loop (stops consuming further events)
  → Renders pending tool UI inline
  → User clicks [Approve]
      → ToolExecutor.execute(call)
      → Store result in conversation history
      → streamText called again (next step)
  → User clicks [Reject]
      → Skip execution
      → Feed rejection message back to LLM
      → streamText called again
```

### autoApply = true

```
LLM emits tool-call event
  → ToolExecutor.execute(call) immediately
  → Show brief Notice ("✓ Edited Vocabulary Log")
  → Result appended to messages
  → streamText called again automatically
```

---

## System Prompt Design

The system prompt is built dynamically based on context and tool availability. **Critical lesson**: The prompt must explicitly list every tool by name and purpose. The AI said "I cannot search" because an earlier prompt vaguely said "search Obsidian notes" instead of naming `search_notes` and `list_notes`.

### Current System Prompt (excerpt)

```
You have access to the following tools for managing Obsidian notes:
- read_note: Read the full content of a note. Use this before editing to understand current content.
- edit_note: Overwrite the entire content of a note. Provide COMPLETE new content.
- append_to_note: Add content to the end of a note without changing existing content.
- create_note: Create a new note in the vault.
- patch_note: Find and replace text inside a note (small precise edits).
- edit_section: Rewrite content under a specific heading.
- search_notes: Search for notes by filename or path. Use sort_by=name|modified|created, limit, folder, and search_content params.
- list_notes: Browse all notes in the vault or a folder. Use sort_by=name|modified|created and limit params.
- get_note_metadata: Get file stats (size, dates, word count) for a specific note.
- create_folder: Create a new folder in the vault.
- move_note: Move or rename a note to a new folder or name. Creates parent folders if needed.
- delete_note: Delete a note from the vault.
- list_folders: List folders in the vault. Use to understand vault structure.

When the user asks to find, list, or search for notes, ALWAYS use search_notes or list_notes first.
Do not say you cannot search - you have the search_notes and list_notes tools.
Before editing a note you are unfamiliar with, use read_note to see its current content.

Important: When using edit_note, provide the COMPLETE new note content. Do not use diff syntax or markdown code blocks.

For moving notes: use move_note(path, new_path). Parent folders are created automatically if needed.
For creating folders: use create_folder(path). Then use move_note to place notes inside.
```

### Lessons Learned

1. **System prompt clarity >> brevity** - Explicitly enumerate tools by name. Vague descriptions cause the AI to claim it lacks capabilities.
2. **Tool result rendering is a UI problem** - Raw JSON in chat messages is unreadable. A formatting layer (`formatToolResult()`) converts structured data into markdown tables/lists/summaries before the LLM sees it.
3. **Pending approval UI needs constraints** - Full content dump makes buttons unreachable. Summary cards with max-height + sticky actions are essential.
4. **Three-tier `resolveNote()` handles most LLM path mistakes** - exact → `.md` → `metadataCache.getFirstLinkpathDest()`. The LLM rarely gets paths exactly right.
5. **TypeScript `ToolResult` must stay ahead of return shapes** - Add optional fields for each new tool (`oldPath` for move, `folders`/`parent` for list_folders).

---

## Provider Compatibility

| Provider | Tool Calling | Notes |
|---|---|---|
| OpenAI | ✅ GPT-4, GPT-4o, GPT-3.5 | Full support |
| Anthropic | ✅ Claude 3.5 Sonnet, Claude 3 Opus | Full support |
| Google Gemini | ✅ Gemini 1.5 Pro, Gemini 2.0 Flash | Full support |
| DeepSeek | ✅ DeepSeek V3, DeepSeek R1 | Full support |
| OpenRouter | ✅ | Pass-through to underlying model |
| Ollama | ⚠️ Model-dependent | Llama 3.1+, Qwen 2.5+, Mistral Nemo work; older models may fail |
| Custom | ⚠️ Depends on endpoint | Check if endpoint supports OpenAI-compatible function calling |

**Fallback**: If the active provider does not support tool calling, `streamChat` falls back to the current text-only mode with the standard system prompt.

---

## Settings Schema

Add to `ObsidianAISettings`:

```typescript
interface ObsidianAISettings {
  // ... existing settings ...

  enableAgentTools: boolean;    // default: true
  autoApply: boolean;           // default: false
  maxAgentSteps: number;        // default: 5
}
```

**UI copy:**
- **Enable agent tools**: "Allow the AI to read, edit, create, and append to notes directly."
- **Auto-apply edits**: "Apply note edits automatically without asking for confirmation. (Not recommended for important notes.)"
- **Max agent steps**: "Maximum number of tool call rounds per message. Higher values allow more complex multi-step reasoning."

---

## Files to Create / Modify

| File | Action | Description |
|---|---|---|
| `src/agent/AgentLoop.ts` | **Create** | Orchestrates multi-step streamText calls; callback interface; `formatToolResult()` |
| `src/components/PendingToolCard.tsx` | **Create** | UI for approve/reject with content preview for all 13 tools |
| `src/agent/types.ts` | **Create** | `StreamEvent` union, `ToolCall`, `ToolResult` types |
| `src/agent/tools.ts` | **Create** | Zod tool definitions (13 tools, schemas only, no execute) |
| `src/agent/ToolExecutor.ts` | **Create** | Executes tool handlers against vault; `resolveNote()`, `patchNote()`, `editSection()` |
| `src/api.ts` | **Modify** | Add `streamChatWithTools` method; keep `streamChat` for fallback |
| `src/components/ChatApp.tsx` | **Modify** | Creates AgentLoop, renders PendingToolCard, handles StreamEvent union |
| `src/components/ActionBar.tsx` | **Modify** | Auto-approve toggle button (🤖/🔒) |
| `src/settings.ts` | **Modify** | Add `enableAgentTools`, `autoApply`, `maxAgentSteps` |
| `src/views/ObsidianAIChatView.ts` | **Modify** | Add `saveSettings()` to `ChatPluginLike` interface |
| `styles.css` | **Modify** | Pending tool call approval card styles, auto-approve button styles |

---

## Risks & Mitigations

| Risk | Mitigation | Status |
|---|---|---|
| LLM hallucinates tool arguments | Zod validation on incoming args; error fed back to model | ✅ Working |
| Infinite tool loops | `maxAgentSteps` hard cap (default 5) in AgentLoop | ✅ Working |
| File overwrites without warning | `edit_note` only modifies existing files; `create_note` checks for existence | ✅ Working |
| Vault path traversal | `resolveNote()` validates paths via Obsidian's own APIs | ✅ Working |
| Basename resolution fails | Three-tier fallback: exact → `.md` → `metadataCache.getFirstLinkpathDest()` | ✅ Working |
| Streaming abort mid-tool | AbortController passed to streamText; AgentLoop checks signal | ✅ Working |
| Model doesn't support tools | Graceful fallback to text-only `streamChat` mode | ✅ Working |
| Large note content in tool args | No inherent size limit, but token budget still applies | ⚠️ Monitor |
| SDK v7 changes `fullStream` API | Only `api.ts` changes - `StreamEvent` union insulates the rest | ✅ Design |
| Native renderer crash on streaming | `scrollIntoView({ behavior: "auto" })`, unmount cleanup, ErrorBoundary | ✅ Applied |
| AI claims it cannot do X | System prompt must explicitly list all tools by name | ✅ Fixed |
| Raw JSON in chat responses | `formatToolResult()` converts to markdown before LLM sees it | ✅ Fixed |
| Approval buttons unreachable | PendingToolCard uses `max-height` + sticky actions | ✅ Fixed |

---

## Simpler Alternative (XML Parser) - Rejected

If the full tool calling architecture is too heavy for v1, an intermediate step is:

1. System prompt: *"Wrap complete edited note content in `<edit-note path="...">...</edit-note>`"*
2. After streaming completes, regex-parse the response for XML tags
3. Show single "Apply this edit?" confirmation
4. Execute `vault.modify`

**Trade-off**: Less robust (LLM may not follow XML format reliably). Rejected in favour of native tool calling for long-term reliability.

---

## Tool Result Formatting Implementation

### Model replay policy (T48b, 2026-08-23)

Tool results have two audiences: the UI/export path may retain the full result,
while model history must use a bounded canonical representation. Large results
such as broad memory listings should be summarized, truncated with an explicit
marker, or referenced externally. Request serialization must not replay the same
result through both `contentParts` and legacy `toolCalls`.

Location: `src/agent/AgentLoop.ts` - `formatToolResult(toolName, result)`

### search_notes / list_notes → Markdown Table

```markdown
Found 3 notes:

| Note | Modified | Size |
|------|----------|------|
| [[Project Notes]] | 5/14/2026 | 1240 |
| [[Meeting Notes]] | 5/13/2026 | 890 |
| [[Draft]] | 5/12/2026 | 450 |
```

### list_folders → Bulleted List

```markdown
4 folders under (root):

- Research
- Meeting Notes
- Archive
- Templates
```

### get_note_metadata → Formatted Summary

```markdown
**[[Project Notes]]**

- Size: 1240 bytes
- Created: 5/10/2026, 9:00:00 AM
- Modified: 5/14/2026, 2:30:00 PM
- Words: 245
```

### read_note → Clean Content

No JSON wrapper - raw note content passed directly.

### edit/create/move/delete → Success Text

```
✓ edit note completed successfully.
```

### Error Handling

All errors formatted as:
```
Error: Note not found: Project Notes
```

**Why this matters**: Before `formatToolResult()`, the LLM received raw JSON like `{"matches":[{"path":"...","basename":"..."}]}` and sometimes dumped it verbatim in chat. Now it receives readable markdown and responds naturally.

---

## 2026-05-15: Tool Result Fixes

### Full Path Rendering

`list_notes`, `search_notes`, and `get_note_metadata` previously rendered wiki-links using only the basename (e.g., `[[Papers]]`). In vaults with duplicate basenames across folders, the LLM could not distinguish `Research/Papers.md` from `Daily/Papers.md`.

**Fix**: All wiki-links now include the full folder path:
```
| Note | Modified | Size |
|------|----------|------|
| [[Research/Papers]] | May 15 | 2KB |
| [[Daily/Papers]] | May 14 | 1KB |
```

Files changed: `src/agent/AgentLoop.ts` (`formatToolResult`)

### `search_content` Parameter Removed

The `search_notes` tool had a `search_content: boolean` parameter claiming to search inside note bodies. The implementation silently returned `false` for all content matches, never actually reading file contents:

```typescript
if (searchContent) {
    // Note: content search is expensive; we'll read and check
    // For now, skip content search to avoid I/O blocking
    return false;
}
```

This misled the LLM into believing it could search content when it couldn't.

**Fix**: Removed `search_content` from the Zod schema and tool description. Search now only matches against filename and path (which is what actually worked).

Files changed: `src/agent/tools.ts`, `src/agent/ToolExecutor.ts`

### `list_folders` Depth Consistency

`list_folders()` with no args returned only top-level folders (depth 1). But `list_folders({path: "Research"})` returned the **entire subtree** under Research at any depth. This was inconsistent and often returned too many paths.

**Fix**: Both modes now return only immediate children (depth 1 relative to the query point):
- `list_folders()` → top-level folders only
- `list_folders({path: "Research"})` → immediate subfolders of Research only

Files changed: `src/agent/ToolExecutor.ts`

### Ambiguity Detection in `resolveNote`

When multiple notes share the same basename (e.g., `Research/Papers.md` and `Daily/Papers.md`), `metadataCache.getFirstLinkpathDest()` returns the first match without warning. The agent silently reads the wrong note.

**Fix**: After resolving a note, `resolveNote()` checks if other files share the same basename. If ambiguous, it attaches a `__ambiguous` array to the file object. `readNote()` detects this and returns a `warning` field in the `ToolResult`.

The `formatToolResult()` function surfaces the warning as a blockquote in the LLM's context:

```
> ⚠️ Ambiguous name: 2 notes share the basename "Papers". Reading "Research/Papers.md".
> Other matches: Daily/Papers.md. Use the full path (e.g., "Folder/Papers") to target a specific note.
```

A `warning?: string` field was added to the `ToolResult` interface for this purpose.

Files changed: `src/agent/ToolExecutor.ts`, `src/agent/AgentLoop.ts`, `src/agent/types.ts`

---

## 2026-05-15: Session Auto-Naming Fixes

### Bug 1: `replace()` Missing `g` Flag

`generateSessionTitle()` in `ChatApp.tsx` stripped `<context>` tags using:

```typescript
const clean = text.replace(/<context>[\s\S]*?<\/context>/, "").trim();
//                                    ↑ no 'g' flag
```

With multiple context items (e.g., `<context>A.md</context> <context>B.md</context> question`), only the first tag was removed. The second context tag leaked into the generated title:

```
Title: "B.md</context> question"
```

**Fix**: Added `g` flag: `.replace(/.../g, "")` — now all context tags are stripped.

### Bug 2: User Message Threshold Too High

Auto-naming only fired when `userMsgs.length >= 2`:

```typescript
const userMsgs = session.messages.filter((m) => m.role === "user");
if (userMsgs.length >= 2) {   // ← most sessions never hit this
    const title = generateSessionTitle(session.messages);
```

Since `generateSessionTitle()` only looks at the **first** user message anyway, requiring 2 messages was unnecessary. Most single-message sessions (especially those that end after one exchange) never got named.

**Fix**: Lowered to `>= 1` — session named after the first user message.

### Bug 3: Date Fallback Blocked Naming

The auto-title code refused to apply titles that were just the date fallback:

```typescript
if (title && title !== `Chat ${new Date().toLocaleDateString()}`) {
```

This meant sessions with empty or context-only first messages (where `generateSessionTitle()` returns the date) stayed permanently untitled.

**Fix**: Removed the date-fallback guard. Any generated title is better than an empty one — at least the date gives *some* identifier.

### Bug 4: Sidebar Computed Title Hid the Problem

`SessionPickerModal` computed `displayTitle` on the fly from first message content, making it *look* like sessions had names when `session.title` was actually empty:

```typescript
const displayTitle =
    session.title ||   // ← always empty for auto-named sessions
    (firstUserMsg ? firstUserMsg.content.slice(0, 40) + "…"
        : `Chat ${new Date(session.createdAt).toLocaleDateString()}`);
```

**Fix**: Now `session.title` is properly populated by the auto-name logic, so the fallback is only used for truly empty sessions.

### Smart Title Generation

The original `generateSessionTitle()` was primitive — just first 40 characters:

```typescript
// Before: "Please can you summarize my notes about quantum gravity and string theory..."
// → "Please can you summarize my notes about qua…"
```

**Rewritten** to be much smarter:
- Extracts **first sentence** (up to `. ! ? \n`) instead of raw first 40 chars
- Strips markdown links `[text](url)` → `text`, inline code `` `code` `` → `code`
- Removes leading stop words: "Please", "Can you", "Could you", "Hey", "Hi", "So", "Um"...
- Capitalizes first letter
- Truncates at **word boundary** with `…` (not mid-word)

```typescript
// After: "Please can you summarize my notes about quantum gravity and string theory?"
// → "Summarize my notes about quantum gravity and string theory"
```

### v3: Context-Aware Naming + Toggle Reactivity

**Problem 1**: Toggle buttons didn't update visually on click — only after a chat message caused re-render. `handleToggleAutoApprove` and `handleToggleAutoName` mutated `plugin.settings` directly without any React state update.

**Fix**: Added local React state in ChatApp.tsx:
```typescript
const [autoApprove, setAutoApprove] = useState(plugin.settings.autoApply);
const [autoNameSessions, setAutoNameSessions] = useState(plugin.settings.autoNameSessions);
```
Toggle handlers now call `setAutoApprove(newValue)` / `setAutoNameSessions(newValue)` immediately, so the ActionBar re-renders with the new `is-active` class right away.

**Problem 2**: Title generation used only the first user message, missing important context from the assistant's response.

**Fix**: `generateSessionTitle()` now takes the **first 2 user messages + first 2 assistant replies**, interleaving them. Additional cleanup strips block code (```...```) and JSON objects from assistant messages. Auto-naming now fires when `userMsgs >= 1` **AND** `assistantMsgs >= 2`.

**Problem 3**: Toggle buttons looked identical to regular buttons when OFF.

**Fix**: CSS adds `border-style: dashed` and `opacity: 0.7` to `.chat-icon-btn:not(.is-active)`. When OFF: subtle dashed border. When ON: solid accent-colored background. Hovering an OFF toggle removes the opacity and switches to solid border.

**Problem 4**: Manual rename button used pencil icon (✏️).

**Fix**: Changed to wand icon (🪄).

**Files changed**: `src/components/ChatApp.tsx`, `src/components/ActionBar.tsx`, `styles.css`

---

## 2026-05-23: Context Overload Fix + Tool Enhancements

### Problem: Folder Context Token Bloat

When a folder or tag was attached as context (via `+` button in ChatInput), `ContextEngine.ts` read the **full contents of every file** in that folder/tag and inlined them into the system prompt. For large folders (e.g., a research folder with 50+ notes), this caused:
- Context window exhaustion (85%+ tokens)
- Agent stuck in read loops, unable to proceed
- Session compaction and unresponsiveness

**Example**: Attaching a folder with 30 notes × 2KB each = 60KB of raw text injected into the prompt.

### Solution: File Listings + Tool Instructions

Folder and tag context items now return a **structured file listing with tool-usage instructions** instead of full file contents:

```
<folder path="Research/LQG">
The following notes are available in this folder.
Use list_notes(folder: "Research/LQG") to see all files.
Use read_note(path: "Research/LQG/Note Name") to read a specific note.
</folder>
```

**Key change**: The LLM is instructed to use `list_notes` or `read_note` if it needs specific file contents. This keeps the context compact while preserving discoverability.

**Files changed**: `src/context/ContextEngine.ts`

---

### Enhancement: `list_notes` Subfolder Support

**New parameters**:
- `include_subfolders` (boolean, default `true`) — whether to recurse into subfolders
- `depth` (number, default `1`, max `3`) — recursion depth limit

**New return field**: `subfolders` array alongside `files`

**Example result**:
```json
{
  "files": ["Note A.md", "Note B.md"],
  "subfolders": ["Subfolder 1", "Subfolder 2"],
  "total": 2,
  "folder": "Research"
}
```

This gives the LLM visibility into folder structure without needing a separate `list_folders` call.

**Files changed**: `src/agent/tools.ts` (Zod schema), `src/agent/ToolExecutor.ts` (implementation)

---

### Fix: `count_notes` Accuracy Breakdown

**Problem**: `count_notes` previously returned a single `count` number that was ambiguous — it wasn't clear if this included subfolder files or only direct files.

**Solution**: Five distinct counts with clear semantics:

| Field | Meaning |
|-------|---------|
| `totalCount` | All files recursively (including subfolders) |
| `markdownCount` | All `.md` files recursively |
| `directCount` | Files directly in the queried folder |
| `directMarkdownCount` | `.md` files directly in the queried folder |
| `subfolderCount` | Number of immediate subfolders |

**Example formatted result**:
```
📊 Note Count for "Research/LQG":
- Total files (recursive): 47
- Markdown files (recursive): 42
- Direct files in folder: 12
- Direct markdown files: 10
- Subfolders: 3
```

This prevents the LLM from being misled by large recursive counts when asking about a specific folder.

**Files changed**: `src/agent/ToolExecutor.ts`

---

### System Prompt Updates

`buildSystemPrompt()` in `ChatApp.tsx` now describes the enhanced capabilities:
- Mentions `list_notes` with `include_subfolders` and `depth` parameters
- Describes the `count_notes` breakdown so the LLM knows to use it for folder statistics
- Reinforces the pattern: "For folders with many files, use list_notes first instead of reading all contents"

**Files changed**: `src/components/ChatApp.tsx`

---

## Tool Call Context Persistence Bug Fix (2026-08-16)

### Problem

When the agent used tool calls in multi-turn conversations, the **results of those tool calls were not passed as context** to subsequent API calls. The LLM would completely forget that a tool had executed and what it returned.

**Symptoms**:
- Agent asking to search again after already searching
- Agent being unaware of note contents it just read
- Broken multi-turn agent conversations

### Root Cause

In `src/hooks/useMessageActions.ts`, the message history was built by only including text content:

```typescript
const history = messagesRef.current
    .slice(-maxContextMessages)
    .map((m) => ({
        role: m.role as "user" | "assistant",
        content: buildReplayContent(m),  // ← ONLY text, no tool context
    }));
```

The `buildReplayContent()` function stripped all `toolCalls` and `contentParts` from prior assistant messages. The LLM received only plain text like "I'll search your notes" with zero awareness that `search_notes` had already executed and returned results.

### Why This Matters

The Vercel AI SDK requires tool calls and results to be passed as **separate messages** in a specific shape:

```
Assistant: [text part, tool-call part, text part, tool-call part]
Tool:      [tool-result part, tool-result part]
User:      "summarize what you found"
```

Without the tool-result messages, the LLM has no context about prior tool executions.

### The Fix

Created `buildHistoryWithTools()` that reconstructs the full SDK message shape from persisted `ChatMessage` data:

**For assistant messages with tool calls**:
1. Creates `role: "assistant"` message with `[text, tool-call, text, tool-call, ...]` parts
2. Creates `role: "tool"` message with `[tool-result, tool-result, ...]` parts

**Fallback handling**:
- Uses `contentParts` (interleaved format) when available
- Falls back to `toolCalls` array for older messages
- Plain text messages pass through unchanged

**Key code**:
```typescript
function buildHistoryWithTools(
    messages: ChatMessage[],
    maxMessages: number,
): Array<{ role: "user" | "assistant" | "tool"; content: any }> {
    // Reconstructs Vercel AI SDK-compatible messages
    // from ChatMessage.contentParts / ChatMessage.toolCalls
}
```

### Files Changed

- `src/hooks/useMessageActions.ts` — Replaced history building (+159 lines, -9 lines)

### Verification

- Build passes
- All 236 tests pass
- User confirmed fix works in practice

### Lesson Learned

When building message history for API calls, **always include full tool execution context**. The LLM needs to know *what* tools were called and *what they returned*, not just the final text output. Persisting `contentParts` (interleaved text + tool calls with results) enables accurate history reconstruction.

---

## Planned External Tool Providers (2026-08-05)

External Obsidian-plugin capabilities will not be registered by directly
calling private plugin fields from this tool layer. [T39](../tasks/T39.md)
defines a versioned Integration Provider API: an installed peer provider owns
its domain operations and credentials, while this agent layer owns model tool
registration, approval, policy, result rendering, and audit logging. Obsidian
Git is the first planned provider; its public Git operations will be adapted as
bounded namespaced tools such as `git.status`, not as arbitrary shell commands.
See [Integration Provider API](integration-provider-api.md).

*Last Updated: 2026-08-05 17:28 IST*

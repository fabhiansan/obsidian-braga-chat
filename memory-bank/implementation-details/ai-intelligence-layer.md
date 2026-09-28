# AI Intelligence Layer — Implementation Details

*Created: 2026-07-21 21:50 IST*  
*Last Updated: 2026-09-28 12:35:16 IST*
*Tasks: [T26](../tasks/T26.md), [T65](../tasks/T65.md)*

> **Current implementation note:** This is the canonical overview of the
> intelligence layer. Some examples below describe the historical flat-memory
> implementation; the current memory architecture is documented in the T65
> section below.

---

## Overview

This document details the implementation of the AI Intelligence Layer for obsidian-ai — the system that transforms the plugin from a stateless chat UI into a context-aware agent with persistent identity, memory creation, cross-session retrieval, and plugin bridging.

**Core principle:** The AI must be both a *consumer* and *producer* of context. It reads memory at session start and writes memory during/after sessions. This feedback loop is what creates the illusion (and reality) of intelligence.

### Current implementation status

- `PersonaLoader` provides persona and persistent-memory context.
- `ThreeTierMemoryStore` is the active store; legacy `MemoryStore` remains for
  migration and compatibility.
- CRUD, prompt injection, staged evaluation, core culling, ranked archive
  search, and session-end curation use the tiered store.
- Migration and backup-cleanup state are recorded in
  `intelligence/memory-metadata.json`; historical operations remain in
  `memory-audit.jsonl`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ObsidianAIPlugin                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ PersonaLoader│  │ MemoryStore │  │ SessionSummarizer   │  │
│  │             │  │             │  │                     │  │
│  │ persona.md  │  │ memory.md   │  │  ┌───────────────┐  │  │
│  │ (static)    │  │ (dynamic)   │  │  │ memory.db     │  │  │
│  └──────┬──────┘  └──────┬──────┘  │  │ (structured)  │  │  │
│         │                │         │  └───────────────┘  │  │
│         └────────────────┴─────────┘                     │  │
│                          │                               │  │
│              ┌───────────┴───────────┐                   │  │
│              │   ContextRetriever    │                   │  │
│              │   (cross-session)     │                   │  │
│              └───────────┬───────────┘                   │  │
│                          │                               │  │
│              ┌───────────┴───────────┐                   │  │
│              │   Plugin Bridges      │                   │  │
│              │  Dataview/Tasks/...   │                   │  │
│              └───────────────────────┘                   │  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     AgentLoop                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ create_mem  │  │ search_past │  │ dataview_query      │  │
│  │ ory         │  │ _sessions   │  │ tasks_query         │  │
│  │             │  │             │  │ templater_run       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Storage Layout

All intelligence files live in the **plugin directory**, never the vault:

```
.obsidian/plugins/obsidian-ai/
├── sessions/                    # T24 — JSONL chat logs
│   ├── {uuid}.jsonl
│   └── ...
├── intelligence/               # T26 — AI memory & identity
│   ├── persona.md              # Static AI identity
│   ├── memory.md               # Dynamic long-term memory
│   ├── memory.db               # SQLite structured memory (optional)
│   └── sessions-meta/          # Session summaries
│       ├── {uuid}-summary.md
│       └── ...
└── ...
```

**Why plugin directory, not vault?**
- User notes stay clean — no AI metadata mixed with their work
- Git-friendly — plugin data can be .gitignored separately
- Obsidian's file watcher won't trigger on AI metadata changes
- Plugin has guaranteed read/write access via `app.vault.adapter`

### Current tiered-memory files (T65)

Within `intelligence/`, the active memory files are:

| File | Purpose |
|---|---|
| `persona.md` | User-editable persistent persona |
| `core.json` | High-value memories loaded into the system prompt |
| `staged.json` | Newly created memories awaiting evaluation |
| `archive.json` | Older memories retained for search |
| `memory-metadata.json` | Current schema, migration, tier counts, and backup-cleanup state |
| `memory-audit.jsonl` | Historical memory operations and curation events |
| `memory.json` / `memory.md` | Legacy flat-memory files used as migration input or compatibility fallback |

The core limit is configurable as Small (50), Medium (100), or Large (200).
The identity-context budget limits how much persona plus core memory enters the
system prompt. New memories enter `staged`; `evaluate_staged` promotes strong
entries to core, while `cull_core` moves weak core entries to archive.

### Legacy migration and backup retention

On intelligence initialization, legacy `memory.md` is first converted to
`memory.json` when necessary. Legacy entries are then distributed into core and
archive according to their scores, with staged initially empty. The migration
is idempotent and recorded in `memory-metadata.json`.

Legacy timestamped backup snapshots are bounded by the configured retention
setting (Off, 10, 20, or 50 generations). Fixed `.bak` recovery files and all
tier files are preserved. Cleanup occurs only after a successful write or
during initialization; it does not delete memories.

### Current memory tools and hooks

The agent can use `create_memory`, `update_memory`, `delete_memory`,
`list_memories`, `search_memories`, `evaluate_staged`, and `cull_core`.
Archive searches use the lightweight ranked index, and staged evaluation is
triggered automatically after session summarization when enabled.

---

## Phase 1: Persistent Identity & Memory

### PersonaLoader

**File:** `src/intelligence/PersonaLoader.ts`

```typescript
interface PersonaLoaderDeps {
  app: App;
  manifest: { id: string };
  logger?: FileLogger;
}

export class PersonaLoader {
  private deps: PersonaLoaderDeps;
  private readonly intelligenceDir: string;
  private readonly personaPath: string;
  private readonly memoryPath: string;

  constructor(deps: PersonaLoaderDeps) {
    this.deps = deps;
    this.intelligenceDir = `${deps.app.vault.configDir}/plugins/${deps.manifest.id}/intelligence`;
    this.personaPath = `${this.intelligenceDir}/persona.md`;
    this.memoryPath = `${this.intelligenceDir}/memory.md`;
  }

  async ensureDefaults(): Promise<void> {
    // Create intelligence/ and default persona.md if missing
  }

  async loadPersona(): Promise<string> {
    // Read persona.md, return content or empty string
  }

  async loadMemory(options?: { maxTokens?: number }): Promise<string> {
    // Read memory.md, return content truncated to token budget
    // If memory.md > budget, return last N entries (newest first)
  }

  async loadFullContext(options?: { maxTokens?: number }): Promise<string> {
    // Combines persona + memory with separator
    // Returns string ready to prepend to system prompt
  }
}
```

### Default persona.md

```markdown
# AI Persona

You are a helpful research assistant integrated into Obsidian.
You help the user organize thoughts, analyze notes, and connect ideas.

## Communication Style
- Be concise. Prefer short answers unless detail is requested.
- Use wiki-links [[Note Name]] when referencing vault notes.
- When asked to edit notes, return ONLY the complete new content.

## Rules
- Before editing a note you haven't seen, read it first.
- When the user mentions something from a past conversation, use search_past_sessions.
- Create memories when the user shares personal facts, preferences, or project updates.
```

### System Prompt Integration

**File:** `src/lib/systemPrompt.ts`

```typescript
export async function buildSystemPrompt(
  contextItems: ContextItem[],
  personaLoader: PersonaLoader,  // NEW param
  slashCmd?: SlashCommand,
  toolsEnabled = false,
): Promise<string> {
  // Load identity context first
  const identityContext = await personaLoader.loadFullContext({ maxTokens: 2000 });

  let prompt = identityContext + "\n\n";
  prompt += "You are a helpful assistant integrated into an Obsidian note-taking app.";

  // ... rest of existing logic ...

  return prompt;
}
```

**Token budget strategy:**
- Total identity context (persona + memory) capped at configurable limit (default: 2000 tokens)
- Persona always included in full (typically ~200-500 tokens)
- Memory truncated from the bottom (oldest entries dropped first)
- Future: AI-summarize old memories into a compressed "memory summary"

---

## Phase 2: Session Memory Creation

### create_memory Tool

**Tool definition** (`src/agent/tools.ts`):

```typescript
export const createMemoryTool = t({
  description:
    "Create a persistent memory about the user, their preferences, " +
    "projects, or insights from the conversation. " +
    "Use when the user shares something worth remembering for future sessions. " +
    "Examples: 'I prefer Julia over Python', 'My QHE paper is due next month', " +
    "'I have two children', 'I work on loop quantum gravity'." +
    "Be specific and concise. Include dates when relevant.",
  inputSchema: z.object({
    category: z
      .enum(["user_fact", "project", "preference", "insight", "reference"])
      .describe(
        "user_fact = personal info about user; " +
        "project = ongoing work/project; " +
        "preference = likes/dislikes/work style; " +
        "insight = interesting realization; " +
        "reference = paper/book/link worth remembering"
      ),
    content: z
      .string()
      .describe("The memory content — specific, concise, future-readable"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for filtering, e.g. ['physics', 'qhe', 'family']"),
  }),
});
```

**ToolExecutor behavior** (`src/agent/ToolExecutor.ts`):

```typescript
case "create_memory": {
  const { category, content, tags } = call.args;
  const timestamp = new Date().toISOString().split("T")[0];
  const tagStr = tags ? " " + tags.map((t) => `#${t}`).join(" ") : "";
  const entry = `- [${timestamp}] **${category}**: ${content}${tagStr}\n`;

  // Append to memory.md
  const memoryPath = `${intelligenceDir}/memory.md`;
  await adapter.append(memoryPath, entry);

  // Also write to SQLite if DB available
  if (db) {
    await db.run(
      `INSERT INTO memories (timestamp, category, content, tags) VALUES (?, ?, ?, ?)`,
      [timestamp, category, content, JSON.stringify(tags || [])]
    );
  }

  return { success: true, entry };
}
```

**memory.md format:**

```markdown
# AI Memory

Auto-generated from chat sessions. Do not hand-edit — use create_memory tool.

## Entries

- [2026-07-21] **user_fact**: Deepak has a PhD in Physics from Penn State (2003-2012) #physics #education
- [2026-07-21] **preference**: Prefers Julia over Python for numerical work #coding #julia
- [2026-07-21] **project**: Working on QHE-BHE correspondence paper — deadline flexible #physics #qhe
- [2026-07-21] **preference**: Stays up until 2am+ regularly, prefers night work #habits
```

### SessionSummarizer

**File:** `src/intelligence/SessionSummarizer.ts`

```typescript
export class SessionSummarizer {
  async summarizeSession(
    sessionId: string,
    messages: ChatMessage[],
    api: ChatApiManager
  ): Promise<MemoryEntry[]> {
    // Filter to user+assistant messages only (skip system, tool results)
    const chatMessages = messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );

    // Build summarization prompt
    const summaryPrompt = [
      { role: "system", content: "You extract memories from conversations." },
      { role: "user", content:
        "Summarize this conversation into 3-5 bullet points of things " +
        "worth remembering about the user or their work. " +
        "Format: CATEGORY: content (one per line). " +
        "Categories: user_fact, project, preference, insight.\n\n" +
        this.formatMessages(chatMessages)
      },
    ];

    // Call cheap model (use default profile but could use cheaper one)
    const response = await api.chat(summaryPrompt);

    // Parse response into MemoryEntry[]
    return this.parseSummary(response);
  }
}
```

**Trigger:** Called when:
1. User explicitly clicks "Save Memory" button
2. Session is closed (chat panel closed, Obsidian quit)
3. After N messages (configurable, default: every 20 messages)

---

## Phase 3: Cross-Session Retrieval

### ContextRetriever

**File:** `src/intelligence/ContextRetriever.ts`

```typescript
export class ContextRetriever {
  private searchIndex: SearchIndex;  // Reuses T24 SearchIndex

  async findRelevantSessions(
    query: string,
    limit = 3
  ): Promise<SessionSnippet[]> {
    // Use existing fuzzy search across session JSONL files
    const results = this.searchIndex.search(query);

    // Return top results with metadata
    return results.slice(0, limit).map((r) => ({
      sessionId: r.sessionId,
      title: r.sessionTitle,
      date: r.sessionDate,
      snippets: r.snippets,
    }));
  }

  async injectRelevantContext(
    messages: ChatMessage[],
    query: string
  ): Promise<ChatMessage[]> {
    // Check if query references past conversations
    if (!this.seemsReferential(query)) return messages;

    const relevant = await this.findRelevantSessions(query);
    if (relevant.length === 0) return messages;

    // Build context injection message
    const contextMsg = {
      role: "system" as const,
      content: this.formatSessionContext(relevant),
    };

    // Insert before user message
    return [...messages, contextMsg];
  }

  private seemsReferential(query: string): boolean {
    const patterns = [
      /remember when/i, /last time/i, /as we discussed/i,
      /my previous/i, /earlier you/i, /before we/i,
      /what did we/i, /yesterday we/i,
    ];
    return patterns.some((p) => p.test(query));
  }
}
```

### search_past_sessions Tool

```typescript
export const searchPastSessionsTool = t({
  description:
    "Search past chat sessions by topic, keyword, or content. " +
    "Use when the user references something from a previous conversation, " +
    "asks 'what did we say about X', or when you need historical context " +
    "to answer accurately.",
  inputSchema: z.object({
    query: z.string().describe("Search query — be specific"),
    limit: z
      .number()
      .optional()
      .describe("Max results to return (default: 5)"),
  }),
});
```

**ToolExecutor result formatting:**

Uses the existing `formatToolResult` in `AgentLoop.ts`:

```typescript
case "search_past_sessions": {
  const sessions = result.sessions ?? [];
  let md = `Found ${sessions.length} relevant session${sessions.length !== 1 ? "s" : ""}:\n\n`;
  for (const s of sessions) {
    md += `### ${s.title} (${s.date})\n`;
    for (const snippet of s.snippets) {
      md += `- "...${snippet}..."\n`;
    }
    md += "\n";
  }
  return md;
}
```

---

## Phase 4: Plugin Bridges

**Architecture update (2026-08-05):** This section is retained as historical
bridge exploration. The implementation target is now the versioned
[Integration Provider API](integration-provider-api.md) in T39, rather than
Obsidian AI directly accessing private fields of each third-party plugin. T39a
will provide host discovery, availability, policy, and audit routing; T39b
defines Obsidian Git as the first provider. Future Dataview, Tasks, and
Templater integrations must adopt that contract.

**Dataview status (2026-09-28):** T17a now provides a built-in, read-only DQL
query tool through Dataview's public query API. This does not implement the
planned T39 Dataview provider or complete T26 Phase 4. The bridge examples
below remain design samples; in particular, the DataviewJS example is not
implemented and DataviewJS is not executed by the current tool.

### Bridge Pattern

All bridges follow the same pattern:

```typescript
interface PluginBridge {
  readonly pluginId: string;
  readonly pluginName: string;
  isAvailable(app: App): boolean;
  getTools(): ToolDefinition[];
}

// In ToolExecutor:
async executeBridgeTool(bridge: PluginBridge, call: ToolCall): Promise<ToolResult> {
  if (!bridge.isAvailable(this.app)) {
    return {
      error: `${bridge.pluginName} is not installed. Install it from Community Plugins.`
    };
  }
  return bridge.execute(call);
}
```

### DataviewBridge

```typescript
export class DataviewBridge implements PluginBridge {
  readonly pluginId = "dataview";
  readonly pluginName = "Dataview";

  isAvailable(app: App): boolean {
    return !!app.plugins.plugins.dataview?.api;
  }

  getTools() {
    return [dataviewQueryTool];
  }

  async executeQuery(query: string, type: "dql" | "dataviewjs"): Promise<ToolResult> {
    const dataview = this.app.plugins.plugins.dataview;
    try {
      const result = type === "dql"
        ? await dataview.api.query(query)
        : await dataview.api.executeJs(query);
      return { success: true, result };
    } catch (err) {
      return { error: `Dataview error: ${err.message}` };
    }
  }
}
```

### TasksBridge

```typescript
export class TasksBridge implements PluginBridge {
  readonly pluginId = "obsidian-tasks-plugin";
  readonly pluginName = "Tasks";

  async listTasks(filters?: { status?: string; path?: string }): Promise<ToolResult> {
    const tasks = this.app.plugins.plugins["obsidian-tasks-plugin"];
    // Query task cache or use Tasks API
  }

  async createTask(text: string, due?: string, path?: string): Promise<ToolResult> {
    // Append task to specified note or default daily note
  }
}
```

### TemplaterBridge

```typescript
export class TemplaterBridge implements PluginBridge {
  readonly pluginId = "templater-obsidian";
  readonly pluginName = "Templater";

  async runTemplate(templatePath: string, targetPath?: string): Promise<ToolResult> {
    const templater = this.app.plugins.plugins["templater-obsidian"];
    // Use templater's template expansion API
  }
}
```

---

## Phase 5: Proactive Suggestions (Limited)

### Available Hooks

| Event | Trigger | Action |
|-------|---------|--------|
| `workspace.on('file-open')` | Daily note opened | Inject yesterday's summary as context |
| `workspace.on('create')` | New note created | If title matches project tag, suggest links |
| `app.vault.on('modify')` | Note modified | If note is task-heavy, suggest task review |
| Custom idle timer | No user activity > 5 min | Offer session summarization |

### Implementation

```typescript
// In main.ts onload():
this.registerEvent(
  this.app.workspace.on('file-open', (file: TFile) => {
    if (this.isDailyNote(file)) {
      this.intelligenceLayer.onDailyNoteOpen(file);
    }
  })
);

// Idle timer:
let idleTimer: number;
const resetIdle = () => {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    this.intelligenceLayer.onIdle();
  }, 5 * 60 * 1000); // 5 minutes
};
this.registerDomEvent(document, 'mousemove', resetIdle);
this.registerDomEvent(document, 'keydown', resetIdle);
```

---

## Settings Integration

New settings in `src/settings.ts`:

```typescript
interface IntelligenceSettings {
  // Phase 1
  enablePersona: boolean;
  personaPath: string;  // relative to intelligence dir
  memoryPath: string;
  identityContextBudget: number;  // max tokens for persona+memory (default: 2000)

  // Phase 2
  enableAutoSummarize: boolean;
  autoSummarizeThreshold: number;  // messages before auto-summarize (default: 20)
  enableMemoryCreation: boolean;  // allow create_memory tool

  // Phase 3
  enableCrossSessionSearch: boolean;
  crossSessionResultLimit: number;  // default: 3

  // Phase 4
  enableDataviewBridge: boolean;
  enableTasksBridge: boolean;
  enableTemplaterBridge: boolean;
}
```

---

## Security & Privacy

- **Memory never leaves the vault.** All memory files are local. No cloud sync unless user configures it.
- **Memory is vault-scoped.** Each vault has its own intelligence directory. Switching vaults = switching identity.
- **User controls memory.** `memory.md` is plain text — user can edit or delete anytime.
- **No sensitive data by default.** The AI is instructed not to store passwords, API keys, or private personal details.

---

## Migration Path

1. **T26-P1** (PersonaLoader) can ship independently — adds identity without changing chat behavior
2. **T26-P2** (create_memory) builds on P1 — AI can now write memories
3. **T26-P3** (cross-session) builds on T24 search — reuses existing infrastructure
4. **T26-P4** (bridges) are optional — each bridge is a standalone feature
5. **T26-P5** (proactive) is lowest priority — nice-to-have polish

---

## Open Questions

1. **Memory compaction:** As `memory.md` grows, how do we keep it under budget? Summarize old entries? Rotate to archive?
2. **Multi-vault memory:** Should persona be shared across vaults or vault-specific?
3. **Memory format:** Markdown is human-editable but SQLite is queryable. Support both or pick one?
4. **Bridge permissions:** Should bridges require explicit user approval per-call like vault tools?

---

## References
- [T26 Task File](../tasks/T26.md)
- [T24 SessionStorage](T24.md) — JSONL persistence foundation
- [T13 Agentic Tool Calling](T13.md) — tool framework

---

## Appendix: Phase 2.5 — Memory Deduplication (2026-08-14)

### Problem
MemoryStore.create() was appending duplicates endlessly. After months of usage, the same facts ("User prefers YAML frontmatter tags", "User is studying Chinese") were repeated 10-20× each. Memory file grew to 184 KB with ~131 unique entries but significant duplication.

### Solution: Two-layer approach

**Layer 1: Write-time deduplication (automatic)**
- `MemoryStore.create()` now checks for similar existing entries before appending
- Uses Jaccard word-overlap similarity at 70% threshold
- Category-scoped by default (cross-category entries never collide)
- Fast path: substring containment = 100% similarity (exact or superset match)
- If duplicate found: skip creating new entry
- Result: future writes are clean, no duplicates accumulate

**Layer 2: Historical cleanup (manual, on-demand)**
- `MemoryStore.pruneDuplicates(threshold)` — one-time scan and removal
- Groups entries by similarity, keeps longest/most detailed version per group
- Threshold configurable (default 0.7)
- Returns PruneResult: {removed, kept, groups, bytesBefore, bytesAfter}
- **Note:** Most historical "duplicates" are semantic variations (different wording, same fact). Jaccard at 0.7 catches near-exact matches but misses paraphrases.

**AI-Powered Semantic Prune**
- `MemoryOptimizer` class sends entries to configured LLM for semantic clustering
- Per-category batching (one API call per category)
- LLM returns JSON clusters: `{"clusters": [[0,2], [1], [3,4,5]]}`
- Keeps longest entry from each cluster
- Progress modal with live logs, ETA, and cancel button
- **Single-prompt batching was attempted but reverted** (see below)

**Settings UI additions:**
- "Memory Optimization" section in Settings → AI Intelligence Layer
- 🧹 Prune Duplicates button (Jaccard-based, local, fast)
- 🤖 AI-Powered Prune button (LLM-based, slower, catches paraphrases)
- Live result display showing duplicates removed and KB saved

### Files changed
- `src/intelligence/MemoryStore.ts` — dedup logic + prune method
- `src/intelligence/__tests__/MemoryStore.test.ts` — 40 tests (was 26)
- `src/intelligence/MemoryOptimizer.ts` — AI semantic clustering
- `src/intelligence/__tests__/MemoryOptimizer.test.ts` — 7 tests
- `src/components/presentational/AIPruneModal.tsx` — progress modal UI
- `src/settings-sections/intelligence.ts` — optimization UI + modal integration

### Reverted: Single-prompt batching (0c80359 → b22c2a7)
**Attempted:** Send all entries in one LLM prompt instead of per-category.
**Expected:** Faster (1 call vs 5 calls).
**Observed:** Hung for 5+ minutes with zero response. Cancel worked but the API call never returned.
**Root cause unknown:** Could be provider-specific latency, prompt size issue, or model behavior with large clustering tasks.
**Reverted to:** Per-category batching (ad088a1 approach) which was working reliably at ~1.5 min per category.
**Lesson:** Don't optimize latency without measuring. "Fewer API calls" ≠ "faster" if the single call is disproportionately slower.

---

## Appendix: Phase 2 Implementation Details (2026-08-07)

### MemoryStore

**File:** `src/intelligence/MemoryStore.ts`

The MemoryStore provides structured CRUD operations for the AI's long-term memory:

```typescript
export interface MemoryEntry {
  id: string;           // Random 8-char ID
  timestamp: string;    // YYYY-MM-DD
  category: MemoryCategory;  // user_fact | project | preference | insight | reference
  content: string;
  tags: string[];
}
```

**Storage layout:**
```
intelligence/
├── memory.json          ← canonical source (structured JSON)
├── memory.md            ← human-readable mirror (auto-generated)
└── memory-audit.jsonl   ← append-only operation log
```

**CRUD Operations:**
- `create(category, content, tags?)` → assigns ID + timestamp, appends to array, regenerates markdown
- `read(id)` → finds by ID
- `update(id, partial)` → modifies fields, preserves ID/timestamp
- `delete(id)` → filters array
- `list({category?, tag?, limit?})` → filtered query (default: all)
- `search(query)` → keyword search across content/tags/category

**Audit Log:**
- Every create/update/delete appends a JSON line to `memory-audit.jsonl`
- `readAudit(limit?)` returns newest-first array
- Viewable in Settings UI under collapsible "Memory Audit Log" section

**Design decisions:**
- `memory.json` is the single source of truth; `memory.md` is regenerated on every write
- Tags are normalized to lowercase; content is trimmed
- Legacy markdown entries auto-migrated on first load (idempotent)

### Memory Tools (5 tools)

**create_memory, update_memory, delete_memory, list_memories, search_memories**
- All delegate to MemoryStore methods
- Return formatted results for agent consumption

**read_memory_audit**
- Disabled by default (controlled by `enableMemoryAuditTool` setting)
- When disabled, returns error telling user to enable in Settings
- Returns formatted entries with timestamps, operation icons, and content previews

### PersonaLoader Integration

**File:** `src/intelligence/PersonaLoader.ts`

- `memoryStore` property initialized in constructor
- `loadMemory()` builds markdown from structured entries (not raw file read)
- `appendMemory()` delegates to `MemoryStore.create()`
- Auto-migration runs on init if `memory.json` doesn't exist but `memory.md` does

### SessionSummarizer Integration

**File:** `src/intelligence/SessionSummarizer.ts`

- Updated to use `MemoryStore.create()` instead of `PersonaLoader.appendMemory()`
- Benefits: structured storage, audit logging, tag support

### Settings UI

**File:** `src/settings-sections/intelligence.ts`

- Memory statistics: entry count, file size (JSON + MD), category breakdown
- Export buttons: JSON and Markdown download
- Audit log viewer: collapsible panel with operation history
- Enable/disable toggle for `read_memory_audit` tool

### Tests

**File:** `src/intelligence/__tests__/MemoryStore.test.ts`

26 tests covering:
- CRUD operations (create, read, update, delete)
- List filtering (category, tag, limit)
- Search (content, tag, category)
- Audit log (create/update/delete operations)
- Markdown generation
- Legacy migration
- [OpenClaw MEMORY.md](../../../../MEMORY.md) — inspiration for feedback loop design

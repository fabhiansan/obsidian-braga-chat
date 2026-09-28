# Chat Session Persistence Design
*Created: 2026-05-03 00:18:43 IST*
*Last Updated: 2026-09-28 12:35:16 IST*

## Overview

Replace the current flat `chatMessages` array with a session-based history store. Each chat session is a persisted conversation with metadata. The user can archive the current session, start a new one, and load past sessions via a modal picker.

This design follows the KIRSS principle: no standalone `ConversationManager` class. Session logic lives as methods on the plugin class, and React state in `ChatApp` manages the active session.

---

## Data Model

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isError?: boolean;
}

interface ChatSession {
  id: string;               // crypto.randomUUID()
  title: string;            // auto-generated from first user message
  createdAt: number;        // Date.now()
  updatedAt: number;        // Date.now() — updated on every save
  messages: ChatMessage[];
}

interface StoredChatData {
  sessions: ChatSession[];
  activeSessionId: string | null;
}
```

**Key design choice:** `activeSessionId` is stored so the user resumes their last active session on reload, not the most recent session in the list.

---

## Plugin API

Methods added to `ObsidianAIPlugin` in `main.ts`:

```typescript
async loadChatData(): Promise<StoredChatData>
async saveChatData(data: StoredChatData): Promise<void>
async archiveSession(session: ChatSession): Promise<void>
async deleteSession(sessionId: string): Promise<void>
async pruneSessions(sessions: ChatSession[], max: number): Promise<ChatSession[]>
```

### Migration Strategy

On `loadChatData()`:
1. Read plugin data.
2. If `storedChatData` key exists → parse and return.
3. If only old `chatMessages` array exists → wrap into a single `ChatSession` with title `"Previous Chat"`, save under new key, return.
4. If neither exists → return `{ sessions: [], activeSessionId: null }`.

---

## React Component Changes

### ChatApp.tsx

State changes:
```typescript
const [sessions, setSessions] = useState<ChatSession[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const messages = useMemo(() => {
  const s = sessions.find(s => s.id === activeSessionId);
  return s ? s.messages : [];
}, [sessions, activeSessionId]);
```

`handleNewChat` behaviour:
1. If current session has messages → `archiveSession(current)`.
2. Create new session with empty messages.
3. Set as active.
4. Save to plugin data.

`handleSend` behaviour:
- After assistant response completes → update `updatedAt` on active session → save.

### ActionBar.tsx

- **New button**: unchanged behaviour (archive + clear).
- **Load button**: enabled when `sessions.length > 0`. Opens `SessionPickerModal` on click.
- **Settings button**: unchanged.

### SessionPickerModal.tsx (new)

A React modal component:

```
┌─────────────────────────────────┐
│ Load Chat Session          [×]  │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Rewrite intro of Project    │ │  ← title (auto-generated)
│ │ 3 messages · 10:13 PM       │ │  ← count · relative time
│ │ Preview: "Can you rewrite..."│ │  ← first 60 chars of first user msg
│ │                    [Load] [×]│ │  ← load button + delete button
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Summarise weekly notes      │ │
│ │ 5 messages · Yesterday      │ │
│ │                    [Load] [×]│ │
│ └─────────────────────────────┘ │
│                                 │
│  [No saved sessions]            │  ← empty state
│                                 │
└─────────────────────────────────┘
```

**Props:**
```typescript
interface SessionPickerModalProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onLoad: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onClose: () => void;
}
```

**Empty state:** When `sessions.length === 0`, show "No saved sessions. Start a new chat and it will appear here."

---

## Auto-titling Logic

```typescript
function generateSessionTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === "user");
  if (!firstUser) return `Chat ${new Date().toLocaleDateString()}`;
  const text = firstUser.content.trim();
  const clean = text.replace(/<context>.*?<\/context>/s, "").trim(); // strip XML context
  if (clean.length === 0) return `Chat ${new Date().toLocaleDateString()}`;
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean;
}
```

Title is generated when a session is first archived (on "New" click), not on every message.

---

## Pruning Behaviour

Respect `settings.maxSavedConversations` (default 20).

```typescript
function pruneSessions(sessions: ChatSession[], max: number): ChatSession[] {
  if (sessions.length <= max) return sessions;
  // Sort by updatedAt ascending (oldest first)
  const sorted = [...sessions].sort((a, b) => a.updatedAt - b.updatedAt);
  const toRemove = sorted.slice(0, sessions.length - max);
  return sessions.filter(s => !toRemove.find(r => r.id === s.id));
}
```

Pruning happens on archive (after saving a new session).

---

## Files Modified

| File | Change |
|------|--------|
| `src/main.ts` | Add `loadChatData`, `saveChatData`, migration logic |
| `src/views/ObsidianAIChatView.ts` | Extend `ChatPluginLike` with new methods |
| `src/components/ChatApp.tsx` | Session state, archive-on-New, save-on-message |
| `src/components/ActionBar.tsx` | Enable Load button, open modal |
| `src/components/SessionPickerModal.tsx` | **New** — session list modal |

---

## Related Tasks

- T2: Conversation Chain & Memory — primary task
- T1: Chat Panel — UI container
- T9: Settings — `maxSavedConversations` already defined

## 2026-05-12 Hardening Pass

After the original session persistence work shipped, two follow-up regressions appeared in real use:

1. `debug.log` spam from repeated `saveChatData()` attempts
2. `data.json` being overwritten on plugin/app load during the initial hydration cycle

### Root Cause

`ChatApp` persisted from a broad `useEffect` tied to `[sessions, activeSessionId]`. A single interaction can trigger several back-to-back `setSessions(...)` updates:
- add user message
- add assistant message
- retry/edit/session management updates
- context synchronization after UI-local context changes

At the persistence layer, `saveChatData()` used a simple skip-on-busy guard, so overlapping calls were dropped and logged as noisy "already in progress" messages.

### Hardening Applied

```typescript
// ChatApp
useEffect(() => {
  // debounce autosave bursts
}, [sessions, activeSessionId, chatDataLoaded]);

// main.ts
async saveChatData(chatData: StoredChatData) {
  // serialize writes and flush latest queued snapshot
}
```

- autosave is debounced in `ChatApp`
- `saveChatData()` is serialized in `main.ts`
- overlapping writes queue the latest snapshot instead of dropping it
- the first autosave is skipped when real stored sessions have just been hydrated
- no-op `contextItems` rewrites are ignored

### Current Persistence Rule

Persist chat state after meaningful settled transitions, but coalesce bursty React updates so storage writes reflect the latest stable snapshot instead of every intermediate render-state mutation.

## 2026-07-29: Chat Input Draft Auto-Save

Composer text that has not yet been sent is stored in `ChatSession.draft` so it survives app restarts and tab switches.

**Design:**
- `draft?: string` added to `ChatSession`.
- `ChatInput` receives `draft` as an initial value and calls `onDraftChange(text)` on every keystroke.
- `ChatApp` debounces the callback (500 ms) and updates the session via `setSessions`, so the existing JSONL persistence path picks it up automatically.
- Draft is cleared when the user successfully sends the message.
- At the original implementation, attachments were not auto-saved; see the
  2026-09-28 extension below.

**Why session-scoped:** Each open tab in the shared tab bar has its own session, so drafts naturally travel with their conversation and do not leak across tabs.

See [T31: Chat Input Draft Auto-Save](../tasks/T31.md) for implementation details.

## 2026-09-28: Session-Scoped Draft Text and Attachments

The composer is keyed by session and reports text/attachment changes to the
active session. This keeps unsent input with its chat when tabs change and
restores it after restart. Draft-only sessions are persisted when they contain
text or attachments.

For JSONL storage, `sessions/index.json` retains draft text and a reference to
the session's `sessions/{id}.draft.json` file. The separate file stores draft
attachments, including image payloads, without expanding the session index. A
reference map avoids rewriting that file on each text autosave. Clearing or
deleting a draft removes the separate file; legacy-to-JSONL migration carries
both draft text and attachment payloads forward.

Production build passed on 2026-09-28. Automated tests and live
Obsidian/mobile behavior were not verified in this closeout.

---

The persisted JSONL sessions are also the source for cross-session retrieval. `SearchIndex` reads the JSONL files, supports both vault-relative and basename adapter responses, and falls back to legacy `data.json` when JSONL data is absent. See [Past-Session Search and Shared Tabs](past-session-search-and-tabs.md) for indexing, navigation, and rendering details.

## 2026-09-22 Sync Refresh and Hydration Note

The sync refresh reads session metadata without replacing messages already in
React memory. When a downloaded file is known to storage but is not present in
the lazy-hydration map, opening the session uses a pure disk peek fallback.
This prevents successful downloads from appearing as empty chat tabs.

## 2026-09-22 Final JSONL Safety Rules

- Index-only and metadata-only session snapshots are not authoritative
  deletions. Omitted sessions remain in the on-disk index unless their IDs are
  explicitly marked deleted.
- A session with a positive indexed message count must never be written as an
  empty JSONL payload, even if hydration bookkeeping was reset.
- Automatic conversation retention cannot silently remove persisted sessions;
  removal is an explicit user action.
- Hydration diagnostics record state and counts, but never message contents.

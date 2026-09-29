# Debug Logging & Diagnostics Design
*Created: 2026-05-02 11:46:39 IST*
*Last Updated: 2026-05-12 11:13:59 IST*

## Overview

Obsidian AI currently logs errors directly to the developer console. Users need an in-app diagnostics surface that captures useful troubleshooting information without exposing secrets or vault contents.

## Goals

- Make provider setup failures visible
- Make model discovery failures explainable
- Capture request/stream lifecycle metadata
- Help users report bugs with copyable diagnostics
- Keep logs privacy-aware and bounded

## Event Shape (Design Doc Spec)

```typescript
type DebugLogLevel = "error" | "info" | "debug";

interface DebugLogEvent {
  id: string;
  timestamp: number;
  level: DebugLogLevel;
  source:
    | "settings"
    | "provider"
    | "models"
    | "chat"
    | "context"
    | "streaming"
    | "noteEditing";
  event: string;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
}
```

## Actual Implementation (v1 — Pragmatic Crash Debugging)

The original design envisioned a structured `DebugLogService` with ring buffer, redaction, and source-tagged events. The **actual v1 implementation** prioritised capturing renderer crash data for T13 stability:

### `src/logger.ts` — `FileLogger`

```typescript
class FileLogger {
  private buffer: string[] = [];
  private flushTimer: number | null = null;
  private memoryTimer: number | null = null;
  private logPath: string;
  private maxSize: number;
  private app: App;
  private initialized = false;

  constructor(app: App, pluginId: string, maxSize = 5 * 1024 * 1024) { ... }

  async init() {
    window.__obsidianAiLogger = this;
    this.wrapConsole();
    this.setupErrorHandlers();
    this.writeDirect("info", "=== Obsidian AI debug log started ===");
    this.logMemorySnapshot();
    this.memoryTimer = window.setInterval(() => this.logMemorySnapshot(), 10000);
  }

  log(level: string, ...args: unknown[]) { ... }
  flushNow() { ... }
  scheduleFlush() { ... }
  clear() { ... }
  stopMemoryLogging() { ... }
}
```

**Key differences from design spec:**
- Plain-text file logger instead of structured JSON events
- Console interception (`console.log`, `error`, `warn`, `info`) instead of explicit `debugLog.add(event)`
- No redaction yet — full prompts and note contents may appear in logs
- No bounded retention beyond 5MB file size limit
- No source tagging (`provider`, `models`, `chat`, etc.)

### What IS implemented
- ✅ File append to `.obsidian/plugins/obsidian-ai/debug.log`
- ✅ `window.onerror` interception
- ✅ `window.onunhandledrejection` interception
- ✅ Memory metrics every 10s via `performance.memory`
- ✅ `window.__obsidianAiLogger` exposed for React components
- ✅ `flushNow()` for immediate disk write on errors
- ✅ 5MB max size with truncation

### What is NOT yet implemented
- ⬜ Privacy redaction (API keys, note contents, prompts)
- ⬜ Structured `DebugLogEvent` JSON format
- ⬜ Ring buffer with configurable retention count
- ⬜ Source tagging (`provider`, `models`, `chat`, etc.)
- ⬜ In-app diagnostics log viewer (we have metrics panel, not log viewer)
- ⬜ Copy-logs action

## Log Pipeline (Design Spec)

```text
Feature code
  |
  v
debugLog.add(event)
  |
  +-- redact(metadata)
  |
  +-- append to ring buffer
  |
  +-- persist bounded log list
  |
  +-- optionally console.info/warn/error
```

## Actual Log Pipeline (v1)

```text
Feature code
  |
  v
console.log / console.error / console.warn
  |
  +-- FileLogger.wrapConsole intercepts
  |
  +-- Formats as plain text line
  |
  +-- Buffers (flushes on error or after timeout)
  |
  +-- Appends to debug.log (truncates if > 5MB)
```

## Diagnostic UI (Design Spec)

```text
Settings: Diagnostics
+--------------------------------------------------+
| Debug logging                                    |
| Level: [Errors only                     v]       |
| Retain: [200] events                            |
|                                                  |
| Recent events                                    |
|--------------------------------------------------|
| 11:46:01 provider.init.success openai/gpt-4o     |
| 11:46:02 models.refresh.start  profile=work      |
| 11:46:03 models.refresh.error  status=401        |
| 11:46:12 chat.request.start    messages=3        |
| 11:46:13 chat.request.error    rate_limit        |
|--------------------------------------------------|
| [Copy logs] [Clear logs]                         |
+--------------------------------------------------+
```

## Actual Diagnostic UI (v1)

Implemented in `src/settings.ts` as `displayDiagnostics()`:

```text
Settings: Diagnostics
+--------------------------------------------------+
| JS Heap Used   45.2 MB    | JS Heap Total  87.1 MB |
| JS Heap Limit  2190.0 MB  | DOM Nodes      1842    |
| Chat Sessions  3          | Total Messages 42      |
|                                                  |
| [Refresh] [Open DevTools] [Clear History]        |
+--------------------------------------------------+
```

**Key differences:**
- Metrics-only (no event log viewer)
- Refresh button updates metrics on demand
- DevTools opener for advanced debugging
- Clear History with confirmation modal (deletes all chat sessions)

## Service Structure (Design Spec)

```text
src/debug/
  types.ts
  DebugLogService.ts
    add(event)
    list()
    clear()
    exportText()
    redactMetadata()
    prune()

main.ts
  debugLog: DebugLogService

api.ts
  provider init events
  chat request events
  stream events

models/
  model discovery events

context/
  context size/truncation events
```

## Actual Service Structure (v1)

```text
src/logger.ts
  FileLogger
    log(level, ...args)
    flushNow()
    scheduleFlush()
    clear()
    wrapConsole()
    setupErrorHandlers()
    logMemorySnapshot()

main.ts
  logger: FileLogger  (initialized FIRST in onload)
  clear-debug-log command

src/components/MessageBubble.tsx
  window.__obsidianAiLogger.writeDirect("debug", "Step N: ...")

src/components/ChatMessages.tsx
  window.__obsidianAiLogger.writeDirect("debug", "Step N: ...")

src/components/ErrorBoundary.tsx
  window.__obsidianAiLogger.log("fatal", ...)
  window.__obsidianAiLogger.flushNow()
```

## Redaction Rules (Design Spec)

Never log:

- API keys
- Authorization headers
- Full prompts
- Full note contents
- Full provider responses when they may include prompt content

Safe metadata:

- Provider type
- Model ID
- Profile ID/name
- Status code
- Error name/message
- Token estimate
- Number of messages
- Number of attached context notes
- Content length counts

**v1 Status**: Redaction NOT implemented. The file logger captures raw console output, which may include note contents or prompts from debugging statements.

## 2026-05-12: Log Spam Root Cause and Fix

The noisy `debug.log` entries that looked like a logger failure were actually caused by chat persistence behavior:

- `ChatApp` persisted chat data from a `useEffect` that fired on every `sessions` change
- a single send/retry/edit flow triggers multiple `setSessions(...)` updates in quick succession
- `saveChatData()` previously used a skip-on-busy guard, so overlapping writes logged repeated "save already in progress" lines

This was a persistence orchestration problem, not a file-logger recursion bug.

### Fix Applied

- `src/components/ChatApp.tsx` now debounces autosave requests so bursty UI updates coalesce into one save request
- `src/main.ts` now serializes `saveChatData()` and flushes the latest queued snapshot after the current write finishes
- startup hydration now skips the first autosave for real restored chat data to avoid overwriting `data.json` on plugin/app load
- no-op `contextItems` rewrites are skipped so they do not produce unnecessary save requests

### Resulting Guidance

- treat save-related log spam as a persistence signal first, not necessarily a logger defect
- keep `debug.log` informative by reducing redundant state-triggered writes before considering log filtering

## Retention (Design Spec)

```text
settings.debugLogRetention = 200

On add:
  events.push(newEvent)
  if events.length > retention:
    events = events.slice(-retention)
  saveData()
```

**v1 Status**: Simple file-based retention. If file exceeds 5MB, it is truncated. No configurable retention count.

## Event Examples (Design Spec)

```text
provider.init.success
  source=provider level=info metadata={provider:"openai", model:"gpt-4o-mini"}

models.refresh.error
  source=models level=error metadata={provider:"custom", status:401}

context.resolve.success
  source=context level=debug metadata={notes:2, estimatedTokens:1840, truncated:false}

streaming.abort
  source=streaming level=info metadata={elapsedMs:1204, chunks:18}
```

## Actual Log Format (v1)

```text
2026-05-09T11:50:12+05:30 [info] === Obsidian AI debug log started ===
2026-05-09T11:50:12+05:30 [info] User agent: Mozilla/5.0 ...
2026-05-09T11:50:12+05:30 [info] Obsidian version: 1.9.12
2026-05-09T11:50:12+05:30 [memory] JS Heap: 45.2 MB / 87.1 MB (limit: 2190.0 MB)
2026-05-09T11:50:22+05:30 [memory] JS Heap: 46.1 MB / 88.3 MB (limit: 2190.0 MB)
2026-05-09T11:51:05+05:30 [debug] [MessageBubble msg-123] Step 1: entering useEffect — 1840 chars
...
```

## Open Questions

- Whether diagnostics should be a settings section first or a dedicated view later — **Answered**: Settings section first (v1)
- Whether to include a "copy system info" block with plugin, Obsidian, and platform versions — **Partially answered**: Debug log header includes user agent and Obsidian version
- When to implement structured event pipeline and redaction — queued for v2 refinement after T13/T14 stability

## 2026-09-22 Hydration and Storage-Safety Diagnostics

Chat hydration now logs session IDs, expected/actual message counts, and
hydration state transitions without logging message contents. JSONL storage
also warns when it refuses an empty overwrite for a positive-count session or
preserves an omitted session from a partial snapshot. These warnings indicate
that the safety guard blocked a destructive write.

## 2026-09-29 Note-Link and Storage Log Follow-up

The chat link handler emits `[ChatLinks]` breadcrumbs around interception,
destination resolution, awaited Obsidian navigation, and caught errors. These
are intended to determine whether clicks in restored messages reach the
handler; absence of a breadcrumb leaves that question open. Do not log note
contents or full chat messages as part of this trace.

The JSONL positive-count empty-write guard still protects lazy-loaded sessions.
Repeated per-session warnings were replaced with a single Debug-level summary
per save (`e367c01`), including the aggregate number refused. The guard and
summary behavior are recorded in T24.

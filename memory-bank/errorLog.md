# Error Log
*Created: 2026-05-02 08:00:01 IST*
*Last Updated: 2026-09-29 20:10 IST*

*Newest entries first. Each entry documents a development error, its cause, and resolution.*

---

### 2026-09-29 20:10 IST — Loaded-chat vault link still crashes (ERR-20260929-001)

- Symptom: clicking a vault-document link in a previously loaded chat crashes
  Obsidian. The earlier mobile stack reports a minified renderer rejection:
  `Cannot read properties of null (reading 'children')`.
- Evidence: the supplied debug-log excerpt contains startup and storage output,
  but no `[ChatLinks]` breadcrumb at the time of the click. It does not prove
  whether the handler ran or identify the failure site.
- Current code includes awaited `openLinkText` handling, caught navigation
  errors, and interception for streamed replies (`30d83cd` source head).
- Status: 🔄 Unresolved. Reproduce on the updated plugin and capture the log
  around the click; see [T28](tasks/T28.md) and
  [note-link-interception.md](implementation-details/note-link-interception.md).

### 2026-09-21 13:21 IST — Sync stack overflow on every path (ERR-20260921-002)

- Symptom: all sync upload/download/conflict ops failing with `Maximum call stack size exceeded`.
- Cause: two `emitLog` helpers in `src/lifecycle/sync.ts` (~L197 rebuild, ~L409 triggerSync) called `emitLog(entry)` unconditionally — synchronous self-recursion. Introduced by T42g hub-wiring `e604eed`.
- Resolution: both sites → `options?.onLog?.(entry)`; shipped `5749148`. Unit suites missed it (lifecycle wiring, not hub/engine internals; `emit()` swallows listener errors).
- Status: ✅ Fixed.

### 2026-09-21 20:54 IST — Synced sessions opened empty, no retry (ERR-20260921-001)

- Symptom: synced sessions showed "No messages" until manually reopened; second open worked.
- Cause: `_hydrateSessionImpl` marked the session hydrated after a failed/empty first read — permanent for the session lifetime (index-only boot, T24).
- Resolution: failed read / count-mismatch → stays unhydrated, retries next open, error logged; partial reads warn; UI Notice added. Shipped `20ae983` (+ `1fb9263` for the picker's lying label). Device-verified.
- Status: ✅ Fixed.

### 2026-09-19 03:55 IST — Provider tool registration crash (ERR-20260918-001)

- **Symptom:** `TypeError: t is not a function` the moment any obsidian-git
  provider tool was registered, before any model request completed.
- **Cause:** `providerCapabilityToToolDefinition()` passed a bare JSON-schema
  object straight into the AI SDK `tool()`; the SDK only accepts
  Zod/Standard schemas or its own `jsonSchema()` wrapper, and tried to call
  anything else as a function while building the model request (`asSchema`
  crash site).
- **Resolution:** Normalized schemas with `toModelInputSchema()` in
  `src/agent/toolRegistry.ts` — zod/~standard/SDK-wrapped schemas pass
  through, bare JSON-schema objects get the `jsonSchema()` wrapper. The raw
  schema stays on the descriptor for host-side Ajv validation and
  OpenResponses conversion. Regression test exercises the exact crash site.
  Shipped in `a5186ef` (T39a).
- **Status:** ✅ Fixed; 492/492 tests pass.

### 2026-08-28 18:39 IST — Community Review Blocking Errors (ERR-20260828-001)

- **Symptom:** Obsidian Community Directory review failed with `no-unsupported-api` and `no-static-styles-assignment` errors after v1.4.0 release.
- **Cause:** 
  1. Code used `app.loadLocalStorage/saveLocalStorage` which requires newer Obsidian than `minAppVersion: 1.4.5`
  2. ~49 inline `element.style.property` assignments across multiple files
  3. Release tag created as `v1.4.1` instead of `1.4.1` (doesn't match manifest version)
- **Resolution:** 
  1. Replaced with browser `localStorage` + `obsidian-ai:` namespace
  2. Refactored all inline styles to CSS classes in `styles.css`
  3. Deleted bad release, recreated with correct tag `1.4.1`
- **Status:** ✅ Fixed in v1.4.1, review passed

### 2026-08-27 17:41:07 IST — Coordinator test mock construction

- **Symptom:** The new coordinator test failed because the mocked `AgentLoop`
  was not constructible with `new`.
- **Cause:** The test used a plain mock function for a class constructor.
- **Resolution:** Replaced it with a small constructible test class and reran
  the focused and full suites successfully.

---

### 2026-08-23 17:05:26 IST — Obsidian-AI/OpenClaw compaction context conflation

- **Symptom:** Initial test guidance mixed Obsidian-AI’s local compaction
  thresholds with the separate OpenClaw/Kimi long-context investigation.
- **Cause:** Two independent context-management systems were treated as if
  they shared the same threshold semantics.
- **Resolution:** Corrected the rationale to use Obsidian-AI’s local history
  estimate and verified the implementation against the merged source and live
  test. No source change was required.
- **Follow-up:** Keep Obsidian-AI validation evidence separate from the
  OpenClaw/Kimi investigation.

---

### 2026-08-12 10:54:55 IST — Stale AI SDK declarations after dependency update

- **Symptom:** TypeScript reported missing AI SDK exports and stream types after the initial UI work.
- **Cause:** `node_modules` contained older AI SDK packages than the versions declared in `pnpm-lock.yaml`.
- **Resolution:** Reinstalled with `CI=true pnpm install --frozen-lockfile`, then enabled `skipLibCheck` in the base `tsconfig.json` to match the existing production build policy for third-party declarations.
- **Verification:** `pnpm exec tsc --noEmit` and `pnpm run build` pass.

# Session Cache

## 2026-09-28 — T17a Dataview DQL and chat draft/tool-cancellation fixes

- Added Memory Bank subtask T17a under T17 for the implemented read-only
  `query_dataview` DQL capability. DataviewJS is not executed. The separate
  Dataview provider under T39 remains future work.
- Chat UI fixes keep unsent text and attachments with each chat, contain long
  filenames in attachment chips, and persist drafts across restart. JSONL
  attachment payloads use a separate per-session file; migration preserves
  draft state.
- Stop now rejects pending tool approval and prevents both native and
  OpenResponses loops from starting more calls or a continuation.
- Production build passed on 2026-09-28. Tests and live Obsidian/mobile
  acceptance were not run. Dataview-installed runtime acceptance remains open.
- Source commits: `274d2d6`, `2a0d175`, and `00bd848`. Working branch was clean
  and current at `00bd848` before this Memory Bank update.
- No local Beads database is initialized; T17a is recorded in the existing
  Memory Bank task hierarchy without inventing a Beads issue ID.
- See `sessions/2026-09-28-chat-ui-dataview-tooling.md` and the T17a/T31/T24/
  T60c task records.

## 2026-09-26 — T69a desktop/mobile Codex auth and T14 OpenClaw pairing

- Confirmed product direction: desktop local Codex auth must work without the
  Codex desktop GUI; runtime provisioning (installed CLI or managed runtime)
  remains undecided. Mobile Codex login/use must not depend on a connected
  desktop. Keep the mobile direct HTTP adapter compatibility-sensitive.
- Added the OpenClaw frontend mode: Obsidian pairs directly from desktop or
  mobile, while OpenClaw handles model and tool execution. Each device keeps
  pairing identity/credentials locally; no private identity or device token
  goes through plugin sync or export.
- T14 retains existing OpenResponses HTTP behavior as a separate transport.
  Corrected two stale source claims: current `AgentApiManager` serializes
  `previous_response_id`, and `OpenResponsesLoop` submits original input once.
- Updated T69, T69a, T14, shared auth and OpenResponses design notes, task
  registry, and today's session/edit history records. No source implementation
  or tests changed.
- `bd show` reports no local Beads database; no new issue ID was invented.
- Next: decide Codex app-server runtime provisioning; define Gateway address,
  pairing/revocation, reconnect, event mapping, and approval UX; perform separate
  mobile Codex and Gateway acceptance. Status remains T69/T69a planning, T14 in
  progress.

## 2026-09-26 — T69a Codex auth contract check

- Verified the official app-server account API: managed ChatGPT browser and
  device-code login, account status/plan, cancellation, logout, and locally
  hosted stdio JSON-RPC are documented.
- User requires Codex login on mobile without a connected desktop host. Another
  Obsidian plugin demonstrates device-code auth and Codex requests on iOS and
  Android via `requestUrl()`, but the request endpoint is undocumented and
  compatibility-sensitive. Keep mobile and desktop app-server adapters distinct.
- No authenticated probe was run: the local `codex` launcher fails with
  `ENOENT` because its bundled executable is missing.
- Updated T69a and `implementation-details/external-service-authentication.md`.
- Next: run a redacted mobile compatibility probe for device login, token
  refresh, one response, cancellation, and logout on iOS and Android. No source
  adapter has been implemented yet.

## 2026-09-24 02:46 IST — v1.6.0 release and review closeout ✅

- Session file: `sessions/2026-09-24-v1.6.0-release-closeout.md`.
- T8: release commit `e8b6629` and annotated tag `1.6.0` are published; GitHub
  release workflow uploaded the plugin assets. Deepak confirmed Community
  Directory review passed and the new version is online; T8b is complete.
- Release changes include the historical changelog and announcement, aligned
  version metadata, and auto-sync disabled until verified (manual Sync Now is
  available). T42g and T48c hold the durable sync and compaction notes.
- Formatting, TypeScript, production build, and `git diff --check` passed. The
  test suite was not run for release preparation.
- Follow-up: validate automatic sync before re-enabling it; T24a search scope
  and T48c pairing coverage remain open.

### 2026-09-22 19:06 IST — sync storage-safety repair and recovery ✅

- Session file: sessions/2026-09-22-chat-sync-reconciliation.md.
- 3ae26c4 added hydration diagnostics; 7291665 prevents empty payload
  overwrites and partial-index truncation, and removes silent retention
  deletion.
- Remote archive verified intact; repaired build restored 202 sessions
  download-only with no errors.
- Verification: 67 files / 571 tests, TypeScript, and production build.
- Remaining: conflict-decision UX, plugin-data rebuild, T24a search scope,
  and the future Chat/Plugin Health Settings surface.

### 2026-09-22 16:33 IST — cross-device sync reconciliation ✅

- Session file: `sessions/2026-09-22-chat-sync-reconciliation.md`.
- T42/T42a/T42c/T42g/T58/T58d/T24 source fixes are pushed at `4ce4b07`.
- Full verification: 67 files / 568 tests, TypeScript, production build, and
  `git diff --check` passed.
- Remaining: latest device acceptance, conflict-decision UX, plugin-data
  rebuild, and T24a unopened-session search scope.

### 2026-09-21 21:58 IST — mobile sync fixes day ✅

- Session file: `sessions/2026-09-21-mobile-sync-fixes.md`.
- T42g ✅ device-verified — `8fafd34` settings Sync Now modal; `5749148` emitLog self-recursion fix (stack overflow on all sync paths, introduced `e604eed`). Registry row moved Active → Completed.
- T24 addendum — `20ae983` hydrate retry (failed read no longer marks hydrated), `1fb9263` picker indexed count ("N messages — open to view").
- T48b — `f812c3f` replay maps image parts → `[image attached]` placeholder.
- Suite: ChatStorage 12/12, picker 2/2, build green each step; pushed `5749148..1fb9263`.
- T66 note: `styles.css` generated by `scripts/concat-styles.mjs`; T42g block relocated to `styles/_sync.css` (working tree, uncommitted, not Cloudy).
- Next: v1.6.0 still pending; `latest-dev` build from main is Deepak's call (a build now would include the uncommitted CSS).

### 2026-09-19 23:05 IST — perf PR merged ✅

- Session file: `sessions/2026-09-19-chat-perf-index-only-startup.md`
  (late-session addendum appended).
- T71 ✅, T24 ✅, T11 ✅; T24a ⏸️ created (search scope, pending decision).
- Merge `c83e593` 22:52 IST; suite 517/517; CI green; device-verified.
- Next: v1.6.0 release; T24a decision.

### 2026-09-19 03:55 IST — T39 git integration delivery ✅

- Session file: `sessions/2026-09-18-night.md`.
- T39a ✅ `a5186ef` (schema-normalization crash fix), T38 ❌ cancelled
  (reverted to `f7db24a`), T39b ✅ (write tools `19f1a37`, label fix
  `5286706`, MB record `e75576d`), T61 debug.log hygiene `63f0169`.
- obsidian-git companions: `a0e5705`, `a6f636b`, `056c620`, `2e4f1d9`.
- Verification: 492/492 tests, tsc clean, 17/17 smoke checks.
- Next: T44a references/citations fallback; T48 acceptance gaps as documented.

### 2026-09-10 — T48 compaction acceptance and debug-history closeout ✅

- Final source commit `4e6c0ff` aligns `!debug history` with the shared
  compaction-aware model-history projection.
- Runtime testing confirmed compaction, recovery, and notice persistence after
  reload; full automated verification passed.
- T48 remains active only for its documented pairing, preflight, isolation,
  attachment, and provider-parity acceptance gaps.

### 2026-09-10 — T48 tool-context fidelity and release follow-up 🔄

- Recorded commits `08e8ad1`, `c8a983f`, and `de24b0a` under the existing T48
  umbrella and the release CI record.
- Omitted-result cataloging, bounded exact retrieval, compaction provenance
  persistence, and focused automated coverage are complete in source.
- The seven-phase test is **PARTIAL PASS**: retrieval, pairing, truncation,
  continuation recovery, and provider accounting passed; runtime semantic
  compaction and plugin reload persistence were not exercised.
- Provider usage was `239,998` tokens (`237,757` input, `2,241` output), while
  local top-level estimates summed to about `79,781`; do not combine them.
- Open defects: context items leak across new chats, and oversized context
  resolution cannot be cancelled before the abort controller is created.
- Next: fix session isolation and cancellation/preflight budgeting, then run a
  fresh low-threshold compaction and reload test.

### 2026-09-09 — Tool-context optimization investigation ✅

- Consolidated the investigation and production telemetry in
  `sessions/2026-09-09-tool-context-optimization-investigation.md`.
- Same-model baseline: 7,272 provider input tokens. Small-result continuation:
  7,272. Large-result continuation after a 2,000-token cap: 9,402.
- Confirmed priorities: reduce the always-sent tool registry and replace large
  replay payloads with bounded previews plus exact-retrieval references.
- Remaining tests: long history with non-zero `maxRequestTokens`, parallel vs
  sequential calls, cache attribution, and OpenResponses step parity.

### 2026-09-09 — T48b native multi-call replay fix

- Native `AgentLoop` now preserves and executes all tool calls emitted in one
  model step, then replays one matching multi-result tool message.
- Added regression coverage for two-call ordering and pairing.
- Verification: full suite 53 files / 455 tests, TypeScript, production build,
  formatting, and diff checks passed.
- Remaining T48 work: exact retrieval, eviction-safe references, shared
  per-iteration budgets, compaction provenance, and provider usage parity.

### 2026-09-09 — T61 settings-tool coverage expansion

- The agent can now update the newer request-budget, compaction, tool-replay,
  and Debug Mode/Diagnostics settings in Developer mode, including nested
  telemetry flags.
- Provider profiles, credentials, paths, and `maxAgentSteps` remain protected.
- Fixed `messageHistory` validation and classified `update_setting` as a local
  write. Focused settings tests pass; full verification is pending.

### 2026-09-09 — T48 tool-context fidelity analysis

- T48 remains the single umbrella; no new task was created.
- Updated T48, T48a–d, T62a, and the compaction/optimization implementation
  notes with the lossless-storage, bounded-replay, exact-retrieval plan.
- Evidence: 486,550 provider-reported tokens, 132,492 saved estimates, and a
  176,298-character `read_note` result in the inspected conversation JSON.
- No source code changed. Follow-up remains exact retrieval, per-request
  budgeting/accounting, and fidelity-weighted benchmark coverage.
- Session: `sessions/2026-09-09-tool-context-fidelity-analysis.md`.

### 2026-09-09 — T34 Settings and export follow-up

- The existing T34 task now records the complete Settings/export work from this
  session; no new Settings task or subtask was created.
- Final UI: prominent search, persisted Show advanced settings toggle, local
  Debug Mode and chat indicator, asterisk-marked nested Advanced disclosures,
  section audit, compact hero, and responsive PDF Extraction layout.
- All chat message/session copy and export actions use `serializeChatExport()`;
  local Debug Mode telemetry is optional export metadata and is not network
  telemetry.
- User confirmed the expanded/collapsed presentation. Assets:
  `assets/T34-settings-advanced-expanded-2026-09-09.jpg` and
  `assets/T34-settings-advanced-collapsed-2026-09-09.jpg`.
- Final pushed commit: `5e978af`. Verification: 53 test files / 454 tests,
  TypeScript, production build, and diff checks passed.
- Minimum / Normal / Enhanced metadata presets and additional running-summary
  implementation remain future design work.

### 2026-09-09 — Release and mockup handoff

- `1.5.0` is published from `4a751b6`; remote `main` and the dereferenced
  `1.5.0` tag match after the tag was recreated following the remote rebase.
- The two scanner findings in `SettingsTab.ts` were fixed, verified, and
  pushed. T8b remains open for the corrected scan result.
- Real-provider acceptance and Android Settings card-width behavior are
  accepted by the user and should not be carried forward as blockers.
- The onboarding mockup is exploratory and deferred. Continue from live
  Obsidian screenshots in the next session; no production changes were made.

### 2026-09-02 18:06 IST — T70 closeout

- T70 completed in `72bf9f1`. Active-tab model restoration, legacy-chat
  fallback, per-chat overrides, picker/chip synchronization, toolbar sizing,
  group model metadata, and dropdown behavior are recorded as complete.
- Recents are now a shared ten-entry list per provider. Settings load and
  import/sync paths migrate legacy profile-keyed histories; model caches stay
  profile-specific.
- User verified the final build in Obsidian, including toolbar appearance,
  tab/model restoration, shared Recents, search, and dropdown layering.
- Final validation: 52 test files / 451 tests, TypeScript, production build,
  formatting, and diff checks passed. No known blockers remain.

### 2026-09-02 17:36 IST — T70 recent-model follow-up

- Added ten-entry provider-scoped recent-model history.
- Activating a tab now records its resolved model(s), including legacy-history
  models; the session is used as the source to avoid stale UI selection.
- Added helper and tests. Full suite: 52 files / 448 tests; package build pass.

## 2026-09-02 — T70 model identity planning

- Reviewed the model/provider switcher work through `8d9456c` and confirmed
  the legacy-chat model mismatch and picker sizing mismatch.
- Created T70 and its implementation note; updated provider-profile and
  shared-tab architecture references.
- Planned a parent-owned effective identity with session override → last
  assistant model → profile default precedence.
- Source implementation and runtime verification remain pending.

*Last Updated: 2026-09-02 18:06:05 IST*

## 2026-08-31 — T69 external service authentication planning

- Created T69 as the umbrella for external service authentication and provider
  adapters.
- Created T69a for Codex / ChatGPT subscription authentication and T69b for
  Claude Code authentication.
- Updated `implementation-details/external-service-authentication.md` with
  current mobile precedents and two Codex implementation paths: desktop
  app-server and experimental mobile device-flow/direct HTTP.
- Kept T39 separate as the peer-plugin Integration Provider API.
- No source code or credentials were changed; the next step is a small Codex
  compatibility probe for both paths.

*Last Updated: 2026-08-31 02:42:18 IST*

## 2026-08-31 — T16 group-chat umbrella planning

- T16 retained as the multi-agent group-chat umbrella.
- Created T16a for bounded selective context and shared tool facts.
- Created T16b for stable participant IDs, aliases, and unified `@` resolution.
- Updated the architecture guide and related task cross-references.
- Implementation remains pending; next step is to implement T16a/T16b in code.
- Session closed at 2026-08-31 02:14 IST by explicit `/end`.

*Last Updated: 2026-08-30 22:03:24 IST*

## 2026-08-30 — T66 CSS refactoring handoff

- Recorded the complete stylesheet split and cleanup implementation in the
  T66 task, selector inventory, and new architecture document.
- Source is split into six ordered partials with deterministic concatenation;
  generated `styles.css` remains the tracked release artifact.
- Commits through `eff9f38` are pushed. Serial verification passes 48 test
  files / 433 tests, TypeScript, build, package, and `git diff --check`.
- T66 remains active: the Android Settings card-width screenshots show no
  meaningful change after four wrapper/gutter attempts, and the prompt-field
  `min-width: 25em` needs review in the next session.

## 2026-08-30 — T67 final storage refactoring state

- Persistence, sync coordination, and plugin-data sync are all extracted from
  `storage.ts`.
- The current full suite passes 48 test files / 433 tests. TypeScript, the
  production build, and `git diff --check` pass.
- The source changes are pushed at `fa35c12`; these Memory Bank updates are
  currently local.
- Prettier still reports issues in 28 files. No source formatting was changed
  during this documentation update.

## 2026-08-30 — T67 boundary 2: sync orchestration extracted

- Moved `initSyncEngine`, `triggerSync`, `rebuildSyncIndex`, and `cancelSync`
  into `src/lifecycle/sync.ts`.
- Updated `main.ts` to use the new sync module while keeping the plugin API
  unchanged.
- Commit: `2995047`.

## 2026-08-30 — T67 boundary 3: plugin-data sync extracted

- Extracted `syncPluginData`, `serializePluginData`, `deserializePluginData`,
  and `openRemoteStorageSettings` from `storage.ts` into
  `src/lifecycle/pluginDataSync.ts`.
- `storage.ts` reduced from ~496 to ~200 lines.
- Added 11 focused characterization tests covering component filtering,
  dry-run mode, success/failure/conflict translation, error handling,
  default direction from settings, and serialization roundtrip.
- Full verification: 29 lifecycle tests passing, TypeScript clean,
  production build green.
- Commit: `56422f1` on `origin/main`.
- Remaining in `storage.ts`: `initializeStorage`, `migrateStorage`,
  `onSessionEnd`, `cleanupStorage` (~200 lines).

## 2026-08-30 — T65 memory integration closeout

- Completed tiered CRUD, prompt guidance, curation tools, ranked archive search,
  session-end curation, backup retention/cleanup, and persisted metadata.
- Verification: 403 tests and production build passed.
- Commits through `605633c` pushed to `origin/main`; repository is clean.
- Remaining follow-up: formal migration-event audit/version upgrade contract.

## 2026-08-30 — T34 settings/runtime follow-up

- Completed settings UX fixes and persistent collapsible sections.
- Fixed runtime manifest lookup and deferred sync initialization.
- Verification: 403 tests and production build passed.
- Pushed as `887480b`; repository is clean.

See `sessions/2026-08-30-night.md`.

## 2026-08-29 — T65: Three-tier memory system (late evening)

**Session title:** T65: Three-Tier Memory System with Auto-Curation

- Fixed `identityContextBudget` dead code in `buildSystemPrompt()`.
- Added nested settings tool support and `get_plugin_info` tool.
- Implemented `ThreeTierMemoryStore` with core/staged/archive split,
  score-based curation, and migration from legacy `memory.json`.
- Added `memoryCoreSize` dropdown (Small/Medium/Large) to Intelligence settings.
- 403 tests passing. All commits pushed to `origin/main`.

See `sessions/2026-08-29-late-evening.md` for the complete record.

## 2026-08-29 — T64d, T26: Live token validation, agentic memory audit, and Memory Bank closeout

**Session title:** T64d, T26: Live token validation, agentic memory audit, and Memory Bank closeout

- Completed the live T64d benchmark: 20/20 requests across four fixtures and
  five strategies, including deterministic compaction.
- Captured `$0.00628440` provider-reported benchmark cost and kept the supplied
  key out of the repository and Memory Bank.
- Confirmed the flat persistent memory foundation is implemented: structured
  storage, persona loading, CRUD/search tools, audit logging, duplicate
  pruning, optional session-end summarization, and explicit past-session search.
- Reconciled stale T26 wording with the actual source tree.
- Recorded the concrete wiring gap: `identityContextBudget` is editable but is
  not passed from `buildSystemPrompt()` to `loadFullContext()`.
- Kept the larger hot/cold tiered memory design, ranked search, proactive
  memory, automatic past-session injection, and peer-plugin bridges deferred.
- No source code changed. The repository remains clean at `4cd448d` before
  this documentation-only closeout.

See `sessions/2026-08-29-night.md` for the complete session record.

## 2026-08-29 — T64d expanded live validation closeout

**Session title:** T64d: Expanded live estimator validation with compaction and provider cost

- Added the missing deterministic `compaction` configuration to the live
  benchmark and completed 20/20 requests across four fixtures and five
  strategies.
- Added process-only `OPENROUTER_API_KEY` support and OpenRouter
  `usage.cost` reporting; the supplied key was not persisted.
- Provider-reported benchmark cost was `$0.00628440`; the separate metadata
  probe cost `$0.00000240`.
- The average estimate difference was `-54.7%`, ranging from `-98.88%` to
  `+18.54%`. No global estimator correction is recommended.
- T64d is complete. T48d should prefer provider usage and label local values as
  estimates. The production summary-generation cost remains outside this
  deterministic projection benchmark.

See `sessions/2026-08-29-t64d-expanded-live-validation.md` and
`tasks/T64d.md` for the full record.

## 2026-08-29 — T46, T48, T48a, T48b, T48c, T62a, T64, T64d, T48d closeout

**Session title:** T46, T48, T48a, T48b, T48c, T62a, T64, T64d, T48d: Model-history implementation, live token validation, and Memory Bank closeout

- Recorded the separate live benchmark session against OpenRouter using
  `openai/gpt-4o-mini`.
- The run completed 16 requests across four fixtures and four strategies.
- The average difference between local estimates and provider prompt usage was
  -65.2%, ranging from -98.88% to +6.35%.
- T48d should use provider usage when available and label local values as
  estimates otherwise. No global estimator correction is recommended yet.
- T64d remains active for a fifth compaction configuration and provider-cost
  evidence.

## 2026-08-29 — T62a automatic agent-mode preservation

**Session title:** T62a: Implement automatic agent-mode tool-result preservation

- Automatic agent-mode preservation is selected and implemented: agent turns
  use preserve mode automatically, while normal chat keeps its configured mode.
- `src/context/modelHistory.ts` is the shared entry point for replay, pairing
  checks, request budgeting, and model-facing message assembly.
- `TurnLifecycle`, `AgentLoop`, and `OpenResponsesLoop` use the shared path or
  its continuation helpers. The saved transcript remains unchanged.
- Verification passed: 45 test files / 381 tests, TypeScript, formatting, and
  the production bundle.
- Remaining: provider acceptance, pairing through compaction, exact retrieval,
  and inspectable compaction metadata.

## 2026-08-29 — Fresh architecture review handoff

**Session title:** T46, T48, T48a, T48b, T48c, T62a: Fresh architecture review and implementation plan

- The fresh read-only review examined source at `63bce58`; both dated reports
  are retained under `memory-bank/architecture-reviews/`.
- Documentation is now synchronized at `a08430b`.
- Current file sizes: `ToolExecutor.ts` 326 lines,
  `useMessageActions.ts` 220, `api.ts` 363, `main.ts` 228.
- T46a is complete. T46 still awaits provider-switching and real-provider
  runtime acceptance. The fresh review leaves model-history policy as the top
  follow-up and treats `TurnLifecycle` as a reassessment boundary.
- T48b/T48c and T64b changes and verification are recorded in commit
  `b49ad7d`; T64b is complete. Exact history retrieval and an inspectable
  compaction record remain open.
- Next action: define the single model-history projection boundary under the
  existing T48/T62a owners, then reassess lifecycle extraction. No new task or
  subtask was created. At that time, sync decomposition remained deferred; it
  was later completed under T67.

## 2026-08-29 — Memory Bank Task Registry Cleanup

- Reconciled `tasks.md` with the individual task records after pulling commit
  `8563009`.
- Moved completed release, UI, sync, architecture, tool, and settings tasks
  out of the active table.
- Kept T46 active only for provider-switching and real-provider acceptance;
  T46a is complete.
- Recorded T61 as in progress because the implementation is present but its
  integration acceptance tests remain open.
- Preserved T60e and T18a as paused and corrected the registry totals to 35
  active, 40 completed, 2 paused, 77 total entries.
- No source code changes were made in this cleanup.

## 2026-08-28 Late Evening — T13b + Mastra Evaluation

- **T13b Complete:** Fixed `ToolCallNotification.tsx` to show meaningful detail for all 18 built-in tools
  - Added `web_search` result count header: *"N of total results for 'query'"*
  - Smart fallback chain: `content` → `path` → `matches` → success
  - Commits: `abde5df`, `84b4ad9`
- **Mastra Evaluation:** Decided not to migrate from Vercel AI SDK
  - Current `PendingToolCard` + manual loop achieves same human-in-the-loop pattern
  - Streaming chunkiness is provider-level behavior (Kimi/Gemini), not SDK-fixable
- **T8a Complete:** v1.4.1 published in Obsidian Community Directory (confirmed 18:57 IST)

## 2026-08-28 Evening — T41 v1.4.1 Community Review Fixes

- Fixed blocking Obsidian Community Review errors in v1.4.0:
  - `no-unsupported-api`: replaced `app.loadLocalStorage/saveLocalStorage` with browser `localStorage`
  - `no-static-styles-assignment`: refactored ~49 inline styles to CSS classes
- Released v1.4.1 with corrected tag (`1.4.1`, not `v1.4.1`)
- Review status: ✅ Passed
- Memory-bank updated: changelog, progress, activeContext, errorLog, T41, community-review-remediation, release-process

## 2026-08-28 T46/T46a Review Closeout and Merge

- Reviewed the pushed PR #7 head and confirmed the review fixes for agent
  slash-command routing, manual-approval executor reuse, and formatting.
- Added focused hook coverage for both fixes.
- Verified 42 test files / 363 tests, TypeScript, production build, changed
  file Prettier, and `git diff --check`.
- Merged PR #7 into `main` as `975bb7e` and fast-forwarded the local checkout.
- T46 remains active because provider-switching and real-provider acceptance
  are still runtime gates; T46a remains complete.

## 2026-08-27 T46a Turn Output

- Added `src/agent/ChatTurnOutput.ts` for React-independent output collection.
- The helper keeps text around tool calls, tool results, and content parts in
  the same order as before.
- `useMessageActions.ts` is now 1,252 lines; visible streaming and approval
  state remain in the hook.
- Full verification passed: 43 test files / 362 tests, TypeScript, and the
  production build.
- Next: review the remaining UI callback and approval lifecycle boundary.

## 2026-08-27 T46a Turn Persistence

- Added `src/agent/ChatTurnPersistence.ts` for completed assistant-message
  creation and session-message updates.
- `useMessageActions.ts` is now 1,302 lines; UI interruption display and
  approval state remain in the hook.
- Full verification passed: 42 test files / 360 tests, TypeScript, and the
  production build.
- Next: decide whether the remaining UI callback and approval lifecycle work
  can move without weakening the runtime boundary; `api.ts` and `main.ts` are
  later phases.

## 2026-08-27 T46a Request Preparation

- Added `src/agent/ChatTurnRequest.ts` for prompt creation, history projection,
  request budgeting, attachment message assembly, and model-message assembly.
- `useMessageActions.ts` is now 1,305 lines; it still owns UI callbacks and
  persistence.
- Focused tests: 31 passed. Full suite: 41 files / 359 tests passed.
- TypeScript and production build passed.
- Next: move turn callbacks and final message persistence behind the coordinator.

## 2026-08-27 T46 Capability Domain Split

- Replaced the temporary `ToolHandlers.ts` grouping with separate note, bulk,
  discovery, vault, web, memory, session, and settings handler modules.
- Added `ToolHandlerContext.ts` so all handlers share the same host services
  and continuation store.
- `ToolExecutor.ts` is now 292 lines and still uses one resolved registry.
- Focused tool/provider checks: 49 tests passed. Full suite: 41 files / 359
  tests passed. TypeScript and production build passed.
- Next: extract request preparation and lifecycle work from `useMessageActions.ts`.

## 2026-08-27 T46/T46a Implementation

- Branch: `feat/t46-architecture-decomposition`
- Base commit: `a15c47646e1141239b269c8f608331889b1b32df`
- `ToolExecutor.ts` was reduced from 2,159 lines to 265 lines.
- Added shared path resolution, note handlers, remaining capability handlers,
  and a React-independent chat-turn coordinator.
- The prompt and OpenResponses request use the resolved registry definitions.
- Verification passed: 41 test files / 359 tests, TypeScript, production build,
  and focused coordinator/hook tests.
- Remaining: split `ToolHandlers.ts` by domain, finish T46a request-lifecycle
  extraction, then address `api.ts` and `main.ts`.

## 2026-08-27 Architecture Modularity Review Plan

- Pulled remote Memory Bank changes through `85a5f4c` before reconciliation.
- Recorded the architecture review and current file-size evidence.
- Created proposed `T46a` for the chat-turn coordinator extracted from
  `useMessageActions.ts`.
- Updated T46, T60/T60a/T60c, T48b/T48c, T62a, T64, and T22 ownership notes,
  plus the task index and architecture design records.
- No source code changes in this session; documentation changes remain to be
  committed and pushed.

*Session: 2026-08-27 13:21 IST*
*Branch: `main` (85a5f4c + local Memory Bank updates)*

## 2026-08-27 T64: Experiment Framework Design

- Designed 7 experiments for T64 benchmark harness to find optimal settings
  configurations for minimum token use and maximum chat fidelity
- Defined parameter sweep space: `maxToolResultTokens`, `toolHistoryMode`,
  `maxContextMessages`, `maxRequestTokens`, `preserveRecentMessages`,
  `requestResponseReserveTokens`
- Defined fidelity metrics: `recent_preservation`, `content_retention`,
  `tool_call_coverage`
- Proposed composite scoring: `score = 0.5*savings + 0.3*recent + 0.2*retention`
- Created sub-tasks: T64a (Pareto sweep), T64b (Preserve retention),
  T64c (Fidelity scoring), T64d (Live validation)
- Priority: T64b first (active T62a bug), then T64a (most actionable data)
- Memory-bank updated: T64, T62a, harness design doc, progress, activeContext,
  tasks registry, session log, edit chunk
- New task files: T64a.md, T64b.md, T64c.md, T64d.md
- No source code changes in this session

*Session: 2026-08-27 12:53 IST*
*Branch: `main` (759af20)*
*Models: kimi/k3*

---

## 2026-08-27 T64: Benchmark Harness Live Mode + T61 Export Button

- **T64 Level 2 (live API) — COMPLETE**
  - Added `--live` mode to `benchmarks/context-benchmark.ts`
  - Configurable providers: `--provider openrouter|kimi|kimi-custom`
  - Provider configs loaded from `~/.openclaw/openclaw.json`
  - **OpenRouter + GPT-4o-mini: ✅ All 12 fixture/strategy combos pass**
    - e.g. attachment+preserve: 14,668 actual (est: 19,597, Δ: -25%)
    - Average over-estimation: ~64%
  - **Kimi: ❌ 401 Invalid Authentication** — both config key and user key fail
- **T61 Export Button — COMPLETE**
  - Added "Export" button to Diagnostics settings
  - Downloads JSON with redacted settings, session metadata, usage stats, debug info
  - Committed: `2959ad8`
- **Prerelease cleanup** — deleted 5 stale prereleases + 6 tags, kept 3 latest
- **Bug discovered**: `preserve` mode still truncates via `maxToolResultTokens`
  — fix deferred pending harness experiments
- Memory-bank updated: T64 task status, implementation docs, progress, edit chunk
- Commits: `2959ad8` (export), `759af20` (benchmark live mode + docs)

*Session: 2026-08-27 04:00–06:47 UTC*
*Branch: `main`*
*Models: kimi/k3*

## 2026-08-26 T60 implementation and live validation

- Implemented and pushed T60a/T60c/T60d hardening plus T60f pagination.
- Successfully tested note-list and session-list pagination in the app.
- Verified 37 test files / 320 tests, TypeScript, and production build.
- T60a/T60c retain unfinished criteria; native AI SDK context resend remains
  open for later work.

## 2026-08-26 T60f bounded result pagination

- Created T60f as one focused task for the nine built-in tools whose results
  are bounded without a reliable next-batch mechanism.
- T60d remains focused on search result size and token efficiency.
- Source implementation is now complete and recorded in T60f; the old planned
  wording is retained below as historical context.

## 2026-08-26 Lazy-session-loading revisit — stopped safely

- Reviewed the reverted `1fa2518` patch and identified its cross-layer risk: metadata-only sessions temporarily expose empty messages to UI, input, history/tool, runtime, autosave, tab, export, and sync consumers.
- An attempted reimplementation was stopped before verification; no source commit was made.
- Deleted local branch `feat/lazy-session-loading-safe` and discarded its four uncommitted edits.
- `main` and `origin/main` remain clean at `ce547ae`.
- Future work must begin from a clean branch with an impact map, explicit invariants, controlled regression tests, and full verification before commit/push.

## 2026-08-25 T60e/T15 Provider-Adaptive Streaming Plan

- Approved a documentation-only plan for inconsistent live tool-call visibility
  across direct providers and OpenResponses agents.
- T60e owns the separate-branch transport/lifecycle work; T15 owns the UI
  progress and provisional-card presentation; T60c owns validation/execution.
- Required branch: `feat/t60e-provider-adaptive-streaming-ui`.
- No source changes have been made; T60e remains planned.

## 2026-08-25 T60b OpenResponses loop bug diagnosis

- Verified 3 protocol bugs in OpenResponses loop causing 500k-token blowup:
  1. Duplicate input submission — `streamAgentResponse({ input, tools })` inside
     the while loop resubmits full conversation on every tool round
  2. Discarded continuation ID — `previousResponseId` accepted but never
     serialized to request body; continuations are stateless
  3. Continuation handler gap — post-continuation stream doesn't handle
     `function_call`/`function_call_done`, forcing fallback to broken outer loop
- Impact: ~140× token reduction for multi-step tool chains (500k → 3.6k)
- Memory-bank updated across 7 task files, 1 implementation detail doc, 1 edit
  chunk, and 1 new proposed task (T60d)
- No source code changed in this session
- Session: `sessions/2026-08-25-evening.md`

## 2026-08-25 T60a integration gate

- Review correction: commit `68dc915` added a registry adapter, not a complete
  execution architecture. `ToolExecutor` still owns dispatch and provider
  metadata can still be discarded before execution.
- T60a is active and incomplete. T60b and T60c remain paused.
- Next step: write the failing registry execution-contract test first, then
  wire `ToolExecutor` through the registry. Do not begin transport parity or
  the full validation pipeline before this gate passes.
- No new planning documents are needed at this stage.

## 2026-08-25 T60 tool-system audit and planning

- Audited the 24 built-in tools, peer-provider registry, AgentLoop,
  OpenResponsesLoop, council mode, approval flow, ToolExecutor, prompt, and tests.
- Created T60/T60a–c and the canonical tool capability registry/execution
  pipeline design; created T18a for bounded ordinary web-page retrieval.
- Assigned approval/audit work to T38, provider lifecycle to T39a,
  decomposition to T46, advanced vault capabilities to T17, and exact
  historical retrieval to T48c.
- Focused audit tests passed before documentation work: 5 files, 34 tests.
- At the planning stage, no source implementation was performed. The later
  bounded T60a adapter is recorded below; its execution integration remains
  the next slice.
- Session: `sessions/2026-08-25-afternoon.md`

## 2026-08-23 T48c implementation validation and Memory Bank closeout

- Recorded the merged T48 implementation (`6a205b9`, PR #5) across T48 and
  subtasks T48a-T48c. T48d remains active and was not changed.
- Recorded the live semantic-compaction validation: `8000/4000` trigger and
  release, four recent messages, fourth-turn trigger, completion notice, and
  recovery of seeded markers and requirements.
- Created `implementation-details/T48c-validation-2026-08-23.md` and updated
  the compaction design with the implemented boundary and remaining gaps.
- Remaining T48c work: diagnostic instrumentation, schema/provenance audit,
  tool-pair and repeated-cycle acceptance, exact historical retrieval, and
  summary inspection/persistence.
- Memory Bank documentation changes are not yet committed.

## 2026-08-23 T48c compaction research and strategy update

- Created the standalone context-compaction research reference covering
  provider-native, semantic, tool-replay, caching, hierarchical-memory,
  safety-aware, and OpenClaw strategies.
- Updated `conversation-compaction-design.md` with the recommended hybrid
  ladder: stable/pinned context, bounded old-tool replay, token-triggered
  semantic compaction, audited derived summaries, and safe trimming fallback.
- T48c remains active; no source code or task status changed in this update.

## 2026-08-23 T48 context-efficiency plan

- T48 expanded to token-budgeted model context with full display history kept
  separately from bounded model replay.
- Created active subtasks T48a-T48d covering request budgeting, tool-result
  replay limits, rolling compaction, and provider-aware usage display.
- Updated related design documentation and recorded quality-preservation rules.
- Implementation is in progress on branch `feat/t48-context-efficiency-updater`:
  token-budgeted model history, bounded tool replay, and syncit-style branch
  build browsing are implemented; semantic compaction and provider-window
  discovery remain open.
- Verification so far: 274 tests, TypeScript, formatting, and production build
  pass.

*Last Updated: 2026-08-23 01:27:43 IST*

## 2026-08-23 T58/T58c/T58d session closeout and plugin rebuild audit

- Recorded the work from this chat under T58, T58c, and T58d: progress UX,
  planning-stage updates, dry-run plugin-data planning, stable rows, latest
  shimmer, persistent completion, and chat-session rebuild performance.
- Confirmed plugin data is part of normal sync and dry-run planning, but the
  Rebuild action still rebuilds only the chat-session SyncIndex.
- Preserved the architectural boundary: plugin files use identity-scoped
  shared state and must not be inserted into the session index. A separate
  plugin-data rebuild/reconciliation phase remains follow-up.
- Verification recorded: 29 test files / 269 tests, TypeScript, Prettier, and
  production build passed; focused UI/rebuild tests and live acceptance remain.
- Implementation commit `13efc4e` and documentation commit `ae79c7e` were
  pushed to `origin/main` before this Memory Bank-only closeout.

## 2026-08-23 T58d implementation slice

- Implemented shared progress phases for planning, sync, dry-run, rebuild,
  completion, and error states.
- Dry-run now plans selected plugin-data targets through read-only facades;
  no local/remote plugin state, retry records, or sync logs are written.
- Stable operation IDs prevent duplicate start/done rows. Only the latest
  active row shimmers, and the final progress bar remains visible.
- Rebuild reuses its initial state scan and uses bounded concurrency for
  independent transfers.
- Verification: 269 tests across 29 files, TypeScript, Prettier, and
  production build passed. Focused UI/rebuild tests and live acceptance remain.

## 2026-08-23 T58 task ID migration and approved follow-up plan

- Restored T43 as the original Multi-User and Agent Chat task from Git history.
- Moved the integrated sync UI records to T58 and T58a-T58c; old T43a-c files
  remain compatibility pointers for historical links.
- Created T58d for planning-stage progress, plugin-data dry-run planning,
  stable operation rows, latest-item shimmer, persistent completion state,
  rebuild progress, conflict status, and rebuild performance.
- No source code changed. The implementation and real-host acceptance remain
  open.

## 2026-08-23 T57c and token reconciliation

- Completed T57c implementation and tests.
- Sync identity now namespaces LocalCache and SyncIndexManager and scopes
  plugin-file shared state and retry records.
- Failed chat/plugin items are durable and retryable; successful items clear
  retry records and are not repeated unnecessarily.
- Sync progress now includes plugin-data items and reports chat/plugin status
  separately.
- Provider usage from AI SDK streaming is persisted and preferred in usage
  diagnostics; full-request estimates remain the fallback for older responses.
- Verification: full suite 268/268, 29 files; TypeScript and production build
  passed.
- Remaining: T57d SyncIt contract/overlap test and raw plugin-file migration.

## Latest Session
- Focus: T60b OpenResponses loop bug fix — diagnosis and implementation
- Completed:
  - Phase 1: Diagnosed 3 protocol bugs (duplicate input, discarded continuation ID, continuation handler gap)
  - Phase 2: Implemented fix:
    - `AgentApiManager.ts`: Added `previousResponseId`, serializes to `body.previous_response_id`
    - `OpenResponsesLoop.ts`: Moved initial request outside loop; shared handler with full event support
    - Tests: 4 new tests. All 301 tests pass. Build passes.
  - Impact: ~140× token reduction for multi-step chains
  - **Runtime finding:** `search_note_content` is O(n) over all markdown files with no index, no early termination, sequential I/O. On 800+ file vaults, takes 10+ seconds per call. Agent retries, causing overlapping scans.
- Commit: `38c352d` on `origin/main`
- Session file: `sessions/2026-08-25-evening.md`

*Session: 2026-08-25 16:00–17:00 IST*
*Branch: `main`*
*Models: kimi/k3*

---

## 2026-08-22 T57a Implementation

- T57a is complete for the shared transfer path.
- Older raw remote files are rejected safely during download-only sync; migration remains open.
- T57b is complete for remembered state, recovery copies, deletion records, and user choices.
- T57c remains next for durable retry records and full sync identity handling.
- Build and test closeout passed at 2026-08-22 23:19:11 IST.

## 2026-08-22 T57 Planning

- User approved T57 and subtasks T57a–T57d.
- SyncIt is the whole-vault sync owner; Chat Lab retains plugin-specific sync.
- Created the plugin-data/SyncIt boundary design doc.
- Kept the existing AI integration provider separate from the future data-sync contract.
- Beads issue creation was blocked because this checkout has no `.beads` database.
- The planning pass preceded the T57a implementation recorded above.

## Work Completed (2026-08-21 Afternoon)

### 1. T58a/b/c — Committed and Pushed
- Combined commit `2d687a2`: all three subtasks + telemetry removal
- T58a: `titleMap` pattern applied to `rebuildSyncIndex()`
- T58b: CSS activity indicators (spinner, pulse bar, shimmer)
- T58c: Plugin data sync with `_serializePluginData()` / `_deserializePluginData()`

### 2. T51 — Telemetry Removed
- Obsidian Community Plugins policy prohibits client-side telemetry
- Deleted: `src/lib/telemetry.ts`, `src/settings-sections/telemetry.ts`
- Removed init/event logging from `main.ts`, `settings.ts`, `ChatApp.tsx`, `AgentLoop.ts`
- Archived implementation to `telemetry-implementation-archived.md`

### 3. T55 — Component-Level Sync Selection
- Commit `7e0821b`: +311/-63 lines across 5 files
- Added `SyncComponentConfig` interface with 7 toggles
- New `src/settings-sections/syncComponents.ts` settings section
- Export/import filters by component
- Remote sync respects toggles: conditional serialization, selective merge, individual file sync
- Usage stats: computed on upload, skipped on download
- API keys excluded by default; credentials never overwritten from remote

## Files Modified
- `src/main.ts` — T58a title resolution, T58c plugin data sync, T55 component filtering
- `src/settings.ts` — T55 `SyncComponentConfig`
- `src/settings-sections/syncComponents.ts` — **New** (T55)
- `src/settings-sections/SettingsTab.ts` — T55 nav wiring
- `src/settings-sections/exportImport.ts` — T55 component filtering
- `src/components/ChatSyncPanel.tsx` — T58b activity indicators
- `src/sync/StorageAdapter.ts` — T58c `readText()`
- `src/sync/WebDAVStorageAdapter.ts` — T58c `readText()` implementation
- `styles.css` — T58b CSS animations
- Deleted: `src/lib/telemetry.ts`, `src/settings-sections/telemetry.ts`

## Memory Bank Updates
- `tasks.md` — T58a/b/c marked ✅ COMPLETE, T55 added
- `tasks/T58a.md`, `tasks/T58b.md`, `tasks/T58c.md` — Canonical sync subtask records
- `tasks/T55.md` — **Created**
- `tasks/T56.md` — **Created**
- `progress.md` — T58 subtasks + T55 + T56 completion added
- `activeContext.md` — T55 + planned changes (completed) added
- `session_cache.md` — This update
- `implementation-details/sync-component-selection.md` — **Created**

## Build Status
- TypeScript: clean
- Tests: 250/250 passing (236 existing + 14 new PluginDataManager tests)
- All changes pushed to `main`

---

## Previous Session (2026-08-21 morning)
- Focus: T58 subtasks (T58a title resolution, T58b activity indicators, T58c plugin data sync)
- Completed: All three T58 subtasks implemented (code changes only, not yet committed)
- Build: TypeScript clean

*Session: 2026-08-21 11:00–11:20 UTC*
*Branch: `main`*
*Models: kimi/k3*

---

## Previous Session (2026-08-19)
- Focus: T58 integrated Sync tab and rebuild workflow
- Completed: Sync UI redesign, rebuild choices, live rebuild activity, cancellation, and Sync-tab close button
- Latest code commit before final close-button fix: `b31f6bd`
- Final action: run checks, commit, push, then close the session

*Session: 2026-08-19 14:54–17:56 IST*
*Branch: `main`*
*Models: kimi/k2.7 (main)*

## Summary
Completed T6a (token counter accuracy), T49 (settings export/import), T51 (opt-in telemetry). Diagnosed and fixed T41 updater intermittent "works once then fails" bug (cache-busting + mobile diagnostics).

## Context
Session started after tool outage (~14:36–15:22 IST). Previous session had completed build fix and T6a token counter. T49 and T51 were in progress when tools died.

## Work Completed

### 1. T49: Settings Export/Import — COMPLETE
- **Problem**: Initial `<a download>` and HTML file input don't work in Obsidian's Electron environment
- **Fix**: Switched to vault-native operations:
  - Export: `vault.adapter.write()` saves JSON to vault root
  - Import: `FuzzySuggestModal` picks from vault JSON files
- **Security fix**: Tavily API key leaking in exports — added to redaction list
- **Commits**: `0061937`, `966e8fe`, `c68faa9`

### 2. T51: Opt-in Telemetry — COMPLETE
- Strictly opt-in, disabled by default
- First-run dialog with full disclosure (what is/isn't collected)
- Settings section with toggle, anonymous ID, data breakdown
- Events: `chat_started`, `tool_used`
- Endpoint: `https://quantumofgravity.com/telemetry`
- **Commit**: `05c53c8`

### 3. T41: Updater Intermittent Bug — FIXED
- **Symptom**: Auto-update works once (A→B), then fails (B→C). Manual update resets.
- **Root cause**: GitHub API CDN caching responses without cache-busting
- **Fix**: `&_cb=${Date.now()}` on all API calls + HTTP status checking
- **Diagnostics**: All updater logs go to `debug.log` (mobile-accessible)
- **Commits**: `b582dfa`, `8ae8650`, `dc0f173`

### 4. Memory-Bank Updates
- Marked T6a, T49, T51 as COMPLETE
- Updated T41 with intermittent bug fix documentation
- Created implementation docs: `settings-export-import.md`, `telemetry-implementation.md`
- Updated `progress.md`, `activeContext.md`

## Files Modified
- `src/settings-sections/exportImport.ts` — vault-native export/import
- `src/lib/telemetry.ts` — new telemetry module
- `src/settings-sections/telemetry.ts` — settings UI
- `src/updater/PluginUpdater.ts` — cache-busting, diagnostics, error handling
- `src/main.ts` — telemetry init, updater logger wiring
- `src/settings.ts` — telemetry fields
- `src/components/ChatApp.tsx` — telemetry event logging
- `src/agent/AgentLoop.ts` — telemetry event logging
- Memory-bank: 8 files updated, 2 new implementation docs

## Build Status
- TypeScript: clean (all commits)
- All changes pushed to `main`

## Open Items
- T48: Conversation Compaction Mechanism — created but not started
- T50: OpenAI Responses API / Threads Support — created but not started
- Telemetry backend endpoint needs implementation at quantumofgravity.com

## Memory Bank Updates
- `memory-bank/tasks/T6a.md` — Marked COMPLETE
- `memory-bank/tasks/T49.md` — Marked COMPLETE
- `memory-bank/tasks/T51.md` — Marked COMPLETE
- `memory-bank/tasks/T41.md` — Added intermittent bug fix
- `memory-bank/progress.md` — Added 2026-08-19 entry
- `memory-bank/activeContext.md` — Added session closeout
- `memory-bank/implementation-details/settings-export-import.md` — New
- `memory-bank/implementation-details/telemetry-implementation.md` — New
- `memory-bank/edits/2026-08-19/175500-session.md` — Edit chunks
- `memory-bank/session_cache.md` — This file

---

## 2026-08-27 Evening: T64b Message Window Experiments + Blog Post

- **T64b: Message Window Simulation — COMPLETE**
  - Added `maxContextMessages` simulation to harness
  - Created real fixture from grammar migration session JSON (26 messages, 13 turns)
  - Test matrix: caps [unlimited, 10, 25, 50] × modes [elide, preserve] × toolTok [4000, 64000]
  - **Key result: `maxContextMessages: 10` cuts token exposure by 42%**
  - Cap 25 is practically unlimited for this fixture
  - `maxToolResultTokens` difference (64000 vs 4000) is only ~10% at cap=10
  - Elide mode is 92% cheaper but breaks agent workflows
  - Data supports auto-preserve for agent mode (T62a)
  
- **Documentation — COMPLETE**
  - `context-optimization-results.md`: Full methodology, results, implications
  - `sessions/2026-08-27-evening.md`: Session log
  - Updated T64.md, T64b.md, activeContext.md
  
- **Blog Post — PUBLISHED**
  - "The Simplest Trick to Cut Your AI Token Bill in Half"
  - Deployed to quantumofgravity.com/cloudy-blog/
  - Indexed in blog list

*Session: 2026-08-27 ~20:30–21:00 IST*
*Branch: `main` (2ec863c, 2fa1f85)*
*Models: kimi/k3*
### 2026-09-02 17:18 IST — T70 implementation checkpoint

- Active work: T70 implementation is complete in source; final live Obsidian
  verification remains.
- Changes: shared session-profile resolution, legacy model fallback, parent
  prop threading, group model metadata, standard picker dimensions, tests.
- Validation: 51 test files / 446 tests; TypeScript, production build, package
  build, and diff check passed.

## 2026-09-09 17:29 IST — T48d per-step request telemetry

- Added `debugTelemetry.includeRequestBreakdown` as a safe writable setting and
  exposed it in Debug Mode.
- Native AgentLoop telemetry now records one bounded `agentSteps` entry per
  model request: request estimate, tool schema/history/continuation/tool-result
  components, and provider usage including cached input when reported.
- Export filtering remains independent: request estimates and provider usage
  can still be selected separately, and tool-result content is not duplicated.
- Verification passed: 53 files / 461 tests, TypeScript, production build,
  formatting checks on changed code, and diff check.
- Remaining gap: OpenResponses has no equivalent per-step telemetry projection.
- Debug Mode layout was tightened with an Export details group and section-only
  responsive styling; the generated stylesheet, full test suite, and build
  remain clean.

## 2026-09-19 19:40 IST — T71 + T24: chat scroll perf + index-only startup

- **Branch:** `perf/chat-scroll-settings-lag` (9 commits, pushed; HEAD `99860e6`)
- **T71 (new, ✅):** scroll lag, follow-scroll streaming, send-scroll race fix
  (`fa44b6f`), mention pills (`5443c4e`), preview fixture (`e32eb88`).
- **T24 (+):** index-only startup — boot from `sessions/index.json` (~57ms vs
  8.9s), lazy hydration with hard save guard, gates write through `sessionsRef`.
- **T11 (+):** event logging + startup phase timings (`0bcaf61`, `c87189a`, `01a941c`).
- **Verification:** 506/506 tests (6 new storage tests), tsc clean, build green.
  Device-verified 57ms startup load; 162 sessions / 2191 messages restored.
- **Pending Deepak:** device verdicts on follow-scroll/pills/event logs → merge
  branch to main → cut v1.6.0. Named next bottleneck: SyncEngine WebDAV init ~4.1s.

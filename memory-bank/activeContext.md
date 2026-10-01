# Active Context

### 2026-10-01 — T73 Chat component map and primary UI references

- T73 remains active for feature/source reconciliation; T73a is complete for
  the repository-neutral baseline and mockup set.
- The canonical map identifies the supplied mobile multi-tab and single-chat
  images, plus the optional-features overview, as primary visual references.
  The multi-tab attachment already matched its repository asset exactly; the
  other two were saved under descriptive names. Detailed message-anatomy
  images remain supplementary.
- Provider/model appears together in the references, but the current bubble
  renders model name only. Keep this as a documented implementation gap, not a
  claim of current behavior.
- Next: continue T73's source reconciliation and review feature-level gaps.
  No product source or tests changed in this documentation/assets update.

### 2026-09-30 — Android link fix and approved Chat Lab toolbar

- T28 is complete: `15b0f8e` preserves Obsidian-rendered anchor nodes and uses
  capture-phase delegation from the stable message container. Focused tests
  cover anchor identity, event ordering, and idempotence; the user confirmed
  the Android crash is fixed. Alias and external URL variants were not
  separately reported as retested.
- PR #9 merged the responsive Chat Lab toolbar into `main` at `62b2db5`. The
  CPU/count model button precedes Agents; Sync, Zen, and Settings are direct
  actions; bulk session export is under More, while per-chat copy/export stays
  in Chat History. The provider/model identity row remains passive and
  separate. The user approved the desktop and mobile layouts, including the
  larger mobile controls.
- Focused toolbar/model tests passed 12/12. The full test run reported 575
  passed and one unchanged `useMessageActions` AbortSignal assertion failure.
  No release/version bump was made.
- Source branch `main`, head `62b2db599decc91288e94436610a8993ab1af635`.
  See today's session record, T28, T58, and the toolbar/sync implementation
  notes.

### 2026-09-29 — Plugin self-description, chat tables, and link-crash follow-up

- `get_plugin_info` now returns manifest creator/contact information and active
  built-in capability descriptions (`1597a28`). Chat Markdown tables scroll
  horizontally (`bc00e4f`); the user confirmed the fix works.
- Link interception now awaits Obsidian navigation and traces its click path;
  the reported crash in a previously loaded chat remains open as T28 because
  the supplied log has no `[ChatLinks]` breadcrumb to establish handler entry.
- Repeated JSONL empty-write warnings were grouped into one Debug summary per
  save; the positive-count data-loss guard remains enabled (`e367c01`).
- Discussed Obsidian graph access: public metadata such as
  `metadataCache.resolvedLinks` can support plugin queries; the built-in Graph
  view is a visualization. No graph feature or vault map was built.
- Source head `30d83cd` on `main`; source builds passed during the session.
  No tests were run for the final logging change and live loaded-chat link
  acceptance is still pending. See today's session record.

### 2026-09-28 — Chat draft isolation and approval cancellation

- The composer remounts per session and stores unsent text on that session, so
  switching chats cannot submit one chat's text in another. Draft text and
  attachments now restore after restart; JSONL attachment payloads use a
  separate per-session file.
- Stop now aborts the turn, rejects and clears a pending tool approval, and
  both native and OpenResponses loops stop before starting further calls or a
  continuation.
- Added subtask T17a for the implemented optional, read-only Dataview DQL tool;
  the T39 Dataview provider remains future work.
- TypeScript, Prettier, and `git diff --check` passed; `npm run build` passed
  on 2026-09-28. Tests and live Obsidian/mobile behavior were not run.

### 2026-09-27 — T17a Optional Dataview DQL tool

- Added read-only `query_dataview`, exposed only when Dataview's public query
  API is available. It runs DQL through `tryQueryMarkdown` or the compatible
  `queryMarkdown` result API; DataviewJS is not executed.
- Query input is capped at 5,000 characters and formatted output at 12,000
  characters (8,000 by default). Tool exposure and execution share the normal
  built-in registry for native and OpenResponses calls.
- TypeScript and production bundle passed. Live Obsidian acceptance with
  Dataview installed remains unverified.

### 2026-09-26 — T69a Codex auth and T14 OpenClaw frontend direction

- Desktop Codex subscription auth remains a supported product option without
  requiring the Codex desktop GUI. Whether the plugin relies on an installed
  Codex CLI or manages the app-server runtime is still open. Mobile login and
  use must work independently, without a connected desktop host.
- The user wants Obsidian to serve as a paired chat frontend for a running
  OpenClaw instance on desktop and mobile. OpenClaw owns model and tool
  execution; each device pairs with the Gateway and keeps its identity and
  pairing credentials local. This is distinct from both Codex auth and the
  existing OpenAI API-key provider.
- T14 now records the Gateway transport separately from its existing HTTP
  OpenResponses path. Current source sends `previous_response_id` and submits
  the original request once; T14's old defect claims were corrected. Remaining
  protocol and live-provider acceptance is open.
- Beads commands report no local database, so no new task ID was created. See
  today's session record and the T69/T69a/T14 task notes.

### 2026-09-26 — T69a Codex authentication contract checked

- Official Codex app-server documentation supports managed ChatGPT browser
  login and device-code login over the app-server account API. The server owns
  managed token persistence/refresh and exposes account status and logout.
- User requirement: Codex subscription sign-in must work directly on Obsidian
  mobile without a connected desktop Codex process. Official app-server's
  managed device-code flow exists, but its local transports require a host;
  direct mobile device auth is technically demonstrated by another Obsidian
  plugin, using undocumented Codex backend endpoints. Keep desktop and mobile
  adapters distinct and treat mobile as compatibility-sensitive.
- The local `codex` launcher currently fails because its bundled executable is
  missing, so no real authenticated probe has been run. See T69a and
  `implementation-details/external-service-authentication.md`.

### 2026-09-24 02:46 IST — v1.6.0 release and Community review complete ✅

- T8: `1.6.0` is published from release commit `e8b6629`; Deepak confirmed the
  Community Directory review passed and the new version is online. Full release
  history is in `CHANGELOG.md` and user-facing notes are in
  `docs/release-announcement.md`.
- T42g: automatic remote sync is disabled pending verification; manual Sync
  Now remains available. T48c runtime compaction and recovery are accepted as
  working well enough for this release.
- Release formatting, TypeScript, production build, and `git diff --check`
  passed; the release-preparation test suite was not run.
- Remaining follow-ups: verify auto-sync before re-enabling it; T24a search
  scope and compaction pairing coverage remain tracked separately.

### 2026-09-22 19:06 IST — sync storage-safety repair and recovery ✅

- 3ae26c4 added hydration diagnostics; 7291665 prevents positive-count empty
  JSONL overwrites, partial-index truncation, and silent retention deletion.
- Remote WebDAV evidence: 207 session files, zero empty; repaired device build
  recovered 202 sessions download-only with no errors.
- Verification: 67 files / 571 tests, TypeScript, and production build pass.
- T24/T42 session recovery is accepted. Remaining sync work: conflict-choice
  UX, plugin-data rebuild, T24a search scope, and a future Chat/Plugin Health
  Settings surface.

### 2026-09-22 16:33 IST — cross-device sync reconciliation shipped ✅

- T42/T58/T24 follow-up source work is pushed through `4ce4b07`: titles and
  counters, deletion planning, download-only counts, rebuild-index feedback,
  plain metadata manifest, batched persistence, visible post-download stages,
  timer reset, and downloaded-chat hydration repair.
- Verification: 67 files / 568 tests, TypeScript, production build, and
  `git diff --check` passed. Memory Bank closeout is being recorded now.
- Remaining: latest device acceptance, per-conflict decision UX, separate
  plugin-data rebuild, and T24a search scope.

### 2026-09-21 21:58 IST — mobile sync fixes verified on device ✅

- Morning: T42g follow-ups — `8fafd34` (Settings "Sync Now" shows progress modal; auto-sync stays modal-less by design), `5749148` (emitLog self-recursion → "Maximum call stack size exceeded" on every sync path; introduced by `e604eed`, fixed to `options?.onLog?.(entry)`).
- Afternoon (T24/T48b follow-ons from T42g device testing): `20ae983` hydrate retry — failed/empty first read no longer permanently marks a session hydrated (root cause of synced sessions opening empty); `f812c3f` replay image placeholder — old image parts no longer force an image-capable model on later text sends; `1fb9263` picker preview shows indexed count instead of "No messages" for unhydrated sessions.
- T42g acceptance: device verify ✅ (Deepak, 16:19 UTC — "Good. It works.").
- T66 operational note: `styles.css` is generated (`scripts/concat-styles.mjs` from `styles/_*.css`) — hand-appended CSS is clobbered every build; T42g styles correctly relocated to `styles/_sync.css` (working tree, uncommitted, not Cloudy's).
- Verification: ChatStorage 12/12, picker 2/2, tsc + esbuild green; pushed `5749148..1fb9263`.
- Next: v1.6.0 release; `latest-dev` build from main is Deepak's call (would pick up the uncommitted CSS). T24a ⏸️ unchanged.

### 2026-09-19 23:05 IST — T71/T24/T11 perf PR merged to main ✅ (PR #8)

- 23 commits on `perf/chat-scroll-settings-lag` → merged `c83e593`
  (22:52 IST); CI green (2 builds + prettier); suite 517/517, tsc clean.
- **T71 ✅** chat scroll perf + streaming follow: memoized rows,
  `content-visibility`, debounced persistence, follow-scroll with scroll-up
  interrupt, mention pills root-cause fix, send-scroll restore race fix.
- **T24 ✅ 2026-09-19 addendum** — index-only startup: boot from
  `sessions/index.json` (~57ms device, was 8.9s), lazy hydration, hard save
  guard; codex wave-2/3 hardening (`peekSessionMessages` copy/export,
  draft-bucket dedup, hydration-guard preservation, scroll restore after
  lazy fill).
- **T11 ✅** event logging + startup phase timings (`0bcaf61`, `c87189a`,
  `01a941c`) — enabled the 8.9s → 57ms diagnosis.
- Device-verified by Deepak. Process lesson: PR work at high context on
  Kimi degraded into a 17× tool-call read loop (38 min silence, same
  pattern as 2026-08-23) — wrap such work in shorter sessions.
- **Next:** cut v1.6.0 (version bump, tag, release notes). Pending Deepak
  decision: **T24a** global-search scope over index-only sessions
  (hydrate-on-search / disk search / scope note).

### 2026-09-19 03:55 IST — T39 git integration delivery complete ✅

- T39a ✅ `a5186ef` — provider JSON schemas now normalize through
  `toModelInputSchema()` before reaching the AI SDK `tool()`; this killed the
  `TypeError: t is not a function` crash on provider-tool registration.
- T38 ❌ CANCELLED — AI-authored approval-policy framework Deepak never
  requested; reverted to `f7db24a`, design doc deleted, honest record in the
  task file. The existing auto-execute toggle is the only gate.
- T39b ✅ — obsidian-git `2e4f1d9` shipped git.stage/commit/pull/push with
  snapshot-cache invalidation; obsidian-ai `19f1a37` registered the write
  tools (read-only hard-block removed); `5286706` dropped the stale
  "8 read only tools" settings label.
- T61 debug.log hygiene ✅ — `63f0169` scoped debug.log to the plugin's own
  bundle and dropped stream-chunk spam.
- Verification: 492/492 tests, tsc clean, 17/17 cross-repo smoke checks.
- Standing lesson recorded: when Deepak says "no," pin down exactly what
  "that" is before acting or recording.
- Next: T44a references/citations fallback (CrossRef blocked from Vercel
  egress — OpenAlex/DataCite); arxivite duplicate-pair cleanup is tracked in
  that repo. T48 acceptance gaps remain as previously documented.

### 2026-09-10 — T48 compaction acceptance and debug-history closeout ✅

- Runtime testing confirmed compaction recovery, persisted in-chat notices
  after reload, and separate plugin/OpenRouter cumulative usage totals.
- The final source fix `4e6c0ff` makes `!debug history` use the same bounded,
  compaction-aware model-history projection as normal requests.
- Full verification passed: 58 test files / 488 tests, TypeScript, production
  build, formatting, and diff checks; `main` matches `origin/main`.
- Remaining T48 work is limited to explicitly open pairing, attachment-aware
  accounting, cancellation/preflight, isolation, and provider-parity gates.

### 2026-09-10 — T48 fidelity implementation and diagnostic follow-up 🔄

- `08e8ad1` catalogs omitted tool results and supports bounded exact
  `read_tool_result` retrieval; `c8a983f` persists compaction provenance.
- `de24b0a` keeps dev release assets/body publication alive after a rolling-tag
  move failure. Run `34401737218` succeeded, but the remote `latest-dev` tag is
  still `08e8ad1` while the release asset/body advertise `de24b0a`.
- The seven-phase test is **PARTIAL PASS**. It did not validate runtime
  semantic compaction or plugin reload persistence.
- Current bugs are context-item state leakage between new chats and late abort
  controller creation during oversized context resolution.
- Next actions: add session-isolation and cancellation/preflight tests, then
  repeat compaction with low thresholds and verify reload metadata reuse.

### 2026-09-09 — Tool-context optimization investigation ✅

- Consolidated the full tool-calling/context investigation and controlled
  production telemetry in `sessions/2026-09-09-tool-context-optimization-investigation.md`.
- Same-model `gpt-oss-120b` evidence isolates large tool-result replay as the
  first confirmed optimization target: 7,272 input tokens for the baseline and
  small-result continuation versus 9,402 after a 2,000-token result.
- Tool-schema estimates remain approximately 3,400–3,500 tokens per request,
  including a no-tool run. Native multi-call preservation and aggregate usage
  reconciliation are verified.
- T48a non-zero request-budget/long-history behavior, exact result retrieval,
  provider cache attribution, and OpenResponses per-step telemetry remain open.

### 2026-09-09 — T48b native multi-call replay fix ✅

- Implemented the first fidelity-horizon code slice under T48/T48b.
- Native `AgentLoop` now collects every tool call emitted in one model step,
  executes them in order, and sends matching ordered tool results on the next
  continuation.
- Added regression coverage for callback order, execution order, and paired
  call/result IDs. Full suite: 53 test files / 455 tests; TypeScript,
  production build, formatting, and diff checks pass.
- Exact historical retrieval, per-iteration provider parity, compaction
  provenance, and usage reconciliation remain open.

### 2026-09-09 — T61 settings-tool coverage expansion ✅

- Extended the Developer-mode `update_setting` allow-list to include the
  request-budget, compaction, tool-replay, and Debug Mode/Diagnostics settings,
  including nested telemetry flags.
- Kept provider profiles, credentials, paths, and `maxAgentSteps` protected;
  corrected `messageHistory` boolean validation and marked setting updates as
  local writes for target locking.
- Added unit and ToolExecutor integration coverage. Focused settings tests
  pass; full suite and build verification remain to be run before closeout.

### 2026-09-09 — T48 tool-context fidelity analysis 🔄

- Audited `Downloads/Duplicate_Adjective_Category_Search.json` as conversation
  data, confirming that T48 remains the single context-handling umbrella.
- Recorded the fidelity horizon under T48 and T48a–d: lossless stored history,
  bounded model replay, stable tool-result references, and exact retrieval on
  demand. T62a remains the agent-retention decision record.
- Measured 486,550 provider-reported tokens, 132,492 saved-message estimates,
  and a 176,298-character `read_note` result; these categories must not be
  combined as one usage metric.
- No source code changed. Next implementation work is exact retrieval,
  per-iteration budgeting/usage accounting, and fidelity-weighted validation.
- Session record: `sessions/2026-09-09-tool-context-fidelity-analysis.md`.

### 2026-09-09 — T34 Settings and export follow-up ✅

- Completed the full Settings UI audit and follow-up from the long-context and
  export discussion. The work is recorded under the existing T34 umbrella; no
  new Settings task or subtask was needed.
- The final pushed implementation adds prominent settings search, persisted
  advanced visibility, local Debug Mode with an in-chat indicator, selected
  export telemetry, and the unified `serializeChatExport()` entry point.
- Mixed sections now end with independently collapsible Advanced settings
  groups. Asterisk markers remain; Debug Mode and Diagnostics are whole
  advanced sections, Sync Components is normal, Developer mode belongs to
  Agent Tools, and Clear all chat history belongs to Backup & Restore.
- The Settings hero and PDF Extraction layout were made more compact and
  responsive. User-confirmed expanded/collapsed views are stored in
  `assets/T34-settings-advanced-expanded-2026-09-09.jpg` and
  `assets/T34-settings-advanced-collapsed-2026-09-09.jpg`.
- Commits `fd6191e` through `5e978af` are pushed. Final verification passes
  53 test files / 454 tests, TypeScript, production build, and diff checks.
- The Minimum / Normal / Enhanced metadata preset and additional running
  summary changes remain future design work. Debug telemetry is local and
  export-only, separate from the disabled network telemetry task T51.

### 2026-09-09 — Release and acceptance record cleanup ✅

- `1.5.0` is published from `4a751b6`; the exact remote tag and branch were
  verified after the release tag was recreated following the remote rebase.
- The two Community scanner findings in `SettingsTab.ts` were fixed and the
  corrected tag was pushed. T8b remains open only for confirmation that the
  queued scan is clear.
- User-confirmed real-provider acceptance and Android Settings card-width
  behavior are no longer open blockers; T46 and T66 records were updated.
- Onboarding mockup work remains exploratory and deferred under T12.

### 2026-09-02 — T70 complete ✅

- T70 is complete in `72bf9f1`. The active tab now drives the restored
  provider/model identity, including legacy-chat model fallback and explicit
  per-chat overrides.
- Recents are a shared ten-entry history per provider, migrated from the old
  profile-keyed format. Available-model caches remain profile-specific.
- User verified toolbar appearance, tab/model restoration, shared Recents,
  search, and dropdown layering in the live Obsidian runtime.
- Final validation: 52 test files / 451 tests, TypeScript, production build,
  formatting, and diff checks passed. No known blockers remain.

### 2026-09-02 — T70 recent-model follow-up

- Increased recent models from 5 to 10 per provider.
- Tab activation now records each active profile's resolved model in the shared
  provider Recents list,
  including models restored from older chat history. Resolution uses session
  profile IDs and avoids the transient previous-tab UI selection.
- Added shared helper/tests; focused and full checks passed before commit.

### 2026-09-02 — T70 implementation checkpoint

- Implemented the active-tab model restoration fix. `ChatApp` now resolves
  model identity using session override, latest applicable assistant
  `modelName`, then profile default, and shares that resolved profile with the
  picker, active chip, and turn execution.
- Added agent-scoped history handling and persisted `modelName` for new group
  responses. Standardized the model picker trigger with the toolbar button
  class and added resolver/picker regression tests.
- Checkpoint validation passed: 51 test files / 446 tests, TypeScript,
  production build, package build, and `git diff --check`; live Obsidian
  verification was completed in the final closeout above.

### 2026-09-02 — T70 active-chat model identity planning 🔄

Created T70 and its canonical implementation note after reviewing the model
switcher work through `8d9456c`. The active chat tab will own one effective
provider/model identity: session override, last assistant model for legacy
sessions, then profile default. The picker, active chip, and turn execution
must consume that same resolved value. The picker remains a standard-size
icon/count control; the chip owns the visible provider/model presentation.

This is intentionally one task, not a new subtask family. T35 and T36 remain
completed historical foundations. Source implementation and runtime validation
are still pending.

### 2026-08-31 — T69 external service authentication planning 🔄

Created T69 as the umbrella for authenticating with external AI and coding
services, with T69a for Codex / ChatGPT subscription authentication and T69b
for Claude Code. Added the shared implementation document
`implementation-details/external-service-authentication.md`.

T39 remains focused on peer Obsidian-plugin integrations. Codex now has two
implementation options: a maintainable desktop adapter around the supported
local `codex app-server`, and an experimental mobile adapter using device-flow
OAuth plus direct HTTP. Public source from Chatting with AI shows that the
mobile approach is feasible. Claude Code still needs its own authentication
review before an implementation path is selected.

### 2026-08-31 — T16 umbrella and group-chat follow-ups 🔄

T16 is retained as the umbrella for multi-agent group chat. Created T16a for
bounded selective working context/shared tool facts and T16b for stable agent
handles and unified `@` resolution. T16a/T16b are design-stage follow-ups;
implementation and acceptance remain open.

### 2026-08-30 — Multi-agent sequential orchestration fixes ✅

Recorded in `sessions/2026-08-30-multi-agent-orchestration-fixes.md` and the
multi-user/agent architecture guide. Sequential dispatch now feeds prior
agent responses into later-agent context. `sanitizeAgentOutput()` removes
attribution echoes, truncates over-generated responses at another-agent
boundaries, and sanitizes returned/displayed/copied text. Commits `81ece43`,
`8a7425b`, and `343c303` are pushed. The commits report clean builds and no
regressions; dedicated multi-agent tests and real-provider acceptance remain
open.

### 2026-08-30 — T66 CSS refactoring handoff 🔄

Recorded the completed T66 stylesheet architecture work in
`implementation-details/T66-stylesheet-architecture.md` and reconciled the
selector inventory with the implementation. The monolithic stylesheet is now
split into six ordered partials, regenerated by `scripts/concat-styles.mjs`
from the `prebuild` hook, with the root `styles.css` artifact still tracked.
Verified cleanup includes the duplicate focus/sync declarations and the
unsupported agent-color `attr()` replacement. Commits `1276a0a`, `c242d02`,
`5e22110`, `0d6a035`, and `eff9f38` are pushed on `main`; serial verification
passes 48 test files / 433 tests, TypeScript, build, package, and
`git diff --check`. The Android Settings card-width issue remains unresolved;
the next session should use live DOM/computed-style inspection, and should
review `.wide-text-settings` alignment before another CSS change.

### 2026-08-30 — T67 documentation closeout

The three storage boundaries from the 2026-08-30 sessions are now present in
the checkout and recorded in T67. The current full suite passes 48 test files
and 433 tests. TypeScript, the production build, and `git diff --check` pass.
The source changes are pushed at `fa35c12`. These Memory Bank updates are
currently local. Prettier still reports issues in 28 files, including the four
files from the latest storage extraction.

### 2026-08-30 — T67 boundary 3 complete: plugin-data sync extracted ✅

Extracted `syncPluginData`, `serializePluginData`, `deserializePluginData`,
and `openRemoteStorageSettings` from `storage.ts` into
`src/lifecycle/pluginDataSync.ts`. `storage.ts` now owns initialization,
migration, session-end intelligence, and cleanup only (~200 lines).

Added 11 focused characterization tests in
`src/lifecycle/__tests__/pluginDataSync.test.ts` covering component
filtering, dry-run mode, success/failure/conflict translation, error
handling, default direction from settings, and serialization roundtrip.

Full verification: 29 tests across lifecycle tests, TypeScript, production
build. Commit: `56422f1`.

### 2026-08-30 — Storage and turn-lifecycle refactoring started 🔄

Extracted settings/chat persistence into `src/lifecycle/persistence.ts` and
user/tool action handling into `src/agent/turnActions.ts`. Extracted sync
orchestration (`initSyncEngine`, `triggerSync`, `rebuildSyncIndex`,
`cancelSync`) into `src/lifecycle/sync.ts`. `storage.ts` now owns
initialization, plugin-data sync, session-end intelligence, and cleanup only.

Added 18 focused characterization tests in
`src/lifecycle/__tests__/persistence.test.ts` covering settings load/save
guards, WebDAV password handling, rolling backup creation, chat-data write
queuing, auto-sync debouncing, and legacy key stripping for jsonl format.
At this stage, the focused persistence work and source changes were complete;
later sessions completed the production build and remote push.

### 2026-08-30 — T65 zero-budget boundary fixed ✅

`ThreeTierMemoryStore.getSystemPromptContext(0)` now returns no memory
context, so an identity budget consumed by the persona cannot accidentally
inject the entire core tier. Added focused regression coverage. The local
suite now passes 46 test files / 404 tests; TypeScript and the production
build remain green. T65's migration-event audit and versioned upgrade
contract are still open.

### 2026-08-30 — Overall code review and stylesheet task recorded 🔄

Recorded the read-only monolithic-files audit at
`implementation-details/monolithic-files-audit-2026-08-30.md` against
`579252b`. The reassessment confirms `storage.ts` as a cross-domain
coordinator and keeps `turnLifecycle.ts` behind the existing model-history
reassessment gate. Created T66 for separately owned CSS architecture and
cleanup; stylesheet implementation remains last. No production source was
changed.

### 2026-08-30 — T65 implementation closeout 🔄

Completed the main T65 implementation: tiered CRUD and prompt integration,
curation tools, ranked archive search, session-end staged evaluation, bounded
legacy backup cleanup with configurable retention, and persisted memory
metadata. Verification remains green at 403 tests and production build.
Remaining follow-up is a formal migration-event audit/version upgrade contract.

Commits: `bbc25bd`, `8f82c7a`, `c03ad8c`, `747caad`, `605633c`.

*Last Updated: 2026-08-30 01:07:32 IST*

### 2026-08-30 — T34 settings/runtime follow-up ✅

Completed and pushed the settings UX and runtime fixes: search navigation,
API-key reveal/copy, slider values, heading consistency, Custom Commands layout,
persistent collapsible sections, runtime manifest lookup, and deferred sync
initialization. Verification: 46 test files / 403 tests and production build.
Commit: `887480b`.

### 2026-08-29 — T65: Three-tier memory system (late evening) 🔄

Implemented the three-tier memory architecture (core/staged/archive) with
score-based auto-curation. Core tier (50-200 entries) feeds the system prompt.
Staged tier holds new memories awaiting evaluation. Archive tier is search-only.

Key commits: `e32f8da` (budget wiring), `5367ea0` (nested settings),
`f536c5b` (plugin info), `39c7f33` (ThreeTierMemoryStore),
`f84323e` (memoryCoreSize UI).

Next: Wire `ThreeTierMemoryStore` into `buildSystemPrompt()`, add agent
curation tools (`evaluate_staged`, `cull_core`), implement TF-IDF index for
archive search, add auto-curation hooks.

### 2026-08-29 — T64d, T26: Live token validation and agentic-memory audit

The agentic-memory review found that the flat persistent memory foundation is
implemented: `MemoryStore`, persona loading, CRUD/search tools, audit logging,
duplicate pruning, optional session-end summarization, and explicit
`search_past_sessions` are present in source. The T26 record had stale wording
that treated some of these as entirely missing; it now distinguishes
implemented, unverified, and future work.

The clearest small follow-up is wiring the editable
`identityContextBudget` setting into `buildSystemPrompt()`. The hot/cold
`core.json` / `archive.json` architecture, ranked search, automatic memory
curation, proactive memory, phrase-based past-session injection, and peer
plugin bridges remain deferred design work. No source code changed in this
audit.

### 2026-08-29 — T64d expanded live token validation ✅

This separate session recorded the live benchmark run against OpenRouter with
`openai/gpt-4o-mini`. The expanded run completed 20 requests across four
fixtures and five strategies, including the missing deterministic compaction
projection. Provider-reported prompt usage was lower than the local estimate
in 18 requests; the average difference was -54.7%, ranging from -98.88% to
+18.54%. Provider-reported benchmark cost was $0.00628440.

T64d is complete with the per-request results, cost evidence, and
recommendation. Do not apply one global correction to `estimateTokens()` yet.
T48d should prefer provider usage when available and label local values as
estimates otherwise. The benchmark validates the compaction payload projection,
not the separate production summary-generation request. T46
provider-switching acceptance was not tested by this fixture run.

### 2026-08-29 — T62a automatic agent-mode preservation ✅

The selected automatic agent-mode preservation policy is implemented.
`src/context/modelHistory.ts` is now the shared
entry point for model-facing history: it applies replay mode, checks tool
pairing, applies the request budget, and returns the messages sent to the
model. Agent turns automatically use preserve mode; normal chat keeps its
configured setting.

`TurnLifecycle`, `AgentLoop`, and `OpenResponsesLoop` now use the shared
history path or its continuation helpers. The saved transcript is unchanged.
Verification passed: 45 test files / 381 tests, TypeScript, formatting, and
the production bundle. Full provider acceptance, pairing through compaction,
and exact historical retrieval remain open.

### 2026-08-29 — Fresh architecture review and implementation plan

The fresh read-only review examined the post-refactor source at `63bce58`; the
dated reports are archived under `memory-bank/architecture-reviews/`. The
documentation archive is now on `main` and `origin/main` at `a08430b`. The
four review targets are now small coordinators or adapters:
`ToolExecutor.ts` is 326 lines, `useMessageActions.ts` is 220 lines,
`api.ts` is 363 lines, and `main.ts` is 228 lines. The extracted handler,
turn, provider, history, streaming, registration, event, and storage modules
are present.

T46a is complete. T46 remains active only for provider-switching and real-
provider runtime acceptance. The review's non-blocking cleanup items remain:
the long executor setup, the temporary `__ambiguous` file property, the late
cancellation check, pagination documentation, and a few `any` casts.
`ChatApp.tsx` remains about 1,023 lines but is still treated as a composition
layer rather than a new T46 extraction target.

T48b/T48c local work is recorded in commit `b49ad7d`: shared tool replay
serialization, pairing checks, compaction response validation, source IDs,
derived-summary marking, and the T64b retention sweep. T64b is complete.
Exact historical retrieval, an inspectable compaction record, and provider or
plugin acceptance remain open.

Current plan: consolidate model-history policy behind one model-ready history
boundary under T48/T48a/T48b/T48c/T62a, then reassess whether `TurnLifecycle`
needs another extraction. Capability-construction cleanup remains with
T60/T60a. At that time, sync decomposition remained deferred; it was later
completed under T67. No new task or subtask was created.

### 2026-08-29 — T61 self-settings integration acceptance ✅

Completed T61. Added end-to-end tests through `ToolExecutor` covering
sanitized settings reads, the Developer mode gate, valid updates, automatic
saving, audit records, invalid values, and immutable keys.

- Full verification passed: 44 test files / 373 tests, TypeScript, formatting,
  and the production build.
- Developer mode remains the user-controlled gate; no separate confirmation
  prompt was added.

### 2026-08-29 — T60a/T60c safety and registry completion ✅

Completed both requested architecture-review follow-ups.

- T60a now uses the resolved tool descriptors for group-chat prompts and the
  pending approval card. Provider names, titles, risk, and preview styles come
  from the same descriptor captured for the pending call.
- Provider enablement and read-only availability are resolved through the
  shared registry filter. Native, OpenResponses, group-chat, and approval
  paths use the same resolved definitions.
- T60c now limits batch reads to eight at a time, serializes conflicting
  mutations by normalized target, and returns a content fingerprint from
  `read_note` for optional stale-write checks.
- Full verification passed: 43 test files / 369 tests and TypeScript.
- T46 remains active only for provider-switching and real-provider acceptance;
  the user confirmed that its tests pass.

### 2026-08-29 — Memory Bank task registry cleanup ✅

Reconciled `memory-bank/tasks.md` with the individual task records after the
2026-08-29 pull and review.

- Moved completed tasks out of the active table, including T8, T8a, T13b, T44,
  T46a, T49, T55, T56, T57a–T57c, T58a–T58c, T60b, T60d, T60f, and T62.
- Kept T46 active only for provider-switching and real-provider acceptance.
- Recorded T61 as in progress: the implementation exists, but integration
  tests and final acceptance are still open.
- Preserved T60e and T18a as paused tasks and corrected the registry totals.
- No source code was changed.

### 2026-08-28 — T13b: Tool Call Result Display Consistency ✅

Fixed `ToolCallNotification.tsx` to show meaningful detail for all 18 built-in
tools instead of generic `"completed successfully"` text.

**Implementation:**
- Added explicit `web_search` rendering with result count header
- `search_note_content` shares matches table rendering with `search_notes`
- Generic fallback chain: `content` → `path` → `matches` → success
- All future tools returning these fields auto-render without code changes

**Commits:**
- `abde5df` — `(fix)T13b: Add smart tool result display, fix auto-sync toggle`
- `84b4ad9` — `(fix)T13b: Enhance tool result display + document exact behavior`

**Reference:** `memory-bank/implementation-details/agentic-tool-calling.md` → "Tool Call Notification Display — T13b"

### 2026-08-28 — Mastra SDK Evaluation 📋

Evaluated Mastra (by Vercel team) as alternative to Vercel AI SDK for workflow
orchestration with human-in-the-loop approval.

**Key features:** `suspend()`/`resume()`, state snapshots, type-safe workflows
**Verdict:** Not migrating. Current `PendingToolCard` + manual loop achieves
the same pattern — just with more code. Revisit if workflow complexity grows
(multi-agent, branching, persistent state).

**Key insight:** Streaming "chunkiness" with Kimi/Gemini is provider-level
behavior (server-side buffering), not fixable by switching SDKs.

**Reference:** `memory-bank/implementation-details/ai-sdk-migration.md` → "Future Alternatives: Mastra"

### 2026-08-28 — T41 v1.4.1 Community Review Fixes

Released v1.4.1 to fix blocking Obsidian Community Review errors:
- `no-unsupported-api`: Replaced `app.loadLocalStorage/saveLocalStorage` with browser `localStorage`
- `no-static-styles-assignment`: Refactored ~49 inline styles to CSS classes
- Fixed release tag from `v1.4.1` to `1.4.1` (Obsidian requires exact match with manifest version)
- Review status: ✅ Passed

### 2026-08-28 — T46/T46a review closeout and merge

PR #7 (`T46: Reconcile orchestration decomposition`) was merged into `main`
as `975bb7e`. Review follow-ups routed agent-provider slash commands through
`runChatTurn()`, reused the turn `ToolExecutor` across manual approvals, and
formatted `turnLifecycle.ts`.

Added regression coverage for the slash-command route and approval-resume
executor reuse. Verification passed with 42 test files / 363 tests,
TypeScript, the production build, the changed-file Prettier check, and
`git diff --check`. Provider-switching and real-provider acceptance remain
runtime gates for T46.

### 2026-08-27 — T46/T46a reconciliation

The reconciliation branch keeps the main-branch `TurnLifecycle`, `api.ts`, and
`main.ts` decompositions and integrates the feature branch's decomposed
`ToolExecutor`, resolved registry, `ChatTurnCoordinator`, and `ChatTurnOutput`.
`useMessageActions.ts` is 217 lines; `ToolExecutor.ts` is 292 lines;
`api.ts` is 363 lines; and `main.ts` is 226 lines.

Fresh verification passed: 43 test files / 362 tests, TypeScript, and the
production build. Provider-switching and real-provider acceptance remain
runtime gates. The reconciliation branch was subsequently merged into `main`.

### 2026-08-27 — T46a turn output extraction

Added `ChatTurnOutput.ts` to collect text, tool calls, tool results, and
content parts without React or Obsidian services. The hook still owns visible
streaming updates, interruption display, and approval prompts.

`useMessageActions.ts` is now 1,252 lines. Verification passed: 43 test files,
362 tests, TypeScript, and the production build. The next boundary is the
remaining UI callback and approval lifecycle code; `api.ts` and `main.ts`
remain later phases.

### 2026-08-27 — T46a turn persistence extraction

Added `ChatTurnPersistence.ts` and moved completed assistant-message creation
and session-message updates out of the hook. `useMessageActions.ts` is now
1,302 lines. The hook still owns UI-specific interruption display, approval
state, and runtime cleanup.

Verification remains green: 42 test files, 360 tests, TypeScript, and the
production build. The next boundary is the remaining UI callback and approval
lifecycle work; `api.ts` and `main.ts` remain later phases.

### 2026-08-27 — T46a request preparation extraction

Added `src/agent/ChatTurnRequest.ts` on the architecture branch. It now owns
system-prompt creation, tool-history projection, request budgeting, attachment
message assembly, and the final model-message list. The hook supplies inputs
and keeps UI updates and persistence.

`useMessageActions.ts` is now 1,305 lines. Focused tests, the full 359-test
suite, TypeScript, and the production build pass. The next T46a work is to
move the remaining turn callbacks and persistence boundary out of the hook.

### 2026-08-27 — T46 capability domains split

The next T46 slice is complete on `feat/t46-architecture-decomposition`.
The temporary `ToolHandlers.ts` grouping has been replaced with separate
modules for note, bulk, discovery, vault, web, memory, session, and settings
work. `ToolHandlerContext.ts` supplies the shared Obsidian services.

`ToolExecutor.ts` is now 292 lines. Focused tool/provider tests, the full
359-test suite, TypeScript, and the production build all pass. The next step is
the T46a request-lifecycle extraction; `api.ts` and `main.ts` remain later
phases.

### 2026-08-27 — T46/T46a implementation branch

Implementation is in progress on `feat/t46-architecture-decomposition`, based
on `a15c47646e1141239b269c8f608331889b1b32df`.

- `ToolExecutor.ts` is now 265 lines and delegates to the resolved registry.
- `ToolResolver.ts` and note handlers own path lookup and note changes.
- `ToolHandlers.ts` temporarily contains the remaining capability areas and is
  the next physical split.
- `ChatTurnCoordinator.ts` runs native and OpenResponses turns through one
  React-independent entry point.
- Prompt and OpenResponses tools use the same resolved definitions as
  execution.
- Verification: 41 test files, 359 tests, TypeScript, production build, and
  focused coordinator/hook tests pass.

The hook remains 1,350 lines and still owns request preparation, history,
persistence, and approval state. `api.ts` and `main.ts` remain future phases.

### 2026-08-27 — T64b Experiment Run: Message Window Simulation

Added `maxContextMessages` simulation to harness and ran against grammar migration
fixture (real session JSON, 13 assistant turns).

**Results** (tiktoken estimator):

| MsgCap | Mode | ToolTok | Total | Peak | vs Unlimited |
|--------|------|---------|-------|------|-------------|
| ∞ | preserve | 64000 | 146,747 | 23,450 | — |
| 10 | preserve | 64000 | 85,110 | 11,217 | **-42%** |
| 10 | preserve | 4000 | 76,510 | 10,708 | -41% |
| 10 | elide | 4000 | 6,868 | 803 | -95% |

**Conclusion**: `maxContextMessages: 10` is the dominant token-reduction mechanism
for this workload. The `maxToolResultTokens` threshold matters only in preserve
mode (11% difference between 4000 and 64000). The T64a bug (preserve still
truncates at the threshold) has small impact at 64000.

**For T62a**: Data supports auto-preserve for agent mode — with a 10-message
cap, preserve mode stays bounded at ~85K total tokens, making the "cost" of
full retention acceptable.

---

### 2026-08-27 — Architecture Modularity Review and Refactoring Plan

The read-only architecture review and file-size scan identified responsibility
concentration, not merely large files. Current primary candidates are
`ToolExecutor.ts` (2,159 lines), `useMessageActions.ts` (1,533), `main.ts`
(1,785), and `api.ts` (765). `ChatApp.tsx` is 1,029 lines but remains mostly
a composition layer after T22.

Durable ownership is now recorded as follows:

- T60/T60a own capability semantics, resolved availability, and execution
  pipeline; T46 owns their physical decomposition.
- T46a owns the proposed extraction of a testable chat-turn coordinator from
  `useMessageActions.ts`.
- T48b/T48c/T62a own model-history representation, compaction/retrieval, and
  elision policy; T64a-T64d provide benchmark evidence for the decision.
- Sync decomposition remains speculative and no new sync task is created.

Implementation order: complete T60a ownership/projection work, decompose
`ToolExecutor.ts`, select and consolidate model-history policy using T64b,
extract the T46a turn coordinator, then reassess `api.ts` and `main.ts`.

### 2026-08-27 — T64: Experiment Framework Design Complete

**Current focus:** Implementing T64 benchmark experiment framework.

Experiment framework designed with 7 experiments to determine optimal context
optimization settings. Priority order:
1. **T64b** — Preserve mode content retention (addresses active T62a bug)
2. **T64a** — Pareto frontier sweep (most actionable config data)
3. **T64c** — Fidelity-weighted scoring (quality-aware rankings)
4. **T64d** — Live estimator validation (costs money, deferred)

**Next step:** Implement harness extensions for parameterized strategies and
fidelity metrics, then run Experiment 2 (preserve retention).

---

### 2026-08-26 — T62 Elision Regression Discovered

**Critical UX issue:** Default `"elide"` mode breaks multi-turn agent workflows.

When the agent calls `read_note` and gets 22k chars of content, the next turn's
history replay shows `[22749 chars, elided]` — the agent cannot see the content
it just read. This makes it impossible to do multi-step analysis, pattern
extraction, or any work that builds on previously retrieved information.

**Root cause:** T62 was designed for token reduction in user-facing chat replay,
not agentic workflows where the agent needs to retain tool result context across
turns.

**Workaround:** Switch `toolHistoryMode` to `"preserve"` in Settings → Chat Defaults.

**Fix needed:** Options include smarter elision (summaries instead of `[elided]`),
agent-mode bypass, lazy loading, per-session toggle, and per-file/pin control.
**Follow-up task created:** T62a (see `tasks/T62a.md`) with 6 candidate solutions
and open questions.

### 2026-08-26 — T64: Context Optimization Benchmark Harness planned

Created standalone top-level task T64 for a benchmark harness that measures
and optimizes token usage without requiring the Obsidian runtime. The harness
is deliberately cross-cutting (serves T48, T48a, T48d, T6a, T60d) and
standalone rather than a T48 subtask to keep boundaries clean.

**Level 1** (no API calls): reconstructs model-facing history from session
fixtures using the same `buildBudgetedHistory` / `buildHistoryWithTools` code
paths as the plugin. Tests sliding window, tool eliding, compaction, budget
caps, and deduplication strategies.

**Level 2** (optional, live API): replays fixtures through real provider calls
to validate estimate accuracy against provider-reported usage.

Updated: T48c.md (diagnostic path → T64), T48a.md (provider-window discovery
→ T64), T48d.md (ground-truth measurements → T64), tasks.md (+T64 entry).
New files: `tasks/T64.md`, `implementation-details/context-benchmark-harness.md`.

T60a/T60c/T60d implementation and review fixes are on the feature branch;
T60f pagination is complete. Live testing succeeded for note and session list
pagination. The project passes 37 test files / 320 tests, TypeScript, and the
production build. T60a and T60c retain incomplete criteria; the native AI SDK
loop's cumulative context resend remains a separate follow-up.

### 2026-08-26 — T60f Result Pagination Plan

The tool inventory found nine result-limited built-in tools without a reliable
next-batch mechanism. T60f now owns bounded pagination and continuations,
separately from T60d's token-efficient search defaults. No source changes have
been made for T60f.

### 2026-08-25 — T60e/T15 Provider-Adaptive Streaming Plan

The current `b56f806` runtime streams visible text but delays tool-call UI
callbacks until a response step ends, hides reasoning deltas, and does not
surface partial tool arguments. A separate-branch follow-up was approved:
`feat/t60e-provider-adaptive-streaming-ui`.

T60e owns the provider-neutral event/lifecycle contract across AI SDK and
OpenResponses; T15 owns the visual progress states and provisional tool cards;
T60c owns complete-argument validation and execution hardening. No source code
has changed for this plan.

### 2026-08-25 — Runtime Finding: search_note_content Performance Issue

During T60b fix validation, user ran the same prompt that caused the original
500k-token incident. The agent now correctly uses `search_note_content` instead
of 17 sequential `search_notes` calls, but the tool itself is too slow for large
vaults:

**Problem:** `search_note_content` is **O(n) over all markdown files** with:
- No persistent index — reads and scans every file every time
- No early termination — continues scanning after finding enough matches
- Sequential I/O — single-threaded file reads
- No timeout — can block for 10+ seconds on 800+ file vaults

**Behavior observed:** Agent calls `search_note_content` repeatedly with no
visible result (each call takes too long), likely causing overlapping scans.

**Code location:** `ToolExecutor.ts:searchNoteContent()` — the loop has no
`break` when `limit` matches are found, and no cap on files scanned.

**This is separate from T60b** — the protocol fix works, but the tool has a
latency/timeout issue. Validates the need for T60d and adds performance as a
dimension.

**No source changes made yet** — user requested diagnosis only.

---

### 2026-08-25 — T60b OpenResponses loop bug diagnosis

- Verified 3 protocol bugs in the OpenResponses loop that cause unbounded token
growth during multi-step tool chains:
  1. **Duplicate input submission:** `streamAgentResponse({ input, tools })` is
     inside the `while` loop, resubmitting the full conversation on every tool
     round (direct cause of 500k-token incident)
  2. **Discarded continuation ID:** `previousResponseId` accepted by
     `continueWithToolResult()` but never serialized to request body;
     continuations are sent as stateless requests
  3. **Continuation handler gap:** Post-continuation stream only handles
     text/finish/error, not function_call/function_call_done — multi-round
     chains fall back to broken outer loop
- Minimal fix spec ready: move initial request outside loop, store response_id,
  use continuations via `previous_response_id`, shared handler with full event
  support
- **Implementation complete** (commit `38c352d`):
  - `AgentApiManager.ts`: Added `previousResponseId` to `AgentApiOptions`,
    serializes to `body.previous_response_id`, passes through `continueWithToolResult()`
  - `OpenResponsesLoop.ts`: Moved initial request outside loop; shared
    `consumeStream` handler with full event support; stateful continuations;
    tools preserved
  - Tests: 3 new tests covering continuation serialization, multi-round tool
    chains, and budget sharing. All 301 tests pass. Build passes.
- Impact: ~140× token reduction for multi-step chains (500k → 3.6k tokens)
- Memory-bank updated: 7 task files, 1 implementation detail doc, 1 edit chunk,
  1 new proposed task (T60d for search defaults)

### 2026-08-25 — T60 review correction and next gate

- Commit `68dc915` added a bounded T60a registry adapter and projection tests;
  it did not connect the registry to `ToolExecutor`.
- T60a remains active and incomplete. T60b and T60c remain paused.
- The first implementation step is now a failing integration test: a registry
  definition for `read_note` must execute and return the same result contract
  as the existing `ToolExecutor` path.
- The registry must retain provider metadata through execution, use one
  shared availability filter, support explicit titles, and reject unusable
  provider schemas. Tests should check behavior rather than tool counts or
  boilerplate version values.
- No additional task or design documents are needed until this integration
  gate passes.

### 2026-08-25 — T60 tool-system architecture plan

- Audited 24 built-in tools, the read-only peer-provider registry, native AI
  SDK loop, OpenResponses loop, council mode, approval UI, dispatch, prompt,
  result formatting, and focused tests.
- Created T60/T60a–c for the canonical capability registry, cross-loop
  transport parity, and validated execution boundary.
- Kept approval/audit in T38, provider lifecycle in T39a, physical
  decomposition in T46, advanced vault tools in T17, and exact historical
  retrieval in T48c.
- Created T18a for bounded web-page retrieval. No source implementation began.
- Recommended first implementation: T60a registry plus focused AI SDK and
  OpenResponses serializer tests.

### 2026-08-23 — T48c implementation validation and current boundary

- T48 implementation is merged to `main` through PR #5 as `6a205b9`.
- The merged slice provides request budgeting, bounded tool-result replay,
  semantic compaction, configurable trigger/release values, asynchronous
  summarization, and a visible completion notice.
- Live validation used trigger `8,000`, release `4,000`, and four preserved
  recent messages. The fourth turn triggered compaction and the recovery prompt
  recovered all four seeded markers and representative requirements.
- T48c remains active for diagnostic instrumentation, schema/provenance and
  tool-pair validation, repeated compaction coverage, exact historical
  retrieval, and summary inspection/persistence. T48d remains active for
  provider-aware usage reconciliation.

### 2026-08-23 — T48c compaction-strategy research

- Created `context-compaction-strategies-reference.md` as a durable survey of
  provider, framework, research, and OpenClaw approaches.
- Updated `conversation-compaction-design.md` with the selected hybrid ladder,
  structured/audited summary contract, provider extension points, and two-slice
  implementation path.
- T48c remains active; this was a documentation-only update.

### 2026-08-23 — T48 context-efficiency decomposition

- Expanded T48 from turn-count compaction to token-budgeted model context.
- Created T48a-T48d for request budgeting, bounded tool replay, rolling
  compaction, and usage reconciliation.
- Full transcript remains available to the user; model history uses a bounded
  canonical representation and compact tool-result summaries.
- T6a remains complete and supplies provider-usage accounting; T48 owns
  context construction and compaction.
- Quality guardrails approved for implementation: preserve the newest 3–5 turns
  verbatim (default 4), structure decisions/constraints/open work/tool
  outcomes, label summaries as derived context, retrieve exact older material
  on demand, and ask rather than invent when the summary is insufficient.

---

*Last Updated: 2026-08-23 01:27:43 IST*

### 2026-08-23 — T58/T58c/T58d session closeout and rebuild audit

- Completed and verified the T58d implementation slice: planning-stage
  progress, stable operation rows, latest-active shimmer, persistent
  completion progress, dry-run plugin-data planning, and chat-session rebuild
  progress with scan reuse and bounded concurrency.
- Confirmed plugin data is included in normal sync and dry-run planning and is
  shown separately from chat sessions, while the chat-session SyncIndex remains
  session-only.
- Audited the Rebuild action and recorded that it does not rebuild plugin-data
  shared state. A separate plugin-data rebuild/reconciliation phase remains
  follow-up; do not merge plugin files into the session index.
- Verification remains: 29 test files / 269 tests, TypeScript, Prettier, and
  production build passed. Focused UI/rebuild tests and live acceptance remain.
- Implementation commit `13efc4e` and documentation commit `ae79c7e` are pushed
  to `origin/main`; this closeout adds only Memory Bank documentation changes.

### 2026-08-23 — T58 task ID migration and approved progress/rebuild plan

- Restored T43 as the original Multi-User and Agent Chat task because that is
  its historical meaning in the task registry and Git history.
- Moved the integrated sync UI records to the canonical T58 namespace:
  T58, T58a, T58b, and T58c. The old T43a-c files now point to their renamed
  records so historical links remain usable.
- Created T58d to track the approved unified progress, dry-run plugin-data
  planning, stable operation rows, latest-item shimmer, persistent completion
  state, rebuild progress, conflict status, and rebuild performance work.
- No source code was changed; implementation and real-host acceptance remain
  open.

### 2026-08-23 — T58d implementation slice

- Added a shared sync progress contract with explicit planning, syncing,
  rebuilding, completion, and error phases.
- Sync planning now reports visible stages before transfers. Dry runs include
  selected plugin-data components through a read-only planner and do not write
  plugin files, shared state, retry records, or sync logs.
- Stable operation IDs update one row from active to terminal state. Only the
  latest active row receives the shimmer, and the final progress bar remains
  visible at completion.
- Rebuild reuses its first local/remote scan, reports planning and index-write
  progress, and uses bounded concurrency for independent transfers.
- Verification: TypeScript, Prettier, 269 tests across 29 files, and a
  production build passed. Focused UI/rebuild tests and real-host acceptance
  remain open.

### 2026-08-23 — T57c and provider usage reconciliation

- T57c is complete in code. Sync identity now covers vault, backend, server,
  account, remote path, and encryption identity and isolates cache, index,
  plugin-file state, and retry records.
- Durable retry records retain failed chat-session and plugin-data work with
  backoff; successful shared-state items remain skipped on later runs.
- The sync panel now includes plugin-data operations in progress and reports
  chat-session and plugin-data categories separately as complete, partial, or
  failed.
- The token discrepancy is addressed by persisting AI SDK provider usage per
  response. Usage stats no longer double-count the saved user estimate and use
  a full-request estimate for responses without provider usage.
- Verification: 29 test files / 268 tests passed, TypeScript clean, production
  build passed.
- Remaining: T57d SyncIt contract and overlap acceptance test; older raw
  plugin-file migration; live OpenRouter reconciliation still requires a real
  request because provider availability cannot be proven by local tests.

### 2026-08-22 — T57b Two-Way State, Recovery, and Deletions Implemented

- Added durable per-file shared state with encrypted remote state and local
  state persistence.
- Added explicit local, remote, both, and cancel conflict choices through a
  user-facing conflict modal.
- Added recovery copies before local replacement/deletion and conflict copies
  for keep-both.
- Added deletion tombstones carrying the prior shared checksum. Missing remote
  data without a matching tombstone is reported and left untouched.
- TypeScript passed, full build passed, and the full test suite passed: 263
  tests across 27 files.
- T57b is complete. T57c durable retries/identity, T57d SyncIt contract, and
  migration for older raw plugin files remain open.

### 2026-08-22 — T57a Shared Plugin-File Sync Implemented

- Added `PluginFileSyncManager` and routed plugin settings, memory, persona,
  audit, and usage transfers through it.
- Remote plugin files now use a versioned envelope with a checksum and shared
  encryption when enabled.
- WebDAV writes use a temporary file followed by replacement. Local downloads
  use Obsidian's atomic process operation when replacing an existing file.
- Malformed or tampered remote data is rejected without changing local data.
- In two-way mode, differing local and remote files are reported as conflicts;
  neither side is overwritten yet.
- TypeScript passed, the full build passed, and the full test suite passed:
  256 tests.
- Implementation commit: `38f9f9e`.
- T57b is now complete for remembered state, recovery, deletion records, and
  user choices.

### 2026-08-22 — T57 Plugin Data Sync Safety and SyncIt Boundary

The user approved the following direction:

- SyncIt owns whole-vault sync.
- Chat Lab keeps plugin-aware sync for its own data and must not add whole-vault
  sync.
- The existing `integrationProvider` remains an AI tool interface. A future
  `dataSyncProvider` is a separate contract.
- T57a–T57d cover the common file path, two-way conflicts and recovery,
  identity/retry/reporting, and the SyncIt integration boundary.

Beads issue creation was attempted but blocked because this checkout has no
`.beads` database. Do not initialize a new issue database without explicit
direction.

### 2026-08-22 — Sync and Memory Bank Audit Corrections

The remote-storage audit found that the session-sync path is more mature than the auxiliary plugin-data path. The Memory Bank now records this boundary plainly.

- T42 remains active: the WebDAV baseline is merged, but full sync scope is not complete.
- T42a–T42e are implemented in code but remain open for acceptance checks and safety review.
- T58c is historical where T55 changed its behavior; memory, persona, audit, and usage files are now optional components.
- Auxiliary plugin files are not yet protected by every chat-session-specific
  feature; the shared plugin-file path now has encryption, checksums,
  atomic-write, conflict, recovery, and deletion protections.
- Durable retry records, complete sync identity handling, and older raw-file
  migration remain open.
- T56 is a first reorganization pass; its FileSyncManager, shared index, and component-delta work remain open.

### 2026-08-21 — T58 Subtasks Complete

All three T58 subtasks completed:

| Subtask | Issue | Status |
|---------|-------|--------|
| **T58a** | Fix rebuildSyncIndex title resolution | ✅ Complete |
| **T58b** | Add activity indicators to sync UI | ✅ Complete; T58d follow-up open |
| **T58c** | Extend sync to all plugin data | ✅ Complete |

**T58a:** Applied `titleMap` pattern from `triggerSync()` to `rebuildSyncIndex()` — eliminates "Untitled Session" by resolving titles from local cache, sync cache, then truncated ID.

**T58b:** Added CSS animations for visual feedback during sync:
- Rotating spinner in status heading (pure CSS, low CPU)
- Pulsing progress bar during active sync
- Shimmer animation on pending list items

**T58c:** Extended sync beyond chat sessions to plugin data:
- `StorageAdapter` gained `readText()` method
- `syncPluginData()` serializes settings (minus API keys) + sync index
- Auto-called after successful session sync
- Last-write-wins conflict resolution with notification

---

### 2026-08-21 — T55: Component-Level Sync Selection ✅

**Commit:** `7e0821b`

Added `SyncComponentConfig` to settings with 7 toggles controlling which data components participate in remote sync and export/import:
- Chat sessions, Plugin settings, API keys, AI Memory, Memory audit log, AI Persona, Usage stats
- New "Sync Components" settings section placed between Multi-User Sync and Remote Storage
- Export/import filter by component; remote sync respects toggles
- Usage stats computed on upload, skipped on download
- API keys excluded by default; credential fields never overwritten from remote

**Files:** `src/settings.ts`, `src/settings-sections/syncComponents.ts` (new), `src/settings-sections/SettingsTab.ts`, `src/settings-sections/exportImport.ts`, `src/main.ts`

---

### 2026-08-21 — Planned Changes (Sync/Storage/Global Reorganization) — COMPLETED as T56

All three architectural improvements implemented in commit `45917c8`:

1. **Rename "Multi-User Sync" → "Multi-User Chat Relay"** ✅
   - Settings nav and UI labels updated

2. **Unified Plugin Data Management Layer** ✅
   - `PluginDataManager` created at `src/data/PluginDataManager.ts`
   - Single source of truth for serialization/deserialization
   - Used by both export/import and remote sync

3. **Global Reorganization** ✅ (Phase 1)
   - Eliminated ~210 lines of duplicated logic across exportImport.ts and main.ts
   - Coherent `extractSettings()` / `mergeSettings()` / `redactSecrets()` pipeline
   - Foundation laid for further modularization (FileSyncManager, delta sync, etc.)

See `tasks/T56.md` for full details.

---

### 2026-08-21 — T51: Telemetry DISABLED — Obsidian Policy Block

**Finding:** Obsidian's developer policies **explicitly prohibit client-side telemetry** for plugins in the official Community Plugins directory.
- The "Kindle Highlights" plugin was **delisted** for sending telemetry to Sentry
- Even opt-in, anonymized telemetry violates this policy
- Source: [Obsidian Developer Policies](https://docs.obsidian.md/Developer+policies)

**Action:** All telemetry code removed from the plugin:
- `src/lib/telemetry.ts` — deleted
- `src/settings-sections/telemetry.ts` — deleted
- `src/main.ts` — removed first-run dialog, init, flush
- `src/settings.ts` — removed `telemetryEnabled`, `telemetryId`, `telemetryAsked`
- `src/components/ChatApp.tsx` — removed `chat_started` event logging
- `src/agent/AgentLoop.ts` — removed `tool_used` event logging

**Archive:** Complete implementation preserved in `memory-bank/implementation-details/telemetry-implementation-archived.md`

---

**Task:** T58 — Integrate Sync UI into Chat Lab
- Replaced standalone `SyncSidebarView` with integrated sync tab inside Chat Lab
- Export button becomes dropdown with Export + Sync options
- Sync opens as non-session tab (`__sync__`) with rich progress UI
- Direction control: Two-way / Upload only / Download only
- T42f superseded by T58

**Commits:**
- `dd4a989` — Phase 1: Remove 2nd sidebar
- `486cd1d` — Phase 2: Add syncDirection setting
- `570be35` — Phase 3: Export dropdown + Sync tab
- `02e1ba2` — Phase 4: ChatSyncPanel with rich progress UI

**Files created:**
- `src/components/ChatSyncPanel.tsx`

**Files modified:**
- `src/main.ts` — Removed sync sidebar, updated triggerSync with direction/callbacks
- `src/settings.ts` — Added syncDirection
- `src/components/ChatApp.tsx` — Wired ChatSyncPanel for `__sync__` tab
- `src/components/ChatTabBar.tsx` — Special tab support
- `src/components/presentational/ActionBar.tsx` — Export dropdown menu
- `src/components/ChatToolbar.tsx` — onOpenSync prop
- `styles.css` — Sync panel styles

**Files deleted:**
- `src/ui/SyncSidebarView.ts`

---

### 2026-08-19 — Session Closeout: T6a, T49, T51 Complete; T41 Intermittent Bug Fixed

**Completed today:**
- **T6a** (`161fee3`): Token counter accuracy fix with settings toggle
- **T49** (`0061937`, `966e8fe`, `c68faa9`): Settings export/import with vault-native file ops
- **T51** (`05c53c8`): Opt-in telemetry with first-run dialog
- **T41 fix** (`b582dfa`, `8ae8650`, `dc0f173`): Updater cache-busting + mobile diagnostics

**Key decisions:**
- Export/import uses vault-native operations (works on mobile + desktop)
- Telemetry endpoint at `quantumofgravity.com/telemetry` (backend TBD)
- Updater diagnostics go to `debug.log` (mobile-accessible via Settings → Diagnostics)

---

# Active Context

*Last Updated: 2026-08-19 19:44 IST*

### 2026-09-09 — Per-step request telemetry

- Added the `debugTelemetry.includeRequestBreakdown` setting, including the
  Debug Mode toggle and safe agent read/write support.
- Native tool-enabled model steps now retain bounded request estimates for
  tool schemas, selected history, continuations, and tool results, alongside
  per-step provider usage and cached-input usage when available.
- Debug JSON/JSONL/Markdown exports expose these records as
  `telemetry.agentSteps` while preserving the existing provider-usage and
  estimate filters.
- The Debug Mode settings panel now groups export controls, aligns switches to
  the right edge, and uses tighter section-specific spacing.
- Verification: 53 test files / 461 tests, TypeScript and production build,
  Prettier checks on changed code, and `git diff --check` passed.
- OpenResponses per-step telemetry parity remains open.

### 2026-08-19 — T42 Phase 6 Scoped: Port SyncIt Features

**New subtasks created for T42 (Remote Chat Storage & Sync):**

| Subtask | Feature | Priority | Status |
|---------|---------|----------|--------|
| **T42a** | Sync Index — Skip Unchanged Sessions | P1 | 🔄 review open |
| **T42b** | Atomic Writes | P1 | 🔄 review open |
| **T42c** | Concurrency Control | P1 | 🔄 review open |
| **T42d** | Server Signature / Cache Invalidation | P1 | 🔄 review open |
| **T42e** | Dry Run Mode | P2 | 🔄 review open |
| **T42f** | Progress UI Improvements | P2 | ⛔ SUPERSEDED by T58 |

**Design docs created:**
- `memory-bank/implementation-details/sync-index-design.md`
- `memory-bank/implementation-details/atomic-writes-design.md`
- `memory-bank/implementation-details/concurrency-control-design.md`
- `memory-bank/implementation-details/server-signature-design.md`
- `memory-bank/implementation-details/dry-run-design.md`
- `memory-bank/implementation-details/progress-ui-design.md`

---

# Active Context

*Last Updated: 2026-08-19 13:31:15 IST*

### 2026-08-19 — DeepSeek V4 Pricing Investigation + New Task Batch (T6a, T48, T49, T50, T51)

**New tasks created:**

| Task | Title | Priority | Status |
|------|-------|----------|--------|
| **T6a** | Token Counter Accuracy Fix — Full Request Payload Counting | HIGH | ✅ COMPLETE |
| **T48** | Conversation Compaction Mechanism | HIGH | 🔄 Active |
| **T49** | Settings Export and Import | MEDIUM | ✅ COMPLETE |
| **T50** | OpenAI Responses API / Threads Support (Stateful Sessions) | MEDIUM | 🔄 Active |
| **T51** | Opt-in Telemetry and Usage Data Collection | MEDIUM | ⛔ DISABLED |

- **T48**: Auto-summarize old conversation turns after N turns to reduce per-request payload.
- **T50**: OpenAI stateful sessions via Responses API.
- **T51**: REMOVED — Obsidian policy prohibits client-side telemetry.

**Implementation docs created/updated:**
- Updated `context-system-design.md` (T6a)
- Created `conversation-compaction-design.md` (T48)
- Created `settings-export-schema.md` (T49)
- Updated `openresponses-implementation.md` (T50)
- Created `telemetry-privacy-design.md` (T51) — archived

---

- **Commits**: `ac24ced` → ... → `e96b703` → `be3c3bb` → `29ad150` → `deff496`
- **Phase 1 (Architecture)**: StorageAdapter interface, LocalCache (IndexedDB), EncryptionLayer (AES-256-GCM via PBKDF2), SyncEngine (delta sync + 3 conflict strategies + state machine)
- **Phase 2 (WebDAV + Settings + Polish)**:
  - `WebDAVStorageAdapter.ts` — PROPFIND, GET, PUT, MKCOL, DELETE using Obsidian's `requestUrl()` for Electron sandbox compatibility
  - Settings types: `RemoteStorageConfig`, `WebDAVStorageConfig`, `S3StorageConfig`, `StorageBackendType`
  - Settings UI: enable toggle, backend selector, passphrase, auto-sync, conflict strategy, WebDAV credentials, test connection button, manual sync button
  - Wired into `SettingsTab` navigation and render pipeline
  - **ETag comparison** — replaced timestamp-based sync with ETag comparison to eliminate false re-downloads due to clock skew (`be3c3bb`)
  - **Terminal-style progress modal** — progress bar, per-session log, elapsed time, session titles instead of ID hashes (`29ad150`)
  - **Sync log files** — local (`sync.log`) + remote (`sync.log`) recording every operation (`29ad150`)
  - **Cancel support** — `_cancelled` flag checked between sessions, finishes current then stops (`deff496`)
- **Build**: TypeScript clean, all 236 tests pass
- **What's Working**: Full end-to-end sync with WebDAV (Nextcloud); 96 sessions populated; ETag prevents re-downloads; logs written locally and remotely; cancel stops sync between sessions
- **What's Next**: S3 backend, conflict resolution UI, sync status badge in chat UI, auto-sync on session changes
- **Task**: `memory-bank/tasks/T42.md` (updated)
- **Design doc**: `memory-bank/implementation-details/remote-chat-storage.md`

## 2026-09-19 19:45 IST — T71 done, T24 index-only startup shipped

Active focus is the `perf/chat-scroll-settings-lag` branch (9 commits, pushed;
HEAD `99860e6`), awaiting Deepak's device verdicts before merge to main and
v1.6.0. T71 (chat scroll perf + streaming follow) completed; T24 gained
index-only startup (57ms device boot load, hard save guard, lazy hydration);
T11 gained event logging + startup phase timings. Suite 506/506. Named next
startup bottleneck: SyncEngine WebDAV init ~4.1s (not started).

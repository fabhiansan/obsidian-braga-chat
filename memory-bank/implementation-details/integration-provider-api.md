# Integration Provider API

*Created: 2026-08-05 17:28:52 IST*
*Last Updated: 2026-09-28 12:35:16 IST*
*Task: [T39](../tasks/T39.md)*

## Purpose

This document specifies a future Integration Provider API for Obsidian AI. A
provider is an ordinary installed peer Obsidian plugin that offers narrowly
scoped domain capabilities to the AI tool workflow. It is not arbitrary code
loaded inside Obsidian AI, and it is not a model-accessible command shell.

The initial provider is Obsidian Git. The same contract should support future
Tasks, Dataview, Templater, and other integrations without hard-coding those
plugins into the chat subsystem.

## Ownership Boundary

| Concern | Provider plugin | Obsidian AI host |
| --- | --- | --- |
| Domain implementation and manual UI | Owns | Does not duplicate |
| Settings, credentials, and tokens | Owns | Never reads or prompts into model context |
| Capability descriptor and executor | Supplies | Discovers and validates |
| Tool schemas exposed to the model | Describes | Namespaces and registers |
| Approval, cancellation, and policy | Supplies progress only | Final authority |
| Result rendering and audit log | Returns structured result | Redacts, renders, and records |

The host must remain able to use its built-in note tools without the provider
API. A provider is optional: absence, disablement, unload, and version
incompatibility are normal availability states rather than chat failures.

**Dataview note (2026-09-28):** The built-in `query_dataview` DQL tool is
available through Dataview's public query API, but it is not a T39 provider
and does not complete the future Dataview provider integration described here.
DataviewJS execution is not part of that built-in tool.

## Scope Boundary: Data Sync

This contract is for AI-facing domain tools, such as bounded Git status or
history actions. It is not a file-sync API and it must not be used to pass
arbitrary vault writes, credentials, or transport work through the AI tool
path.

The future data-sync contract is tracked separately in
[T57d](../tasks/T57d.md). It will be a sibling named `dataSyncProvider`, with
its own version, scopes, lifecycle, and ownership rules. SyncIt may provide
whole-vault transport and retry behavior through that boundary, while Chat Lab
continues to own the selection and serialization rules for its plugin data.

## Provider Contract

The public contract is versioned from the first release. Capability descriptors
are serializable; runtime handlers remain local functions in the installed
provider process.

```ts
interface IntegrationProviderV1 {
  id: string;                 // e.g. "obsidian-git"
  displayName: string;
  apiVersion: 1;
  capabilities: ProviderCapabilityV1[];
  execute(request: ProviderExecutionRequestV1): Promise<ProviderResultV1>;
}

interface ProviderCapabilityV1 {
  id: string;                 // namespaced: "git.status"
  title: string;
  description: string;
  inputSchema: JsonSchema;
  risk: "read" | "write" | "remote-write" | "destructive";
  availability?: "available" | "disabled" | "misconfigured";
}
```

The precise TypeScript names may change during implementation, but these rules
are contractual:

1. Capability IDs are namespaced and unique.
2. Inputs are structured and schema-validated before execution.
3. No `run_command`, arbitrary shell string, arbitrary remote URL, or
   credentials-bearing capability is permitted.
4. Providers return concise typed data and progress events, not HTML or raw
   secret-bearing exceptions.
5. The host rejects incompatible versions and duplicate registrations clearly.

## Lifecycle and Discovery

1. After Obsidian has initialized plugins, Obsidian AI discovers known or
   registered providers.
2. The host validates ID, version, capability namespaces, schemas, and risk
   classification before exposing any tool.
3. The chat tool registry reflects current availability. An unavailable tool
   is omitted from new model calls; a pending call returns a clear unavailable
   result if its provider disappears.
4. Provider unload/disable unregisters its capabilities and cancels or safely
   resolves active work according to the host cancellation contract.
5. Settings show installed, enabled, incompatible, and misconfigured states
   without leaking private provider configuration.

Load order must not be assumed. The first implementation should use a
documented public peer-plugin API plus a refreshable registry, not untyped
access to private implementation fields.

## Host UI Contract

The provider API is not functional from a user's perspective until the host
can show provider availability, obtain consent, and explain results. The first
UI increment remains provider-generic: it must work with a fake read-only
provider before Git-specific write operations are enabled.

### Settings: Integrations

Add an **Integrations** subsection directly after **Agent Tools**. It lists
discovered providers and their host-validated status. Provider configuration
continues to live in the provider's own settings; this view controls only
whether that provider may offer tools to Obsidian AI.

```text
Agent Tools
├─ Enable agent tools                              [ on ]
├─ Tool safety & approval                          [ Read-only v ]
├─ Max agent steps                                 [ 5 ]
└─ Integrations
   ├─ Obsidian Git                    Available · API v1
   │  Read tools: Status, changes, history          [ on ]
   │  Git configuration is managed by Obsidian Git  [ Open settings ]
   ├─ Tasks                          Not installed
   │  Install and enable the Tasks plugin to use it
   └─ Example Provider               Incompatible
      Requires provider API v1; found v2             [ Details ]
```

Allowed status labels are **Available**, **Disabled**, **Not installed**,
**Needs provider setup**, and **Incompatible**. The settings view never shows
access tokens, remote URLs, raw provider configuration, or provider-internal
errors. A refresh action may re-run provider discovery, but the UI must also
refresh when providers load or unload.

### Chat: Pending Provider Operation

Replace the current built-in-tool-name branching in `PendingToolCard` with a
descriptor-driven card. The card displays provider identity, operation title,
risk, a redacted structured preview, and only the approval actions allowed by
the host policy. It must not render raw argument JSON by default.

```text
┌────────────────────────────────────────────────────────────┐
│ Obsidian Git                                      REMOTE WRITE│
│ Push branch `main` to `origin`                               │
│                                                            │
│ Repository: Research Vault                                 │
│ Branch: main · commits to send: 2 · changed files: 5       │
│ Credentials are managed by Obsidian Git                     │
│                                                            │
│                 [ Push to origin ]  [ Reject ]              │
└────────────────────────────────────────────────────────────┘
```

Read-only operations use the same component with a compact preview. Write
operations show a typed plan, such as explicit staged paths and a proposed
commit message. Remote writes always use prominent confirmation in the first
release. Destructive and configuration capabilities remain unavailable.

### Chat: Inline Progress and Result

Extend `ToolCallNotification` into a generic expandable provider-result card.
It appears inline at the tool-call boundary, updates from pending to progress
to final state, and renders a provider-supplied safe summary with a generic
fallback. Result details must be compact and redacted.

```text
✓ Obsidian Git · Push to origin                         12.4 s
  main → origin/main · 2 commits · 5 files
  [ Show details ▸ ]

  Details
  ├─ Authentication: managed by provider
  ├─ Progress: objects uploaded and remote updated
  └─ No raw token, full diff, or provider configuration shown
```

If a provider becomes unavailable while a call is pending, resolve it as a
clear host result, for example: `Obsidian Git was disabled before this action
ran. Re-enable it in Settings → Agent Tools → Integrations.` New model calls
must not include unavailable capabilities.

### Persistent Safety Indicator

The chat header or action bar should show a compact current tool-policy label,
such as `Tools: ask`, `Tools: read-only`, or `Tools: off`. This makes the
approval state visible without duplicating settings controls in every card.
It is part of T38's graduated-policy implementation; the first read-only
provider increment may retain the current manual approval behavior until T38
lands.

### UI File Boundaries

| File | Planned responsibility |
| --- | --- |
| `src/settings-sections/integrations.ts` | Provider list, enablement, compatibility, and deep link to provider settings |
| `src/settings-sections/SettingsTab.ts` | Render the Integrations section and navigation item |
| `src/settings.ts` | Persist enabled provider IDs and future tool-policy setting |
| `src/components/PendingToolCard.tsx` | Descriptor-driven approval and typed preview card |
| `src/components/ToolCallNotification.tsx` | Inline provider progress, success, error, and expandable safe result details |
| `src/components/ActionBar.tsx` | Compact active tool-policy indicator |
| `src/hooks/useMessageActions.ts` | Preserve tab-scoped approval/resolution while routing provider calls through the host |
| `styles.css` | Responsive provider status, risk, preview, and progress styles |

No separate Git sidebar is added to Obsidian AI. Obsidian Git retains its own
configuration and manual Git interface; the provider UI is only the AI consent
and observability layer.

## Implemented Host Slice (2026-08-05)

The first executable T39a increment is read-only and provider-generic.
`src/integrations/types.ts` defines the public v1 contract and
`ProviderRegistry` discovers `plugin.api.integrationProvider`, validates its
version/capabilities, persists opt-in enablement, and merges enabled read-only
tools into normal AI SDK chat. `ToolExecutor` dispatches approved calls back to
the provider and adds safe provider metadata for generic cards.

Integrations settings lists discovered providers without revealing credentials
or provider configuration. Discovery runs at plugin load and layout readiness.
Tests cover disabled-by-default discovery, opt-in execution, incompatible
versions, and mutation exclusion. This increment does not implement a Git
provider, mutations, shell access, remote operations, or OpenResponses schema
conversion.

### Audit follow-up — 2026-08-25

T60a–c extend the host boundary without changing provider ownership:

- The resolved built-in/provider registry must be serialized for both normal
  AI SDK chat and OpenResponses remote agents.
- Provider inputs are validated locally through the host schema before execute.
- Built-in/provider capability IDs are collision-checked at registry resolution.
- Provider load, unload, enablement, and availability changes rebuild every
  transport projection.
- Focused tests cover registry-to-OpenResponses conversion, malformed input,
  provider loss, cancellation, and unavailable-capability behavior.

## Tool Safety, Privacy, and Audit

The host is the final policy authority. Provider risk labels guide the UI but
cannot make a remote write auto-approved. T38 supplies the shared approval,
plan, and audit mechanism for provider mutations.

| Risk | Initial behavior |
| --- | --- |
| `read` | Eligible for the configured read-only policy |
| `write` | Show a typed preview and require applicable approval |
| `remote-write` | Always prominent confirmation in the first release |
| `destructive` | Out of scope until a separate destructive contract exists |

Audit events record provider ID, capability ID, host policy decision, duration,
redacted targets, and applied/skipped/failed counts. They do not record raw
note content, full diffs, prompts, API keys, access tokens, or provider
configuration by default.

## Obsidian Git Provider Boundary

Obsidian Git is the reference provider because it has a real Git operation core
and mobile-safe isomorphic-git transport. The AI must call its bounded public
API rather than shelling out or importing private source from a sibling
checkout.

| Capability | Risk | First-release rule |
| --- | --- | --- |
| `git.status`, `git.changed_files`, `git.log` | read | Compact structured results |
| `git.stage_files`, `git.commit` | write | Explicit file/message preview |
| `git.pull`, `git.push` | remote-write | Separate explicit confirmation and progress |
| force push, remote edits, credentials, clone/init, sync-all | destructive or configuration | Not exposed |

The existing combined Git sync action must be decomposed at the AI boundary.
The model can inspect, propose named files, propose a commit message, and then
request each approved step. The Git plugin retains its conventional manual
sidebar and configuration experience.

## Delivery Plan

1. **T39a — Host contract and UI:** Define types, registry, discovery,
   availability, validation, provider settings, descriptor-driven tool cards,
   and inline result/progress rendering. Keep all tools read-only in the first
   executable increment.
2. **T38 dependency:** Deliver shared approval policy and privacy-aware audit
   infrastructure before provider writes.
3. **T39b — Git provider:** Publish the compatible Git API; add read tools,
   then explicit-stage/commit plans, then individually confirmed pull/push.
4. **Additional providers:** Migrate T26's planned Tasks, Dataview, and
   Templater bridges onto the proven provider contract rather than adding
   direct private-plugin calls. The existing built-in DQL query tool is a
   separate capability and does not satisfy the Dataview provider migration.
5. **Consolidation decision:** Reassess a one-codebase Git/AI distribution only
   after real usage measures the cost of two installs and coordinated releases.

## Validation Strategy

- Unit test contract validation, version mismatch, duplicate tools, provider
  availability changes, and cancellation.
- Test host-side policy enforcement independently of provider-declared risk.
- Use a fake provider for deterministic approval/audit/result tests.
- Run Git-provider integration tests against real temporary repositories;
  keep mobile-safe transport checks in the Git plugin's own suite.
- Manually validate desktop and mobile provider availability, progress,
  rejection, cancellation, and credential-redaction behavior before release.

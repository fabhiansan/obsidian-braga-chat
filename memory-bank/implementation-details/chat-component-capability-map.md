# Chat Component Capability Map

**Purpose:** a language- and framework-independent specification of the Chat Lab AI chat experience. It describes observable behavior and the services a replacement needs, rather than prescribing an implementation.

**Current-state reference:** 2026-10-01. This map covers the capabilities present in the current chat experience. Optional or host-dependent behavior is labeled as such; planned ideas are not presented as shipped features.

**How to read it:** user-visible chat behavior is the portable layer. Repository operations are capability-based and may be absent or restricted. Named Obsidian APIs and syntax describe this product's adapter; other repository examples are illustrative, not claims of existing Chat Lab integrations.

## 1. Scope

The component is a persistent, stateful chat workspace. It combines a conversation transcript and composer with model selection, one or more AI participants, optional remote human participants, knowledge context, file attachments, callable tools, session history, and local persistence.

Included:

- Chat workspace, toolbar, transcript, composer, dialogs, and message actions.
- Single-agent and multi-agent conversations, plus optional real-time human collaboration.
- Provider/model selection, streamed responses, cancellation, usage display, context management, and tool execution.
- Chat session storage, history search, tabs, exports, and optional cross-device chat sync.
- Access to a data repository only where chat invokes it: resource context, references, attachments, repository actions, and chat tools. A repository can be a vault, record collection, document store, or another source; its available operations are declared by its adapter.

Excluded:

- The separate inline-editor tooltip and its prompt history or visual-diff workflow.
- General plugin settings navigation, release/update machinery, general diagnostics, and unrelated plugin-data sync.
- A particular programming language, UI framework, database, editor, or host API.

The chat can be rebuilt in any stack if the implementation supplies equivalent adapters for model access, durable conversation storage, data-repository access, rendering, clipboard/export, and (when enabled) collaboration. Repository features are capability-based: a source may support some operations and not others.

## 2. Terms and user-visible state

- **Conversation/session:** a durable transcript with a title, timestamps, messages, and chat-specific choices such as selected models, context, and collaboration participants.
- **Tab:** an open view of a session. Closing a tab is not the same as deleting its saved session.
- **Draft:** a not-yet-submitted conversation. Unsent text and attachments belong to that draft and must not leak into another chat.
- **Participant:** the local user, an AI profile, or a connected remote human.
- **Profile:** a named model connection containing provider/endpoint and credentials, plus its default model and optional agent connection details.
- **Tool:** a named, schema-described capability the model can request and the host can execute.
- **Resolved context:** the current content or bounded summary of material selected for a request; the selection itself is stored with the session where appropriate.
- **Repository:** an external or host-provided source of data the chat can search, reference, read, or change where permitted. Examples include a vault, a document collection, or a structured record system.
- **Resource:** an addressable item in a repository, such as a note, document, record, or other source-defined entity. Stable identity, fields, relationships, and available actions depend on that repository.
- **Repository adapter:** the service that exposes a repository's supported capabilities and maps generic chat interactions to that source's identifiers, data model, permissions, validation, and behavior.
- **Repository capability set:** the operations a source actually supports, with its limits and authorization requirements. Search, grouping, relationships, creation, updates, and deletion are optional capabilities, not assumptions imposed on every source.

Persisted conversation content and temporary view state are distinct. A reload restores the active saved conversation and, when enabled, its open tabs and per-tab scroll position. Unsent drafts can be restored. A never-submitted empty draft is not a history item.

## 3. Chat workspace map

### 3.1 Toolbar and workspace controls

The responsive toolbar provides:

- Start a new chat and open Chat History.
- Search saved conversations.
- Select the active provider/model, including a compact model control and a separate passive provider/model identity display.
- Select AI participants and, when the relay is connected, remote participants.
- Open chat synchronization controls.
- Toggle Zen mode, which reduces the view to the transcript and composer.
- Open overflow actions for session rename, automatic naming, tool auto-approval, debate mode when multiple AI participants are selected, relay controls/member list, and bulk session export.
- Show the active AI and connected/selected human participants with attribution/status cues.

Controls remain usable on narrow/mobile layouts, with touch-sized targets. Less-frequent actions may be placed in an overflow menu. The participant and model controls reflect the active session's saved choices rather than keeping a conflicting global selection.

### 3.2 Transcript

The transcript is an ordered, scrollable sequence of user, assistant, agent, remote-human, and local diagnostic messages. A message can carry:

- Stable identity, author/role, timestamp, rendered Markdown, and error/debug status.
- Agent or remote-user identity and visual attribution.
- Context and attachment references from the submitted user message.
- Inline tool-call/result records and ordered content segments.
- Model identity, response time, token estimates/provider usage, and optional per-step diagnostics.
- User-message timestamp and token count, with copy and edit/resend actions.
- Assistant-message timestamp, model identity, response duration, token count, and copy/retry actions. Provider-reported usage is shown when available; otherwise the displayed count is an estimate. The primary reference mockups show provider and model together, but the current message bubble renders the model name only.
- A visible animated generation indicator while an assistant response is in progress. Message actions must remain reachable by touch on mobile.

For the current implementation, a same-day message displays local time; older messages display date and time. The full timestamp is available in the message time's accessible title.

Markdown supports links, code, tables, and attachment renderings. Wide tables remain horizontally reachable. Resource references open through the active repository or presentation adapter; Obsidian wikilinks are one supported rendering/navigation form, not a required reference syntax. PDF attachments can offer save-to-host and open-in-browser actions when the host supports them. The transcript can show the streaming assistant draft, tool activity, pending approval, typing indicators, and jump/highlight a message opened from a past-session result. Users who scroll up are not forcibly pulled back to the bottom; a return-to-latest control is available when away from the newest content.

Reasoning/thinking content is hidden by default when identifiable as a separate thinking segment. A user control can reveal it; this display choice is separate from whether the selected model supports reasoning mode.

### 3.3 Composer

The composer supports multiline text, automatic height growth, draft restoration, send, and stop. Enter-to-send is configurable; when disabled, Enter inserts a newline and Shift+Enter or Cmd/Ctrl+Enter sends. While a response is active, Send becomes Stop. Stop cancels the active generation/tool sequence and clears any pending approval so no later continuation starts.

The composer also supports:

- Resource mentions/references, with searchable, disambiguated candidates and keyboard selection. Mentioning a resource (often with `@`) is a general interaction pattern; reference syntax and rendering depend on the host/adapter, with Obsidian-style `[[...]]` as one format.
- Optional action shortcuts for edit, create, and append requests. The verbs and target selection are general concepts; exact slash syntax and available actions depend on the adapter.
- Attachment selection and removal, with visible chips.
- A thinking/reasoning request toggle where the model supports it.
- Optional typing notifications to collaborators.
- Editing mode for resubmitting a prior user message, with a cancel path.

### 3.4 Context bar and picker

Context can be attached per session using the repository capabilities that are available:

- One or more selected resources, resolved at send time.
- A collection, category, tag, query, or other grouping, if the repository exposes it; the adapter returns a bounded set or summary rather than loading an unbounded source.
- The current/active resource, if the host exposes one, re-read for each send when selected.

The UI lists selected resources or scopes as removable chips and prevents duplicates. Changing sessions restores that session's context selection. Before a request, the adapter resolves selected items, expands supported embedded content, removes duplicate resources, bounds the result to the configured context budget, and tells the model when material was truncated. Selected context is provided alongside the user's text, not as a separate conversation.

### 3.5 Message actions and selection

User messages can be edited and resubmitted or copied. Assistant messages can be copied or retried. Depending on the message and repository capabilities, assistant actions can create or update a target resource. A host may additionally provide a review/diff flow, append semantics, an active-resource action, or insertion at an editor cursor. These are adapter actions, not universal repository requirements. Resource-directed shortcuts retain their selected target and expose a matching direct action.

Long-press (or the platform's equivalent) enters multi-message selection. Selected messages can be copied as Markdown; selection can be canceled and resets on session change.

### 3.6 Repository-independent UI mockups

The sketches below show required chat surfaces and controls, not fixed visual styling. Names such as “resource” and “collection” are generic. Adapters may rename, omit, or reshape repository controls to match the capabilities they expose; unavailable actions must not appear enabled.

#### Main workspace — wide layout

```text
┌────────────────────────────── Chat workspace ─────────────────────────────┐
│ [New chat] [History/Search] [Session A ×] [Session B ×] [+ tab] [Sync]    │
│ [Model/profile ▾]  [Provider · effective model]  [Participants ▾] [Zen]   │
│                                                    [More ▾] [status]       │
├───────────────────────────────────────────────────────────────────────────┤
│ Context: [Resource: … ×] [Collection/filter: … ×] [+ Add context]         │
├───────────────────────────────────────────────────────────────────────────┤
│ Transcript                                                                 │
│  User · date/time · estimated tokens                                     │
│  Message text with resource references and attachment chips               │
│  [Copy icon] [Edit/resubmit icon]                                          │
│                                                                            │
│  Assistant · provider/model · date/time · response duration · tokens       │
│  Rendered response, links, code, tables, files [Open/Save if supported]    │
│  Reasoning segment [Show/Hide when present and supported]                  │
│  [Copy icon] [Retry icon] [Apply/create/update when supported]             │
│  Streaming response: animated indicator · “Generating”                     │
│                                                                            │
│  Tool activity / approval / result card (only while applicable)            │
│                                                    [Return to latest ↓]    │
├───────────────────────────────────────────────────────────────────────────┤
│ Draft attachments: [file … ×] [resource … ×]                               │
│ [Mention / action completion menu appears beside the caret when invoked]   │
│ ┌───────────────────────────────────────────────────────────────┐ [Send] │
│ │ Message composer; multiline; Enter behavior follows settings   │ [Stop] │
│ └───────────────────────────────────────────────────────────────┘        │
│ [Attach] [Context] [Reasoning, when supported] [typing/status, if enabled] │
└───────────────────────────────────────────────────────────────────────────┘
```

#### Main workspace — narrow layout

```text
┌──────────────────────── Chat ───────────────────────┐
│ [Session ▾] [New]          [Model] [People] [More] │
│ [History/Search] [Sync if enabled] [Zen] [status]   │
├──────────────────────────────────────────────────────┤
│ Context chips: [Resource … ×] [Scope … ×] [Add +]   │
├──────────────────────────────────────────────────────┤
│ Transcript                                            │
│ User · date/time · tokens · Copy · Edit/resend        │
│ User message…                                         │
│ Agent · provider/model · date/time · duration · tokens │
│ Response · Copy · Retry · tool state / result…         │
│ Animated “Generating” indicator while streaming        │
│                                   [Latest ↓]          │
├──────────────────────────────────────────────────────┤
│ Attachments: [file … ×]                               │
│ ┌──────────────────────────────────────────────┐      │
│ │ Composer                                     │ [Send]│
│ └──────────────────────────────────────────────┘ [Stop]│
│ [Attach] [Context] [Reasoning if supported]            │
└──────────────────────────────────────────────────────┘
```

#### Repository and chat pickers

```text
Resource/context picker                 Model and participant picker
┌──────────────────────────────┐        ┌─────────────────────────────┐
│ Add context                  │        │ Model/profile               │
│ [Search resources…        ]  │        │ [Search models…           ] │
│ [Source ▾] [Scope/filter ▾]  │        │ [Provider ▾] [Recent]       │
│ [ ] Resource title · type    │        │ [ ] Profile / model         │
│ [ ] Resource title · type    │        │ [ ] Profile / model         │
│ [ ] Collection/tag, if any   │        │ Participants                │
│ [Current resource, if any]   │        │ [ ] AI participant           │
│ [Cancel]             [Add]   │        │ [ ] AI participant           │
└──────────────────────────────┘        │ [Remote people if enabled]  │
                                        │ [Cancel]          [Apply]   │
                                        └─────────────────────────────┘
```

The picker shows only source capabilities that exist. Resource identity and hierarchy labels are source-defined; a vault path, medical record number, or document title are examples rather than required fields.

#### History, search, and overflow

```text
Chat history                              More actions
┌──────────────────────────────┐         ┌──────────────────────────┐
│ [Search saved chats…       ] │         │ Rename session           │
│ [Recent ▾]                   │         │ Generate title           │
│ Title · preview · updated    │         │ Tool approval setting    │
│ Title · preview · updated    │         │ Debate mode if applicable│
│ Search result → message      │         │ Relay/members if enabled │
│ [Open] [Rename] [Delete]     │         │ Export selected chats    │
│ [Copy] [Export]              │         │                            │
│ [Markdown ▾] [Export]        │         │ [Dismiss]                │
└──────────────────────────────┘         └──────────────────────────┘
```

```text
Confirm deletion of saved chat?
┌─────────────────────────────────────┐
│ This deletes the saved conversation.│
│ [Cancel]                   [Delete] │
└─────────────────────────────────────┘
```

#### Message, tool, and selection states

```text
Pending repository/tool action
┌──────────────────────────────────────────────────────┐
│ Assistant wants to [read / create / update / …]      │
│ Target: resource identity and source-defined details │
│ Preview/diff and permissions or warnings, if any     │
│ [Reject]                             [Approve]       │
└──────────────────────────────────────────────────────┘

After decision: [Waiting] → [Running / cancellable] → [Result or error]

Message selection: [Cancel selection] [N selected] [Copy as Markdown]
Export: [Messages / session(s)] [Format] [Cancel] [Export]
```

#### Optional collaboration and chat-service panels

```text
Chat history sync (when configured)       Live participants (when configured)
┌──────────────────────────────┐         ┌──────────────────────────────┐
│ Status: connected / offline  │         │ Room: connected / reconnect │
│ Last sync · pending changes  │         │ Local identity              │
│ [Sync now] [Auto-sync ▾]     │         │ Remote members · presence   │
│ Progress / conflict / error │         │ [Select recipients]         │
│ [Review] [Retry] [Close]    │         │ [Humans only / mixed chat]  │
└──────────────────────────────┘         │ [Close]                     │
                                          └──────────────────────────────┘
```

These panels are optional and service dependent. Host-provided file pickers, download prompts, and secure credential screens remain host surfaces rather than required chat-owned dialogs.

The generic operation names in these sketches are illustrative. The adapter determines which operations exist and what confirmation, preview, or follow-up the source requires.

#### Primary UI reference mockups

The following three user-supplied mockups are the primary visual references for the Chat UI. The multi-tab and single-chat references show mobile layouts; the optional-features reference shows sync, collaboration, and message-selection/export panels. Their labels and arrows identify the intended component regions. Treat words inside the images as UI labels, not as changes to the written behavior contract.

**Multi-tab mobile chat:**

![Primary reference: mobile multi-tab chat with labels for the tab strip, active and other open chats, close and new-tab controls, message details, generation, and shared composer](assets/chat-mobile-multi-tab.png)

**Single-chat mobile screen:**

![Primary reference: mobile single-chat layout labeled with the header, model/profile, context chips, transcript, tool activity, composer, and controls](assets/chat-mobile-single-chat-primary-reference.png)

**Optional chat features:**

![Primary reference: optional chat history sync, live collaboration, and message selection and export panels](assets/chat-optional-features-primary-reference.png)

#### Supplemental message-detail mockups

These generated mobile mockups expand the primary references with more explicit per-message metadata and action states. They are detail illustrations; current implementation limits are recorded in §14.

![Supplemental mobile message anatomy with user and agent timestamps, token counts, provider/model, response duration, copy/edit/retry actions, and generation status](assets/chat-mobile-message-anatomy.png)

![Supplemental mobile single-chat screen showing the message metadata and action details alongside the full chat structure](assets/chat-mobile-single-chat.png)

## 4. Session and history behavior

### 4.1 Create, open, close, and delete

- Starting a new chat creates and activates a separate draft/session without discarding prior conversations.
- The first sent message makes a draft a history conversation.
- Multiple sessions can be open in an in-chat tab strip while sharing one toolbar and composer.
- Opening a saved-history item opens or activates its tab. Opening the same session again must not create duplicate tabs.
- Closing a tab only closes that view. Closing an unsent draft discards that draft. Deleting a saved conversation is a separate, explicit action with confirmation.
- If the active tab closes, select a neighboring remaining tab. If the last tab closes, return to a clean new-chat state.
- Session switching restores the session's transcript, draft, attachments, model/profile selection, model overrides, context, participants, collaboration choices, and relevant view state.

### 4.2 Chat History

History is sorted by most recently updated. Each item can show title, message count, updated time, preview, and available usage information. It supports loading, renaming, deleting with confirmation, per-session copy, and per-session export. Supported copy/export formats are Markdown, JSON, and JSONL. Bulk session export is also available. Empty unsent drafts are excluded, and sessions older than the configured retention limit can be pruned.

Session titles can be generated from conversation content and can be renamed manually. Automatic naming is optional; when model-based naming is unavailable or fails, a local title fallback is used.

### 4.3 Search and deep links

Search covers saved conversation messages and returns the matching session, message, and a bounded excerpt. A result can open the matching saved conversation and navigate to/highlight the relevant message. The current conversation is excluded from a “past sessions” tool search. Search results must distinguish chat history from connected-repository search.

## 5. Message and turn lifecycle

For a user send, the component performs these observable steps:

1. Confirm the active session is fully loaded before appending anything; wait for hydration if its transcript is stored but not yet in memory.
2. Capture the user's text, selected context, attachment references/payloads, selected provider/model, and session identity.
3. Resolve context and attachments using host services. Preserve the captured resolved content needed to replay the request later, even if the source file subsequently changes.
4. Append and persist the user message, then start a cancelable model turn and show streaming/working state.
5. Build a request from the system instructions, active participant identity, available tool definitions, bounded conversation history/summary, current message, context, and multimodal parts.
6. Stream text and tool events into the transcript. If the model requests tools, validate and execute them under the tool safety flow below, then feed matching results back to the model and continue within a configured step limit.
7. Append the final assistant response with its message metadata, preserve ordered tool calls/results, update the session title/timestamps/usage, and persist.
8. On cancellation or error, stop further steps, settle/clear pending approval, preserve completed transcript evidence, and show a user-readable error or canceled state.

Retry and edit/resubmit act on a selected prior user message and rebuild the ensuing response from the applicable prior history. They must not accidentally apply one tab's composer draft to another session.

## 6. AI profiles, models, and multi-agent chat

### 6.1 Provider profiles

Users can configure multiple named profiles. Current model connections include OpenAI, Anthropic, Google Gemini, DeepSeek, Kimi, OpenRouter, Azure OpenAI, Ollama-compatible local endpoints, other OpenAI-compatible custom endpoints, and a remote OpenResponses agent endpoint. A profile supplies the connection details, credential requirements, default model, and optional model/agent-specific settings. The UI supports model discovery where the provider offers it, known-model fallbacks where it does not, and a recent-model list shared across profiles for the same provider.

An active session can use one selected profile or several AI profiles. The effective model is session-specific: its saved model override takes precedence; older sessions can recover model identity from prior assistant messages; otherwise use the chosen profile's default. Switching the toolbar selection changes the active session's next request and does not rewrite old assistant messages.

Requests stream where the transport supports streaming. Provider usage is retained when reported; local token estimates are available when it is not. Reasoning controls are passed only for compatible provider/model pairs. No provider capability should be assumed universal: images, PDFs, tools, cancellation, usage details, and reasoning vary by endpoint.

### 6.2 Multiple AI participants

When several profiles are selected, a user turn can be routed to the selected agents. Each response is attributed to its agent and rendered in the shared transcript. Agent addressing can direct a request to a named agent. Debate mode, when available and at least two agents are selected, gives later agents the earlier responses and invites additional analysis; agents may pass when they have nothing to add.

Per-session participant/profile selection is saved and restored. Typing/progress indicators identify active agents. Each participant's model/endpoint errors are represented without misattributing another participant's response.

### 6.3 Remote human participants (optional relay)

An optional user-configured WebSocket relay connects chat clients/devices to a room. The UI distinguishes connection state, room members, local identity, remote identities, selected recipients, and typing indicators. A user can chat with humans only or mix humans and AI participants. Messages carry author attribution and are relayed to participating clients. Relay is a real-time message transport; it does not itself store chat history or synchronize the connected repository's contents. Persisted chat history synchronization is a separate feature.

## 7. Context, memory, and attachments sent to models

### 7.1 Request context

The model request can include the configured chat persona/instructions, relevant user memory, current session context, recent conversation history, and the new message. Context assembly must be bounded by a token budget that reserves room for tool schemas, current input, response, and tool continuations. Older conversation material may be represented by a structured summary while the original transcript remains intact. Tool call/result pairs must remain coherent in model history.

When a tool result is too large for model replay, send a bounded projection with an explicit continuation/retrieval path. Keep the complete result associated with its original call so an agent can retrieve the exact result when supported. Show context/usage diagnostics only when the corresponding debug/export option is enabled.

The chat's AI memory is distinct from transcript history: it can provide relevant identity/preferences to prompts and can be searched/managed through chat tools. It is an optional prompt source, not a substitute for session history.

### 7.2 Attachments

The composer can attach repository resources, images, PDFs, and supported external files. Users can also add files through the platform's file picker or supported drag/drop path. Each attachment is visible, removable, scoped to the current draft, and rendered in the submitted user message. The adapter resolves resource and attachment content into model-compatible text/image/file parts. Resolved content is retained with message history where needed for faithful replay. Large images/documents may be resized, extracted, paged, bounded, or omitted according to provider support and size limits; communicate unsupported formats rather than silently treating them as plain text. Vault notes are one possible resource attachment.

Group requests resolve attachment content before dispatch. Every participant sees the same captured user attachment content for that turn, subject to what their provider supports.

## 8. Chat-callable tools

### 8.1 Repository capability model

The chat-facing repository model is independent of a repository's storage shape or domain. The adapter advertises the capabilities available for the current user, source, and target; it does not promise full CRUD for every source.

| General capability | Chat behavior | Example of source-specific implementation |
|---|---|---|
| Find and browse | Search, filter, list, count, or page through available resources. | Search notes and list folders in an Obsidian vault; search records by domain fields in a record system. |
| Reference and resolve | Let users and agents identify resources and resolve a stable reference to the intended item. | A vault path or wikilink; a record identifier or document URL. |
| Query | Apply supported filters, field criteria, or structured queries within the repository's own query rules. | Note search filters or optional read-only Dataview DQL; source-defined record queries. |
| Read and inspect | Retrieve content, selected fields, metadata, or supported relationships. | Read note text and frontmatter; read permitted record fields and linked resources. |
| Create | Create a resource when the source and current user's permissions allow it. | Create a note; create a permitted record or document. |
| Update | Change all or selected content/fields, with source validation and any required preview or confirmation. | Edit a note or section; update allowed record fields with audit requirements. |
| Delete or archive | Remove or deactivate a resource only when the source exposes that action and permits it. | Recoverable vault deletion; source-specific soft delete or no delete capability. |
| Organize and relate | Use collections, folders, tags, categories, links, or relationships when available. | Vault folders/tags/links; source-defined categories and record relationships. |
| Attach and resolve content | Include a resource or file as bounded model context when supported. | Resolve an attached note; retrieve an allowed document or record excerpt. |

These are capability families, not mandatory operations or universal tool names. A repository can omit any family, constrain it by resource type, or impose additional authorization, validation, versioning, audit, retention, and transaction rules. The adapter reports supported actions and constraints; the chat hides or disables unavailable actions and preserves the source's safeguards.

Resource mentions, references, current-resource context, grouping, and tagging are repository-independent interaction concepts. Repository capabilities and domain schemas determine which resources and groupings exist; the adapter controls labels, stable identities, completion syntax, and navigation. Obsidian's `[[wikilink]]` syntax and Vault API are specific implementation examples. They do not make resource reference, active-resource context, grouping, or tags Obsidian-specific concepts.

The current built-in Chat Lab repository adapter documented here is the Obsidian vault. This crosswalk relates the generic capability families to current product examples; it does not claim that Chat Lab currently connects to the other illustrative domains above.

| General capability | Current Obsidian AI example |
|---|---|
| Find and browse | `search_notes`, `search_note_content`, `list_notes`, `count_notes`, `list_folders` |
| Reference and resolve | Resource mention/link completion and path/title resolution used by note actions; `read_note` and `check_paths` where applicable |
| Query | Optional, read-only `query_dataview` |
| Read and inspect | `read_note`, `get_note_metadata` |
| Create | `create_note`, `create_notes`, `create_folder` |
| Update | `edit_note`, `append_to_note`, `patch_note`, `edit_section` |
| Delete or archive | `delete_note` using host-supported recoverable deletion |
| Organize and relate | `move_note`; folder/tag and note-link context where exposed by chat |
| Attach and resolve content | Composer resource/file attachments; `read_pdf` for supported PDF reading |

### 8.2 Current Obsidian AI built-in tool catalog

The current Obsidian AI built-in chat registry contains 33 capabilities. These names document this product's current implementation, not a required cross-repository API. Availability can depend on host features or user settings; external integration providers can contribute additional capabilities. A replacement can expose equivalent repository actions using names that fit its own adapter.

| Area | Capability | Behavior |
|---|---|---|
| Notes | `read_note` | Read a note's content by name or path. |
| Notes | `edit_note` | Replace a note's content. |
| Notes | `append_to_note` | Append content to a note. |
| Notes | `create_note` | Create a note at a path. |
| Notes | `create_notes` | Create several notes in one operation, reporting created and skipped items. |
| Notes | `patch_note` | Apply a targeted find/replace patch. |
| Notes | `edit_section` | Replace content under a specified heading. |
| Discovery | `search_notes` | Find notes by name/path and filters, with bounded/paged results. |
| Discovery | `search_note_content` | Search text inside notes and return bounded excerpts. |
| Discovery | `list_notes` | Browse notes in a folder with sort/filter/pagination controls. |
| Discovery | `count_notes` | Count notes within an optional scope. |
| Discovery | `get_note_metadata` | Read note metadata such as dates, size, and word count. |
| Discovery | `list_folders` | List folders under a selected parent. |
| Discovery | `check_paths` | Check candidate paths before creating or changing files. |
| Folders and files | `create_folder` | Create a folder. |
| Folders and files | `move_note` | Move or rename a note. |
| Folders and files | `delete_note` | Delete a note through the host's recoverable deletion mechanism when available. |
| Structured query | `query_dataview` | Run a bounded, read-only Dataview query when that capability is installed and available; it does not run arbitrary scripting. |
| Web/PDF | `search_web` | Search the configured web-search provider and return bounded results. |
| Web/PDF | `read_pdf` | Read selected PDF pages or text when supported. |
| Memory | `create_memory` | Add a durable AI-memory entry. |
| Memory | `update_memory` | Update an existing memory entry. |
| Memory | `delete_memory` | Delete an existing memory entry. |
| Memory | `list_memories` | List available memory entries. |
| Memory | `search_memories` | Search memory entries. |
| Memory | `read_memory_audit` | Read the memory audit when the audit capability is enabled. |
| Memory | `evaluate_staged` | Evaluate staged memory changes. |
| Memory | `cull_core` | Curate/remove core memory entries under the memory policy. |
| Conversation | `search_past_sessions` | Search saved chat history, excluding the current session, and return navigable references. |
| Conversation | `read_tool_result` | Retrieve a previously stored full tool result by its session/call reference when available. |
| Chat settings | `read_settings` | Read the supported user-facing plugin settings. |
| Chat settings | `update_setting` | Change an allow-listed setting when Developer mode permits it. |
| Chat settings | `get_plugin_info` | Report plugin identity and currently available built-in capabilities. |

External providers may add tools with a stable name, human-readable title/description, input schema, availability, risk classification, and execution behavior. Unavailable or misconfigured tools are omitted from the model's advertised tool list.

### 8.3 Tool call safety and display

The tool-calling envelope is a general chat capability: advertise only available tools, validate inputs, enforce host/repository policy, request approvals where required, support cancellation, and associate each result with its call. Repository-specific adapters supply the actual operations and source-specific constraints.

Every model tool request is treated as untrusted input. Before execution, the host:

1. Resolves the requested tool from the current available registry.
2. Rejects unknown tools and locally validates/normalizes arguments against the tool's schema.
3. Applies host-owned risk and authorization policy; provider-supplied labels cannot grant permission.
4. Checks targets, collisions, bounds, and other preconditions.
5. Requests user approval unless the applicable auto-approval setting is on. The pending card identifies the action and presents a concise, tool-specific preview; the user can approve or reject.
6. Executes with cancellation and target-aware coordination; conflicting writes to the same target are serialized.
7. Returns a bounded, readable result to the model and preserves the full result and call/result identity in the transcript/session when supported.

Read, create, write, remote, and destructive actions should remain distinguishable. Stop/cancel aborts in-flight work and prevents additional calls or continuation turns. Rejection is returned as a tool result so the model can explain or choose another path. Tool results are rendered inline or summarized in the assistant response; errors and pagination/continuation hints remain visible.

The current default is approval required; enabling auto-approval allows tool calls to execute without an approval card. The setting can be overridden for a remote agent profile. Risk categories inform the registry and preview, but do not independently override this approval setting. A model or external provider cannot approve its own action.

## 9. Chat-relevant configuration and defaults

These are current Obsidian AI defaults, not required values or universal conventions for another implementation. They provide compatibility context for this product's behavior; a replacement can make corresponding chat controls configurable.

| Behavior | Current default |
|---|---|
| Include active/current resource automatically, when the host supplies one | Off |
| Selected AI profiles | Active profile when no explicit selection exists |
| Built-in agent tools | Enabled |
| Tool-call auto-approval | Off; ask before executing |
| Maximum agent steps in one turn | 5 |
| Press Enter to send | On |
| Restore saved tabs after reload | On |
| Automatic session naming | Off |
| Maximum saved sessions | 20 |
| Context budget for selected resources/scopes | About 8,000 tokens |
| Previous messages considered | 10 |
| Total model request budget | About 32,000 tokens |
| Recent messages retained verbatim | 4 |
| Response and tool-continuation reserve | About 4,096 tokens |
| Tool-result replay limit | About 4,000 tokens |
| Automatic compaction trigger / release | About 24,000 / 16,000 tokens |
| Tool-result history replay | Elide large payloads by default; preserve mode is available |
| Display token count | Full request estimate shown by default |
| Debug mode and telemetry export | Off by default; individual telemetry fields are selectable |

Relevant controls also include resource-picker disambiguation, chat tab-title width, per-chat profile/model choices, thinking mode, optional debug telemetry fields, AI-memory prompt budget, web-search/PDF provider settings, relay room/user settings, and optional session synchronization. Web-search backends include DuckDuckGo, Brave, Tavily, Exa, and SearXNG. Provider credentials and connection details belong to the model profile or host's secure configuration, never in transcript content.

## 10. Backend and host-service map

This is a behavioral dependency map, not a required process or module layout:

| Service | Responsibility exposed to chat |
|---|---|
| Model connection service | Validate a profile, build a request for its provider, stream response/tool events, cancel work, and return usage/model metadata when available. |
| Prompt/context builder | Combine instructions, relevant memory, selected context, transcript history, tool definitions, attachments, and request limits. |
| Turn coordinator | Own one user turn across model steps, tool calls/results, streaming updates, cancellation, bounded continuation, and final accounting. |
| Tool catalog and executor | Resolve available tools, validate inputs, enforce policy, coordinate targets, execute host operations, and shape/persist results. |
| Data-repository adapter | Advertise source capabilities; resolve resource references; search, list, read, create, update, delete/archive, inspect, and relate resources only where supported and permitted; resolve bounded context and attachments. |
| Repository policy and provenance | Apply source permissions, validation, confirmation, version/audit requirements, and resource identity rules; report constraints and operation outcomes to the chat. This may be supplied by the adapter itself. |
| Session store | Load/save conversation metadata and messages, drafts, attachments, tabs, summaries, and explicit deletions. It must protect unloaded data from partial overwrites. |
| Search/export service | Index searchable conversation content; serialize single messages, selected messages, or sessions to supported formats. |
| Collaboration transport (optional) | Connect to a configured room, communicate presence/typing/messages, and surface remote member and connection changes. |
| Cross-device chat sync (optional) | Transfer saved chat data between devices independently of the real-time relay; report plans, progress, conflicts/errors, and deletions. |
| Presentation host | Render Markdown/resource references/files, provide file selection, resource navigation and host-specific actions, clipboard/downloads, accessibility, and responsive layout. |

Real-time relay and saved-history synchronization are separate adapters with separate status and failure handling. The relay carries live collaboration messages; chat sync carries persisted sessions. Neither should imply that unrelated host files or settings are being synchronized.

## 11. Persistence and cross-device behavior

The durable session store supports session metadata and ordered messages, active/open tab IDs, selected profiles and per-profile model overrides, context choices, group/remote participants, thinking choice, drafts, scroll position, compaction metadata, tool-call/result records, attachments and replayable resolved parts, and usage metadata. It also records deletions explicitly so a stale device snapshot cannot resurrect intentionally removed sessions.

Large transcripts may use an index plus per-session message files. A fast startup may load indexes first and hydrate transcripts when opened. The UI must show counts/metadata for not-yet-loaded sessions, must hydrate before editing/sending, and must never save an empty in-memory placeholder over an unloaded transcript. Draft attachment payloads may be stored separately from lightweight session indexes.

Cross-device sync must preserve chat data, surface progress and errors, and handle partial/offline data conservatively. The real-time relay is stateless and does not replace this store. Credentials and room identity must remain under the host's secure storage rules and should not be included in transcript exports or message payloads.

## 12. Errors, privacy, accessibility, and responsive behavior

- Show connection/configuration errors in user-readable terms and keep enough context to retry. A failed profile must not be presented as a successful response.
- Distinguish streaming, waiting, tool approval, tool execution, cancellation, and completion where the backend exposes them. Provider buffering may limit fine-grained progress; do not invent progress events that did not occur.
- Keep the transcript readable while streaming; do not lose scroll position or interrupt someone reading older messages.
- Make toolbar/composer/dialog actions reachable by keyboard and assistive technology; announce meaningful streaming/approval/status changes; provide clear focus and cancellation behavior.
- Support narrow/mobile layouts, touch interaction, long-press message selection, and safe file selection. Avoid relying on hover as the only way to reach message actions.
- Send conversation text, selected context, attachments, and tool data only to the configured model/search/relay endpoints needed for the requested feature. Explain that remote services receive the data required to perform the operation.
- Keep the user's local transcript complete even when model-facing context is compacted or bounded. Exports should preserve the selected data faithfully and should not accidentally include credentials.

## 13. Feature-complete replacement checklist

A replacement should not be considered feature-complete until it can demonstrate all applicable items below. Repository adapter checks apply only when a source exposes the corresponding capability:

- [ ] Create, switch, close, restore, rename, delete, and search multiple sessions without draft leakage or accidental deletion.
- [ ] Restore session-specific transcript, composer draft/attachments, context, profile/model choices, participants, and view state.
- [ ] Stream text, cancel a turn, retry or edit/resubmit a user message, and recover clearly from provider errors.
- [ ] Render attributed Markdown messages, resource references, attachments, tool progress/results, typing states, and message actions.
- [ ] Resolve per-chat resource, grouping/filter, and current-resource context where supported; bound it and make truncation visible.
- [ ] Discover and honor repository capabilities; support applicable search/browse/read/create/update/delete-or-archive operations with source-defined permissions, validation, and audit behavior.
- [ ] Send supported file attachments as provider-compatible parts and replay captured attachment content faithfully.
- [ ] Use one or more model profiles, preserve per-session model choices, and support model discovery where available.
- [ ] Run multiple AI participants, address agents, restore participant selection, and support debate mode where enabled.
- [ ] Connect/disconnect optional remote humans, show presence/typing/attribution, and keep real-time relay separate from history storage.
- [ ] Advertise only available tools; validate every call; apply host-owned approval/risk policy; support cancellation and preserve matching call/result history.
- [ ] Provide equivalent tool-calling behavior and advertise only the repository and chat capabilities available through the configured adapters; identify conditional capabilities clearly.
- [ ] Keep a complete local transcript while bounding model history, tool results, and context; preserve summary/retrieval provenance.
- [ ] Copy/export a message, selection, session, or session set in the supported formats; navigate from past-session search to the matching message.
- [ ] Survive restart, lazy loading, offline periods, partial sync, and session deletion without losing or overwriting unloaded transcript data.
- [ ] Work on desktop and mobile using equivalent keyboard, touch, and accessibility paths.

## 14. Current support qualifications

- The provider, attachment, tool, and host-feature surfaces are capability-dependent. A replacement should expose unavailable features honestly rather than displaying unusable controls.
- Obsidian Dataview querying is an optional, read-only adapter capability. Web search requires a supported search backend; remote collaboration requires a configured relay; saved-chat sync requires a configured sync backend.
- Provider-adaptive intermediate progress and partial tool-argument display are not part of the current guaranteed behavior.
- The current message bubble renders model name, response duration, usage/estimated tokens, timestamp, and copy/retry or copy/edit actions. The provider name is not currently rendered in the message bubble; the provider/model pairing in the mobile mockups records the requested target presentation.
- This document maps chat-visible functionality. It does not claim that every provider supports the same multimodal formats, reasoning controls, tool transport, usage reporting, or cancellation quality.

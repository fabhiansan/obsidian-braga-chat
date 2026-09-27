# Chat UI Features

General chat UI/UX features that apply to both 1:1 and group chat modes.

---

## Profile Selection

### Default Profile on New Chat

**Problem:** When starting a new chat with an empty `selectedProfileIds` set, the participant dropdown showed no selection and the chat had no active model.

**Root cause:** `handleNewChat()` created `new Set()` for `selectedProfileIds` when `plugin.settings.selectedProfileIds` was empty, instead of falling back to the active provider profile.

**Fix:** When `plugin.settings.selectedProfileIds` is empty, default to the active provider profile ID:
```typescript
const fallbackId = getActiveProviderProfile(plugin.settings).id;
setSelectedProfileIds(new Set([fallbackId]));
```

**File:** `src/components/ChatApp.tsx` (~line 1380)

---

## Thinking Toggle (💭)

**Feature:** Allow user to show/hide model reasoning (`<thinking>...</thinking>` tags) in assistant messages.

**State:**
- `showThinking: boolean` in `ChatApp.tsx` — defaults to `false` (thinking stripped)
- Passed down: `ChatApp` → `ChatMessages` → `MessageBubble`

**UI:**
- 💭 toggle button in `ChatInput.tsx`, placed before the send button
- `title` attribute: "Show thinking" / "Hide thinking"
- Visual feedback: button gets `is-active` class when `showThinking=true`

**Behavior:**
- `showThinking=false` (default): `stripThinkingTags()` removes `<thinking>...</thinking>` blocks from rendered text
- `showThinking=true`: thinking blocks rendered as normal text (or styled separately if desired)

**Files:**
- `src/components/ChatApp.tsx` — `showThinking` state, `handleToggleThinking` callback
- `src/components/ChatInput.tsx` — 💭 button with `onToggleThinking` prop
- `src/components/ChatMessages.tsx` — forwards `showThinking` to `MessageBubble`
- `src/components/MessageBubble.tsx` — `TextSegment` conditionally strips thinking tags

## Provider-Adaptive Progress — T60e/T15 (planned)

The current chat UI updates visible text incrementally but does not expose
partial tool-call arguments or a distinct waiting state when a provider buffers
reasoning/tool events. The planned follow-up adds generic Thinking, Preparing
tool, Waiting for provider, Executing tool, and Finishing states plus
provisional tool-call cards. Raw hidden reasoning remains undisplayed.

Transport and execution lifecycle belong to T60e; visual rendering belongs to
T15. Implementation must occur on the separate branch
`feat/t60e-provider-adaptive-streaming-ui`.

---

## Past-Session Links and Shared Tabs (2026-07-29)

Past-session result links open inside an internal tab strip in the existing chat panel. The toolbar and composer are shared across sessions; closing a tab does not delete its conversation. The active target message scrolls into view and is highlighted. Tabs use compact labels with horizontal scrolling; additional visual title polish is deferred.

When Enter is configured for a new line, Shift+Enter and Cmd/Ctrl+Enter still send the message. The detailed search, link, and tab design is documented in [Past-Session Search and Shared Tabs](past-session-search-and-tabs.md).

---

---

## File Attachments (📎)

**Feature:** Allow users to attach vault files (markdown notes, images, PDFs) to chat messages for LLM consumption.

**State:**
- `messageAttachments: Attachment[]` in `ChatApp.tsx`, backed by the active
  session's `draftAttachments` so switching tabs restores that chat's unsent
  files instead of carrying them to another chat
- Passed down: `ChatApp` → `ChatInput` via `attachments` and `onAttachmentsChange` props

**UI:**
- 📎 button in `ChatInput.tsx`, opens dropdown with "Attach Note", "Attach Image", "Attach PDF"
- Attachment chips shown above textarea with file type icon (📄/🖼️/📑) and name
- Remove button (×) on each chip
- Read-only chips rendered below user messages in `MessageBubble`

**Attachment Resolution:**
- `AttachmentEngine.resolveAttachments()` in `src/context/AttachmentEngine.ts`
- Markdown → `TextPart` with file header
- Image → `ImagePart` (base64, resized to 1024px max via canvas)
- PDF → `FilePart` for Gemini; text extract or skip for other providers

**API Integration:**
- `handleSend()` in `ChatApp.tsx` calls `resolveAttachments()` before API call
- Resolved parts combined with text: `[{type:"text", text}, ...resolvedParts]`
- `SdkMessage` type in `api.ts` supports `string | MessageContentPart[]` content

**Files:**
- `src/components/ChatApp.tsx` — `messageAttachments` state, resolution in `handleSend()`
- `src/components/ChatInput.tsx` — 📎 dropdown, attachment chips, `onAttachmentsChange`
- `src/components/MessageBubble.tsx` — read-only attachment chip rendering
- `src/context/AttachmentEngine.ts` — attachment resolution engine
- `src/api.ts` — `SdkMessage`, `MessageContentPart` multimodal types
- `src/types.ts` — `Attachment` interface

Unsent attachments are session-scoped while the chat view is open. Empty draft
sessions are still excluded from saved chat data until the first message is
sent.

### Group-chat full replay (T19a, 2026-08-14)

Group messages now use the same persisted `resolvedParts` representation as single-chat messages. The group send path resolves attachments before dispatch, stores the parts on the user `ChatMessage`, and passes them through the participant router and orchestrator. Historical group messages replay their multimodal parts rather than collapsing to text. Relay messages carry both `attachments` and `resolvedParts` so remote messages remain available to local agents.

The current group implementation resolves once using the active profile. Images and text are provider-neutral; PDF behavior follows the provider selected during resolution. A future per-agent resolution pass may be needed if a group mixes providers with materially different file-part support.

**Files:** `useMessageActions.ts`, `ParticipantRouter.ts`, `Orchestrator.ts`, `WebSocketSyncAdapter.ts`, `types.ts`.

---

*Last Updated: 2026-08-14 16:42:00 IST*

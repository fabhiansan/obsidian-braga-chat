# Obsidian Note-Link Interception (T28)

**Status:** Regression unresolved; live acceptance required
**Related tasks:** T28, T11

## Current behavior

Chat-rendered note links are intercepted and opened through Obsidian's
`workspace.openLinkText()` API. The handler resolves Obsidian-rendered
`data-href` targets as well as anchor `href` values, handles external links
separately, and catches asynchronous navigation failures. The click path emits
`[ChatLinks]` breadcrumbs so a debug log can distinguish interception,
resolution, navigation, and a failure.

The interception is wired for both normal message content and streamed reply
content. The awaited navigation and streamed-reply wiring were added in the
2026-09-28/29 follow-ups (`daa7f2e`, `0ead3de`, `9a9aae4`, `e367c01`).

## Known unresolved behavior

The user reports that clicking a vault-document link in a previously loaded
chat still crashes Obsidian. The supplied mobile log contains a minified
renderer rejection, `Cannot read properties of null (reading 'children')`, but
does not show `[ChatLinks]` entries around the click. This is insufficient to
confirm whether the plugin handler ran or to establish the cause. Keep T28
open until a click on the updated build is captured with the corresponding
debug log and the actual handler path is known.

## Diagnostic procedure

1. Enable plugin Debug Mode and reproduce a vault-link click in the loaded
   chat that exhibits the issue.
2. Check for `[ChatLinks]` entries immediately before the crash.
3. If absent, investigate whether the rendered anchor bypasses the plugin's
   delegated handler or whether the click occurred in a renderer outside the
   intercepted container.
4. If present, use the last breadcrumb to identify resolution, API navigation,
   or rejection as the failing step. Preserve the Obsidian error and timestamp.

Do not mark the crash fixed from a successful source build alone. A prior
loaded-chat click and log review is still needed.

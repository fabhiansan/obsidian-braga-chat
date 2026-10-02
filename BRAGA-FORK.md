# Braga fork of Chat Lab AI

Fork of [space-cadet/obsidian-ai](https://github.com/space-cadet/obsidian-ai)
for the CFMS RFID PT MIP vault (submodule `tools/obsidian-braga-chat`). License stays GPL-3.0.

## What the fork changes

| Change | Where |
|---|---|
| Plugin id `braga-chat`, desktop only, view type `braga-chat-view` | `manifest.json`, `src/views/ObsidianAIChatView.ts` |
| No automatic update checks; updater points at this fork | `src/main.ts`, `src/updater/PluginUpdater.ts` |
| Providers `claude-code`, `codex`, `opencode`: run the local CLI with its own login (subscription), in the vault folder | `src/api/cliAgents/`, provider switches in `src/settings.ts`, `src/api/providers.ts`, `src/components/ProfileCard.tsx` |
| Relay room: messages and AI answers are shared with the room; `@handle` picks whose agent answers | `src/sync/relayAgents.ts`, `src/components/ChatApp.tsx`, `src/agent/turnLifecycle.ts` (`SendOptions`), `src/sync/WebSocketSyncAdapter.ts` |

Fork edits in upstream files are marked `Braga fork` in comments.

## CLI agents

- The profile's **CLI path** field holds the executable (default `claude`, `codex`, `opencode`). The login shell `PATH` is used, so Homebrew and mise installs are found.
- Model `default` lets the CLI pick; otherwise it is passed as `--model` / `-m`.
- Permissions: Claude Code `--permission-mode acceptEdits` (edits yes, shell commands no), Codex `--sandbox workspace-write`, opencode `--auto`.
- Each request is a fresh CLI run with the whole transcript as the prompt.

## Relay rules

The handle is the profile name in lowercase with dashes (`Claude Fabhian` → `@claude-fabhian`); name profiles after their owner so handles are unique.

- A message mentioning my handle is answered by my profile, whoever sent it.
- My message mentioning only other handles is posted without a local answer.
- My message without mentions is answered by my active profile.

## Updating from upstream

```bash
git fetch upstream
git merge upstream/main
pnpm install && pnpm test && pnpm run install:vault
```

# Memory Bank - Sage Workspace

*Created: 2026-08-07 23:23:17 IST*
*Last Updated: 2026-09-30 03:45:08 IST*

## Overview

This is the Memory Bank for the Sage (灵剑) OpenClaw workspace.

## Active Tasks

| ID | Title | Status | Priority | Started | Dependencies | Details |
|----|-------|--------|----------|---------|--------------|---------|
| META-1 | Memory Bank Setup and Maintenance | 🔄 | HIGH | 2026-05-02 | — | [Details](tasks/META-1.md) |
| T11 | Debug Logging & Diagnostics | ✅ | MEDIUM | 2026-05-08 | T9 | [Details](tasks/T11.md) |
| T14 | Remote Agent Connectivity (OpenResponses and OpenClaw Gateway) | 🔄 | HIGH | 2026-05-07 | T1, T13, T5, T9 | [Details](tasks/T14.md) |
| T15 | Tabbed Chat Interface with Multi-Profile | 🔄 | HIGH | 2026-05-15 | T13, T14, T9 | [Details](tasks/T15.md) |
| T16 | Group Chat (Multi-Agent Conversation) | 🔄 | HIGH | 2026-05-16 | T15 | [Details](tasks/T16.md) |
| T16a | Bounded Group Context and Shared Tool Facts | 🔄 | HIGH | 2026-08-31 | T16, T46, T48b, T48c | [Details](tasks/T16a.md) |
| T16b | Addressable Agent Participants and Unified `@` Resolution | 🔄 | HIGH | 2026-08-31 | T16, T43 | [Details](tasks/T16b.md) |
| T17 | Advanced Vault Tools — Backlinks, YAML, Bulk Ops, Templating, Maintenance | ⏸️ | HIGH | 2026-05-15 | T13, T14, T60a, T60c | [Details](tasks/T17.md) |
| T17a | Optional Dataview DQL Query Tool | 🔄 | MEDIUM | 2026-09-27 | T17, T13, T14, T60a, T60c | [Details](tasks/T17a.md) |
| T38 | Tool Approval Policy Framework | ❌ | — | 2026-08-05 | — | [Details](tasks/T38.md) |
| T39 | Git Integration Provider (obsidian-git → obsidian-ai) | ✅ | HIGH | 2026-08-05 | 2026-09-18 | T39a, T39b | [Details](tasks/T39.md) |
| T39a | Provider API Host, Lifecycle, and Tool-Policy Boundary | ✅ | HIGH | 2026-08-05 | 2026-09-18 | T39, T13, T38 | [Details](tasks/T39a.md) |
| T39b | Git Write Tools from Chat | ✅ | HIGH | 2026-08-05 | 2026-09-18 | T39 | [Details](tasks/T39b.md) |
| T40 | Multi-User Chat with LaTeX Support | 🔄 | HIGH | 2026-08-08 | T16 | [Details](tasks/T40.md) |
| T42 | Remote Chat Storage & Sync | 🔄 | HIGH | 2026-08-10 | T40 | [Details](tasks/T42.md) |
| T42a | Sync Index — Skip Unchanged Sessions | 🔄 | HIGH | 2026-08-19 | T42 | [Details](tasks/T42a.md) |
| T42b | Atomic Writes for Session Uploads | 🔄 | HIGH | 2026-08-19 | T42 | [Details](tasks/T42b.md) |
| T42c | Concurrency Control for Parallel Sync | 🔄 | HIGH | 2026-08-19 | T42 | [Details](tasks/T42c.md) |
| T42d | Server Signature and Cache Invalidation | 🔄 | HIGH | 2026-08-19 | T42 | [Details](tasks/T42d.md) |
| T42e | Sync Dry Run | 🔄 | MEDIUM | 2026-08-19 | T42 | [Details](tasks/T42e.md) |
| T58 | Integrated Sync UI into Chat Lab | 🔄 | HIGH | 2026-08-23 | T42 | [Details](tasks/T58.md) |
| T58d | Unified Sync Progress, Dry-Run Planning, and Index Rebuild UX | 🔄 | HIGH | 2026-08-23 | T42a, T42c, T42e, T57a, T57b, T57c | [Details](tasks/T58d.md) |
| T57 | Plugin Data Sync Safety and SyncIt Boundary | 🔄 | HIGH | 2026-08-22 | — | T42, T39a | [Details](tasks/T57.md) |
| T57d | Data-Sync Provider Contract with SyncIt | 🔄 | MEDIUM | 2026-08-22 | — | T57, T39a | [Details](tasks/T57d.md) |
| T46 | Core Orchestration Decomposition | 🔄 | MEDIUM | 2026-08-17 | T22, T23, T60a, T48b, T48c | [Details](tasks/T46.md) |
| T48 | Conversation Compaction Mechanism | 🔄 | HIGH | 2026-08-23 | T6a | [Details](tasks/T48.md) |
| T48a | Token-Budgeted Context Builder | 🔄 | HIGH | 2026-08-23 | T6a, T48 | [Details](tasks/T48a.md) |
| T48b | Tool-Result Replay Limits and Canonical Serialization | 🔄 | HIGH | 2026-08-23 | T13a, T48a | [Details](tasks/T48b.md) |
| T48c | Rolling Conversation Summary and Compaction | 🔄 | HIGH | 2026-08-23 | T48a, T48b | [Details](tasks/T48c.md) |
| T48d | Context-Aware Usage Display and Provider Reconciliation | 🔄 | HIGH | 2026-08-23 | T6a, T48a | [Details](tasks/T48d.md) |
| T60 | Tool Capability Registry and Execution-Pipeline Hardening | 🔄 | HIGH | 2026-08-25 | T13, T13a | [Details](tasks/T60.md) |
| T60e | Provider-Adaptive Streaming and Tool-Call Progress UI | ⏸️ | HIGH | 2026-08-25 | T60b, T15, T25 | [Details](tasks/T60e.md) |
| T62a | T62 Elision Regression — Agent Workflow Breakage | 🔄 | HIGH | 2026-08-26 | T62 | [Details](tasks/T62a.md) |
| T63 | Context Item Caching | 🔄 | MEDIUM | 2026-08-26 | — | [Details](tasks/T63.md) |
| T64 | Context Optimization Benchmark Harness | 🔄 | HIGH | 2026-08-26 | T48a | [Details](tasks/T64.md) |
| T65 | Three-Tier Memory System with Auto-Curation | 🔄 | HIGH | 2026-08-29 | T26, T61 | [Details](tasks/T65.md) |
| T66 | Stylesheet Architecture and CSS Cleanup | 🔄 | MEDIUM | 2026-08-30 | T8a, T34, T41, T58d | [Details](tasks/T66.md) |
| T67 | Storage Lifecycle Decomposition | 🔄 | HIGH | 2026-08-30 | T46, T57, T58d, T65 | [Details](tasks/T67.md) |
| T69 | External Service Authentication and Provider Adapters | 🔄 | HIGH | 2026-08-31 | T9, T14, T15, T38, T60, T60e | [Details](tasks/T69.md) |
| T69a | Codex / ChatGPT Subscription Authentication | 🔄 | HIGH | 2026-08-31 | T69, T9, T14, T38, T60, T60e | [Details](tasks/T69a.md) |
| T69b | Claude Code Authentication | 🔄 | HIGH | 2026-08-31 | T69, T9, T14, T38, T60, T60e | [Details](tasks/T69b.md) |
| T64a | Pareto Frontier Sweep | 🔄 | HIGH | 2026-08-27 | T64, T64c | [Details](tasks/T64a.md) |
| T64c | Fidelity-Weighted Scoring | 🔄 | MEDIUM | 2026-08-27 | T64, T64b | [Details](tasks/T64c.md) |
| T64d | Live Estimator Validation | ✅ | MEDIUM | 2026-08-27 | 2026-08-29 | T64, T6a | [Details](tasks/T64d.md) |
| T70 | Active Chat Model Identity and Switcher Consistency | ✅ | HIGH | 2026-09-02 | 2026-09-02 | T9, T15; builds on T35, T36 | [Details](tasks/T70.md) |
| T71 | Chat View Scroll Performance and Streaming Follow | ✅ | HIGH | 2026-09-19 | 2026-09-19 | T24, T15 | [Details](tasks/T71.md) |
| T24a | Global Search Scope over Index-Only Sessions | ⏸️ | MEDIUM | 2026-09-19 | T24 | [Details](tasks/T24a.md) |
| T18a | Bounded Web Page Retrieval Tool | ⏸️ | MEDIUM | 2026-08-25 | T18, T60a, T60c | [Details](tasks/T18a.md) |
| T50 | OpenAI Responses API / Threads Support | 🔄 | MEDIUM | — | T14 | [Details](tasks/T50.md) |

## Completed Tasks

| ID | Title | Status | Priority | Started | Completed | Dependencies | Details |
|----|-------|--------|----------|---------|-----------|--------------|---------|
| T1 | Chat Panel — ItemView + React UI | ✅ | HIGH | 2026-05-02 | 2026-05-02 | T4, T9 | [Details](tasks/T1.md) |
| T10 | Model Discovery & Picker UX | ✅ | HIGH | 2026-05-02 | 2026-05-02 | T9 | [Details](tasks/T10.md) |
| T13 | Agentic Tool Calling for Note Editing | ✅ | HIGH | 2026-05-06 | 2026-05-06 | T1, T3, T5, T9 | [Details](tasks/T13.md) |
| T18 | Web Search Tool for Chat | ✅ | MEDIUM | 2026-05-16 | 2026-05-16 | T13, T9 | [Details](tasks/T18.md) |
| T19 | File Attachments for Chat Messages | ✅ | HIGH | 2026-05-25 | 2026-05-25 | T13, T4, T9 | [Details](tasks/T19.md) |
| T2 | Conversation Chain & Memory | ✅ | HIGH | 2026-05-02 | 2026-05-02 | T1 | [Details](tasks/T2.md) |
| T21 | CLI Test Harness for AI Features | ✅ | MEDIUM | 2026-05-25 | 2026-05-25 | T13, T19, T4 | [Details](tasks/T21.md) |
| T24 | SessionStorage — JSONL Chat Persistence | ✅ | HIGH | 2026-06-14 | 2026-06-14 | — | [Details](tasks/T24.md) |
| T28 | Fix Obsidian Note Link Click Crash | ✅ | HIGH | 2026-07-28 | 2026-09-30 | T4, T13 | [Details](tasks/T28.md) |
| T23 | Settings.ts Decomposition | ✅ | HIGH | 2026-05-28 | 2026-05-28 | — | [Details](tasks/T23.md) |
| T3 | Context & Mentions System | ✅ | HIGH | 2026-05-02 | 2026-05-02 | T1 | [Details](tasks/T3.md) |
| T34 | Settings Panel UI/UX Improvements | ✅ | MEDIUM | 2026-08-07 | 2026-08-07 | - | [Details](tasks/T34.md) |
| T4 | Streaming | ✅ | HIGH | 2026-05-02 | 2026-05-02 | T9 | [Details](tasks/T4.md) |
| T5 | In-Place Note Editing from Chat | ✅ | HIGH | 2026-05-02 | 2026-05-02 | T1 | [Details](tasks/T5.md) |
| T6 | Token & Context Management | ✅ | MEDIUM | 2026-05-02 | 2026-05-02 | T1, T2 | [Details](tasks/T6.md) |
| T7 | Release System & CI/CD | ✅ | HIGH | 2026-05-02 | 2026-05-02 | — | [Details](tasks/T7.md) |
| T9 | Settings & Provider Profiles | ✅ | HIGH | 2026-05-02 | 2026-05-02 | T1 | [Details](tasks/T9.md) |
| T41 | Plugin Auto-Updater with Stable/Dev Channels | ✅ | HIGH | 2026-08-09 | 2026-08-12 | T7 | [Details](tasks/T41.md) |
| T42g | Sync Visibility & Observability | ✅ | HIGH | 2026-09-19 | 2026-09-21 | T42, T58d | [Details](tasks/T42g.md) |
| T43 | Multi-User and Agent Chat with LaTeX Support | ✅ | HIGH | 2026-08-10 | 2026-08-12 | T40 | [Details](tasks/T43.md) |
| T19a | Group-Chat Attachment Full Replay | ✅ | HIGH | 2026-08-14 | 2026-08-14 | T19, T16, T43 | [Details](tasks/T19a.md) |
| T20 | Message Selection and Chat History Exports | ✅ | HIGH | 2026-08-14 | 2026-08-14 | T2, T5, T19 | [Details](tasks/T20.md) |
| T13a | Tool Call Context Persistence Bug Fix | ✅ | HIGH | 2026-08-16 | 2026-08-16 | T13 | [Details](tasks/T13a.md) |
| T45 | PDF Text Extraction Tool | ✅ | HIGH | 2026-08-16 | 2026-08-16 | T13, T19 | [Details](tasks/T45.md) |
| T6a | Token Counter Accuracy Fix | ✅ | HIGH | 2026-08-19 | 2026-08-19 | T6 | [Details](tasks/T6a.md) |
| T8 | Open Source Release with Branding | ✅ | HIGH | 2026-05-02 | 2026-09-24 | T7, T8a | [Details](tasks/T8.md) |
| T8a | Community Directory Review Remediation | ✅ | HIGH | 2026-08-15 | 2026-08-28 | T8, T7 | [Details](tasks/T8a.md) |
| T8b | 1.5.0 Community Scan Follow-up | ✅ | HIGH | 2026-09-09 | 2026-09-24 | T8, T8a | [Details](tasks/T8b.md) |
| T13b | Tool Call Result Display Consistency | ✅ | MEDIUM | 2026-08-28 | 2026-08-28 | T13 | [Details](tasks/T13b.md) |
| T44 | Standalone UI Preview and Obsidian Host Boundary | ✅ | MEDIUM | 2026-08-12 | 2026-08-14 | T1, T22 | [Details](tasks/T44.md) |
| T46a | Chat Turn Coordinator Decomposition | ✅ | HIGH | 2026-08-27 | 2026-08-28 | T46, T60a, T48b, T48c, T62a | [Details](tasks/T46a.md) |
| T49 | Settings Export and Import | ✅ | MEDIUM | 2026-08-19 | 2026-08-19 | T23 | [Details](tasks/T49.md) |
| T55 | Component-Level Sync Selection | ✅ | HIGH | 2026-08-21 | 2026-08-21 | T58, T42, T49 | [Details](tasks/T55.md) |
| T56 | Unify Plugin Data Management Layer | ✅ | HIGH | 2026-08-21 | 2026-08-21 | T58, T49, T55 | [Details](tasks/T56.md) |
| T57a | Common Plugin-File Sync Layer | ✅ | HIGH | 2026-08-22 | 2026-08-22 | T57, T42b | [Details](tasks/T57a.md) |
| T57b | Two-Way Conflicts, Recovery, and Deletions | ✅ | HIGH | 2026-08-22 | 2026-08-22 | T57, T57a | [Details](tasks/T57b.md) |
| T57c | Sync Identity, Retry, and Failure Reporting | ✅ | HIGH | 2026-08-22 | 2026-08-23 | T57, T42d | [Details](tasks/T57c.md) |
| T58a | Fix Rebuild Sync Index Title Resolution | ✅ | HIGH | 2026-08-21 | 2026-08-21 | T58 | [Details](tasks/T58a.md) |
| T58b | Add Activity Indicators to Sync UI | ✅ | HIGH | 2026-08-21 | 2026-08-21 | T58 | [Details](tasks/T58b.md) |
| T58c | Extend Sync to All Plugin Data | ✅ | HIGH | 2026-08-21 | 2026-08-21 | T58, T42 | [Details](tasks/T58c.md) |
| T60d | Token-Efficient Search Defaults | ✅ | MEDIUM | 2026-08-25 | 2026-08-26 | T60 | [Details](tasks/T60d.md) |
| T60f | Bounded Result Pagination and Continuations | ✅ | MEDIUM | 2026-08-26 | 2026-08-26 | T60a, T60b, T60c | [Details](tasks/T60f.md) |
| T62 | Tool Payload Elision in History Replay | ✅ | HIGH | 2026-08-26 | 2026-08-26 | T48b | [Details](tasks/T62.md) |
| T60b | Cross-Loop Tool Transport Parity | ✅ | HIGH | 2026-08-25 | 2026-08-25 | T60, T60a, T14, T48b | [Details](tasks/T60b.md) |
| T60a | Canonical Tool Registry and Dynamic Exposure | ✅ | HIGH | 2026-08-25 | 2026-08-29 | T60, T39a | [Details](tasks/T60a.md) |
| T60c | Validated Execution Boundary and Reliability | ✅ | HIGH | 2026-08-25 | 2026-08-29 | T60, T60a, T60b | [Details](tasks/T60c.md) |
| T61 | Self-Settings Agent Tools | ✅ | HIGH | 2026-08-26 | 2026-08-29 | — | [Details](tasks/T61.md) |
| T64b | Preserve Mode Content Retention | ✅ | HIGH | 2026-08-27 | 2026-08-29 | T64 | [Details](tasks/T64b.md) |

## Disabled / Removed Tasks

| ID | Title | Status | Priority | Details |
|----|-------|--------|----------|---------|
| T51 | Opt-in Telemetry and Usage Data Collection | ⛔ DISABLED | MEDIUM | [Details](tasks/T51.md) |

## Task Relationships

```
META-1: Memory Bank Setup and Maintenance
  └── —
T1: Chat Panel — ItemView + React UI
  └── T4
  └── T9
T10: Model Discovery & Picker UX
  └── T9
T11: Debug Logging & Diagnostics
  └── T9
T13: Agentic Tool Calling for Note Editing
  └── T1
  └── T3
  └── T5
  └── T9
T13a: Tool Call Context Persistence Bug Fix
  └── T13
T13b: Tool Call Result Display Consistency
  └── T13
T14: Remote Agent Connectivity (OpenResponses and OpenClaw Gateway)
  └── T1
  └── T13
  └── T5
  └── T9
T15: Tabbed Chat Interface with Multi-Profile
  └── T13
  └── T14
  └── T9
T16: Group Chat (Multi-Agent Conversation)
  └── T15
  └── T16a
  └── T16b
T17: Advanced Vault Tools — Backlinks, YAML, Bulk Ops, Templating, Maintenance
  └── T17a
T17a: Optional Dataview DQL Query Tool
  └── T17
T18: Web Search Tool for Chat
  └── T13
  └── T9
T18a: Bounded Web Page Retrieval Tool
  └── T18
  └── T60a
  └── T60c
T19: File Attachments for Chat Messages
  └── T13
  └── T4
  └── T9
  └── T19a
T19a: Group-Chat Attachment Full Replay
  └── T19
  └── T16
  └── T43
T2: Conversation Chain & Memory
  └── T1
T20: Message Selection and Chat History Exports
  └── T2
  └── T5
  └── T19
T45: PDF Text Extraction Tool
  └── T13
  └── T19
T46: Core Orchestration Decomposition
  └── T22
  └── T23
  └── T60a
  └── T48b
  └── T48c
  └── T46a
T46a: Chat Turn Coordinator Decomposition
  └── T46
  └── T60a
  └── T48b
  └── T48c
  └── T62a
T60: Tool Capability Registry and Execution-Pipeline Hardening
  └── T13
  └── T13a
  └── T60a
  └── T60b
  └── T60c
  └── T60d
  └── T60e
  └── T60f
T21: CLI Test Harness for AI Features
  └── T13
  └── T19
  └── T4
T22: ChatApp.tsx Component Decomposition
  └── T1
  └── T15
T23: Settings.ts Decomposition
  └── —
T3: Context & Mentions System
  └── T1
T34: Settings Panel UI/UX Improvements
T4: Streaming
  └── T9
T5: In-Place Note Editing from Chat
  └── T1
T6: Token & Context Management
  └── T1
  └── T2
T7: Release System & CI/CD
  └── —
T8: Open Source Release with Branding
  └── T7
  └── T8a
T8a: Community Directory Review Remediation
  └── T8
  └── T7
T8b: 1.5.0 Community Scan Follow-up
  └── T8
  └── T8a
T42: Remote Chat Storage & Sync
  └── T40
  └── T42a
  └── T42b
  └── T42c
  └── T42d
  └── T42e
  └── T58
  └── T57
T58: Integrated Sync UI into Chat Lab
  └── T42
  └── T58a
  └── T58b
  └── T58c
  └── T58d
T57: Plugin Data Sync Safety and SyncIt Boundary
  └── T42
  └── T57a
  └── T57b
  └── T57c
  └── T57d
T9: Settings & Provider Profiles
  └── T1
T44: Standalone UI Preview and Obsidian Host Boundary
  └── T1
  └── T22
```

T62: Tool Payload Elision in History Replay
  └── T48b
T62a: T62 Elision Regression — Agent Workflow Breakage
  └── T62

T64: Context Optimization Benchmark Harness
  └── T48a
  └── Coordinates with: T48, T48c, T48d, T6a, T60d
T66: Stylesheet Architecture and CSS Cleanup
  └── T8a
  └── T34
  └── T41
  └── T58d
T67: Storage Lifecycle Decomposition
  └── T46
  └── T57
  └── T58d
  └── T65
T69: External Service Authentication and Provider Adapters
  └── T9
  └── T14
  └── T15
  └── T38
  └── T60
  └── T60e
  └── T69a
  └── T69b
T69a: Codex / ChatGPT Subscription Authentication
  └── T69
  └── T9
  └── T14
  └── T38
  └── T60
  └── T60e
T69b: Claude Code Authentication
  └── T69
  └── T9
  └── T14
  └── T38
  └── T60
  └── T60e

T70: Active Chat Model Identity and Switcher Consistency
  └── T9
  └── T15
  └── Builds on: T35, T36

## Status Summary

- **Active**: 38
- **Completed**: 46
- **Paused**: 3
- **Disabled**: 1
- **Total**: 88

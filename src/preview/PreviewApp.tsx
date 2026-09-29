import React, { useMemo, useRef, useState } from "react";
import {
	chatFixtureStates,
	getChatFixture,
	type ChatFixtureState,
} from "./fixtures/chatStates";
import ChatToolbar from "../components/ChatToolbar";
import ChatTabBar from "../components/ChatTabBar";
import ChatMessages from "../components/ChatMessages";
import ChatInput from "../components/ChatInput";
import ChatOverlays from "../components/ChatOverlays";
const profiles = [
	{
		id: "fixture-openai",
		name: "OpenAI (Fixture)",
		provider: "openai" as const,
		model: "gpt-4o-mini",
		createdAt: 1,
		updatedAt: 1,
	},
	{
		id: "fixture-anthropic",
		name: "Anthropic (Fixture)",
		provider: "anthropic" as const,
		model: "claude-3-5-sonnet",
		createdAt: 1,
		updatedAt: 1,
	},
];
const plugin = {
	app: {
		setting: { open() {}, openTabById() {} },
		workspace: { openLinkText() {} },
	},
	manifest: { id: "chat-lab" },
	settings: {
		providerProfiles: profiles,
		syncRoomId: "obsidian-ai-chat",
		syncUserName: "FixtureUser",
		chatTabTitleWidth: 160,
		pressEnterToSend: true,
	},
} as any;
const previewApp = plugin.app as any;
const renderMarkdown = async (
	markdown: string,
	target: HTMLElement,
): Promise<void> => {
	const html = markdown
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
		.replace(/\n/g, "<br>");
	const parsed = new DOMParser().parseFromString(html, "text/html");
	target.replaceChildren(...Array.from(parsed.body.childNodes));
};

const PreviewApp: React.FC = () => {
	const [state, setState] = useState<ChatFixtureState>(() => {
		const param = new URLSearchParams(window.location.search).get(
			"fixture",
		);
		return chatFixtureStates.includes(param as ChatFixtureState)
			? (param as ChatFixtureState)
			: "normal";
	});
	const session = useMemo(() => getChatFixture(state), [state]);
	const [selectedProfiles, setSelectedProfiles] = useState(
		new Set(["fixture-openai", "fixture-anthropic"]),
	);
	const [relay, setRelay] = useState(state === "relay-only");
	const [participantOpen, setParticipantOpen] = useState(false);
	const [remoteOpen, setRemoteOpen] = useState(false);
	const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
	const participantRef = useRef<HTMLDivElement>(null);
	const remoteRef = useRef<HTMLDivElement>(null);
	const toggleProfile = (id: string) =>
		setSelectedProfiles((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	const noop = () => {};

	return (
		<main className="preview-shell">
			<header className="preview-header">
				<div>
					<p className="preview-eyebrow">Obsidian AI · T44</p>
					<h1>Chat surface preview</h1>
					<p className="preview-subtitle">
						Deterministic browser fixtures — no vault, provider, or
						relay connection.
					</p>
				</div>
				<label>
					<span>Fixture state</span>
					<select
						value={state}
						onChange={(event) =>
							setState(event.target.value as ChatFixtureState)
						}
					>
						{chatFixtureStates.map((fixture) => (
							<option key={fixture} value={fixture}>
								{fixture}
							</option>
						))}
					</select>
				</label>
			</header>

			<section
				className="preview-card"
				aria-label={`${state} chat fixture`}
			>
				<div className="chat-panel">
					<ChatToolbar
						plugin={plugin}
						resolvedProfile={profiles[0]}
						selectedAgents={profiles
							.filter((profile) =>
								selectedProfiles.has(profile.id),
							)
							.map((profile) => ({
								id: profile.id,
								name: profile.name,
								color: "#8ccf9b",
							}))}
						connectedUsers={session.remoteUsers ?? []}
						selectedProfileIds={selectedProfiles}
						selectedRemoteUserIds={
							new Set(session.remoteUsers ?? [])
						}
						showParticipantDropdown={participantOpen}
						showRemoteUserDropdown={remoteOpen}
						participantDropdownRef={participantRef}
						remoteUserDropdownRef={remoteRef}
						autoApprove={false}
						autoNameSessions={false}
						zenMode={false}
						debateMode={false}
						searchVisible={false}
						relayEnabled={relay}
						relayConnected={relay}
						remoteUserCount={session.remoteUsers?.length ?? 0}
						hasHistory={true}
						participantCount={selectedProfiles.size}
						onNewChat={noop}
						onLoadChat={() => setSessionPickerOpen(true)}
						onExportChat={noop}
						onOpenSync={noop}
						onToggleAutoApprove={noop}
						onToggleAutoName={noop}
						onManualRename={noop}
						onToggleZenMode={noop}
						onToggleDebateMode={noop}
						onToggleSearch={noop}
						onToggleRelay={() => setRelay((value) => !value)}
						onToggleParticipantDropdown={() =>
							setParticipantOpen((value) => !value)
						}
						onToggleRemoteUserDropdown={() =>
							setRemoteOpen((value) => !value)
						}
						onToggleProfile={toggleProfile}
						onToggleRemoteUser={noop}
					/>
					<ChatTabBar
						sessions={[
							session,
							{
								...session,
								id: "fixture-second",
								title: "Second conversation",
							},
						]}
						openSessionIds={[session.id, "fixture-second"]}
						activeSessionId={session.id}
						onSelect={noop}
						onClose={noop}
						onCloseOthers={noop}
						onCloseToRight={noop}
						onRename={noop}
					/>
					<div className="preview-transcript">
						<ChatMessages
							sessionId={session.id}
							messages={session.messages}
							currentAiMessage=""
							currentContentParts={[]}
							isStreaming={state === "streaming"}
							isEditing={false}
							app={previewApp}
							renderMarkdown={renderMarkdown}
							showThinking={false}
							onAppend={noop}
							onInsertAtCursor={noop}
							onApply={noop}
							onRetry={noop}
							onEdit={noop}
							onApplyToTarget={noop}
							onCreateNote={noop}
							onAppendToTarget={noop}
							onOpenPastSession={noop}
							typingUsers={[]}
						/>
					</div>
					<ChatInput
						app={previewApp}
						plugin={plugin}
						onSend={noop}
						onStop={noop}
						onTyping={noop}
						onAddMention={noop}
						isStreaming={false}
						isEditing={false}
						onCancel={noop}
						thinkingEnabled={false}
						onToggleThinking={noop}
						attachments={[]}
						onAttachmentsChange={noop}
						pressEnterToSend={true}
						tokenTotal="~42 tokens"
					/>
					<ChatOverlays
						plugin={plugin}
						savedSessions={[
							session,
							{
								...session,
								id: "fixture-second",
								title: "Second conversation",
							},
						]}
						activeSessionId={session.id}
						showSessionPicker={sessionPickerOpen}
						showExportModal={false}
						showContextPicker={false}
						onLoadSession={noop}
						onDeleteSession={noop}
						onRenameSession={noop}
						onCloseSessionPicker={() => setSessionPickerOpen(false)}
						onCloseExportModal={noop}
						onCloseContextPicker={noop}
						onAddContextItems={noop}
						onCopySession={noop}
						onExportSession={noop}
					/>
				</div>
			</section>
		</main>
	);
};

export default PreviewApp;

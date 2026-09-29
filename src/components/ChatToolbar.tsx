import React from "react";
import type { ChatPluginLike } from "../views/ObsidianAIChatView";
import type { ProviderProfile } from "../settings";
import { getAgentColor } from "../lib/agentVisuals";
import ActionBar from "./presentational/ActionBar";
import ProfileIndicator from "./presentational/ProfileIndicator";

interface AgentChip {
	id: string;
	name: string;
	color: string;
	profile?: ProviderProfile;
}

interface ChatToolbarProps {
	plugin: ChatPluginLike;
	resolvedProfile: ProviderProfile;
	selectedAgents: AgentChip[];
	connectedUsers: string[];
	selectedProfileIds: Set<string>;
	resolvedSelectedProfiles?: ProviderProfile[];
	modelOverrides?: Record<string, string>;
	onModelChange?: (profileId: string, model: string) => Promise<void> | void;
	selectedRemoteUserIds: Set<string>;
	showParticipantDropdown: boolean;
	showRemoteUserDropdown: boolean;
	participantDropdownRef: React.RefObject<HTMLDivElement>;
	remoteUserDropdownRef: React.RefObject<HTMLDivElement>;
	autoApprove: boolean;
	autoNameSessions: boolean;
	zenMode: boolean;
	debateMode: boolean;
	searchVisible: boolean;
	relayEnabled: boolean;
	relayConnected: boolean;
	remoteUserCount: number;
	hasHistory: boolean;
	participantCount: number;
	onNewChat: () => void;
	onLoadChat: () => void;
	onExportChat: () => void;
	onOpenSync: () => void;
	onToggleAutoApprove: () => void;
	onToggleAutoName: () => void;
	onManualRename: () => void;
	onToggleZenMode: () => void;
	onToggleDebateMode: () => void;
	onToggleSearch: () => void;
	onToggleRelay: () => void;
	onToggleParticipantDropdown: () => void;
	onToggleRemoteUserDropdown: () => void;
	onToggleProfile: (profileId: string) => void;
	onToggleRemoteUser: (userId: string) => void;
}

const ChatToolbar: React.FC<ChatToolbarProps> = ({
	plugin,
	resolvedProfile,
	selectedAgents,
	connectedUsers,
	selectedProfileIds,
	resolvedSelectedProfiles,
	modelOverrides,
	onModelChange,
	selectedRemoteUserIds,
	showParticipantDropdown,
	showRemoteUserDropdown,
	participantDropdownRef,
	remoteUserDropdownRef,
	autoApprove,
	autoNameSessions,
	zenMode,
	debateMode,
	searchVisible,
	relayEnabled,
	relayConnected,
	remoteUserCount,
	hasHistory,
	participantCount,
	onNewChat,
	onLoadChat,
	onExportChat,
	onOpenSync,
	onToggleAutoApprove,
	onToggleAutoName,
	onManualRename,
	onToggleZenMode,
	onToggleDebateMode,
	onToggleSearch,
	onToggleRelay,
	onToggleParticipantDropdown,
	onToggleRemoteUserDropdown,
	onToggleProfile,
	onToggleRemoteUser,
}) => {
	const profiles = plugin.settings.providerProfiles;
	const syncRoomId = plugin.settings.syncRoomId;
	const syncUserName = plugin.settings.syncUserName;

	return (
		<>
			<div className="chat-action-bar-wrapper" data-testid="chat-toolbar">
				<ActionBar
					onNewChat={onNewChat}
					onLoadChat={onLoadChat}
					onExportChat={onExportChat}
					onOpenSync={onOpenSync}
					canLoad={hasHistory}
					plugin={plugin}
					autoApprove={autoApprove}
					onToggleAutoApprove={onToggleAutoApprove}
					autoNameSessions={autoNameSessions}
					onToggleAutoName={onToggleAutoName}
					onManualRename={onManualRename}
					profile={resolvedProfile}
					selectedProfileIds={selectedProfileIds}
					resolvedSelectedProfiles={resolvedSelectedProfiles}
					modelOverrides={modelOverrides}
					onModelChange={onModelChange}
					zenMode={zenMode}
					onToggleZenMode={onToggleZenMode}
					participantCount={participantCount}
					onToggleParticipantDropdown={onToggleParticipantDropdown}
					debateMode={debateMode}
					onToggleDebateMode={onToggleDebateMode}
					searchVisible={searchVisible}
					onToggleSearch={onToggleSearch}
					relayEnabled={relayEnabled && relayConnected}
					onToggleRelay={onToggleRelay}
					connectedUsers={connectedUsers}
					onToggleRemoteUserDropdown={onToggleRemoteUserDropdown}
					remoteUserCount={remoteUserCount}
				/>
				{showParticipantDropdown && (
					<div
						ref={participantDropdownRef}
						className="chat-participant-dropdown"
					>
						{profiles.map((profile) => {
							const isSelected = selectedProfileIds.has(
								profile.id,
							);
							return (
								<label
									key={profile.id}
									className={`chat-participant-dropdown-item${isSelected ? " is-selected" : ""}`}
								>
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() =>
											onToggleProfile(profile.id)
										}
									/>
									<span
										style={{
											color: getAgentColor(
												profile.provider,
											),
										}}
									>
										●
									</span>
									<span className="chat-participant-dropdown-name">
										{profile.name}
									</span>
									<span className="chat-participant-dropdown-model">
										{profile.model}
									</span>
								</label>
							);
						})}
						{profiles.length === 0 && (
							<div className="chat-participant-dropdown-empty">
								No profiles configured
							</div>
						)}
					</div>
				)}
				{showRemoteUserDropdown && (
					<div
						ref={remoteUserDropdownRef}
						className="chat-remote-user-dropdown"
					>
						<div className="chat-remote-user-dropdown-header">
							<span>Room: {syncRoomId}</span>
							{relayConnected && (
								<span className="chat-remote-user-status is-connected">
									●
								</span>
							)}
						</div>
						{connectedUsers.length === 0 ? (
							<div className="chat-remote-user-dropdown-empty">
								No users connected
							</div>
						) : (
							connectedUsers.map((user) => {
								const isSelected =
									selectedRemoteUserIds.has(user);
								return (
									<label
										key={user}
										className={`chat-remote-user-dropdown-item${isSelected ? " is-selected" : ""}${user === syncUserName ? " is-self" : ""}`}
									>
										<input
											type="checkbox"
											checked={isSelected}
											onChange={() =>
												onToggleRemoteUser(user)
											}
										/>
										<span className="chat-remote-user-dot">
											●
										</span>
										<span className="chat-remote-user-name">
											{user}
											{user === syncUserName && " (You)"}
										</span>
									</label>
								);
							})
						)}
					</div>
				)}
			</div>
			{(selectedAgents.length > 0 || connectedUsers.length > 0) && (
				<div className="chat-participant-bar">
					{selectedAgents.map((p) =>
						plugin.settings.providerProfiles.find(
							(profile) => profile.id === p.id,
						) ? (
							<ProfileIndicator
								key={p.id}
								profile={
									p.profile ??
									plugin.settings.providerProfiles.find(
										(profile) => profile.id === p.id,
									)!
								}
							/>
						) : (
							<span
								key={p.id}
								className="chat-participant-chip"
								style={{ color: p.color }}
							>
								● {p.name}
							</span>
						),
					)}
					{connectedUsers.map((user) => (
						<span
							key={user}
							className="chat-participant-chip chat-participant-chip-remote"
						>
							<span className="chat-participant-dot-online">
								●
							</span>{" "}
							{user}
						</span>
					))}
				</div>
			)}
		</>
	);
};

export default React.memo(ChatToolbar);

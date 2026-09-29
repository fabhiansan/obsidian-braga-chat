import React from "react";
import { Menu } from "obsidian";
import { ChatPluginLike } from "../../views/ObsidianAIChatView";
import type { ProviderProfile } from "../../settings";
import ObsidianIcon from "../ObsidianIcon";
import ModelSwitcher from "./ModelSwitcher";

interface ActionBarProps {
	onNewChat: () => void;
	onLoadChat: () => void;
	onExportChat: () => void;
	onOpenSync: () => void;
	canLoad: boolean;
	plugin: ChatPluginLike;
	autoApprove: boolean;
	onToggleAutoApprove: () => void;
	autoNameSessions: boolean;
	onToggleAutoName: () => void;
	onManualRename: () => void;
	profile: ProviderProfile;
	selectedProfileIds: Set<string>;
	resolvedSelectedProfiles?: ProviderProfile[];
	modelOverrides?: Record<string, string>;
	onModelChange?: (profileId: string, model: string) => Promise<void> | void;
	zenMode?: boolean;
	onToggleZenMode?: () => void;
	participantCount?: number;
	onToggleParticipantDropdown?: () => void;
	debateMode?: boolean;
	onToggleDebateMode?: () => void;
	searchVisible?: boolean;
	onToggleSearch?: () => void;
	relayEnabled?: boolean;
	onToggleRelay?: () => void;
	connectedUsers?: string[];
	onToggleRemoteUserDropdown?: () => void;
	remoteUserCount?: number;
}

const ActionBar: React.FC<ActionBarProps> = ({
	onNewChat,
	onLoadChat,
	onExportChat,
	onOpenSync,
	canLoad,
	plugin,
	autoApprove,
	onToggleAutoApprove,
	autoNameSessions,
	onToggleAutoName,
	onManualRename,
	profile,
	selectedProfileIds,
	resolvedSelectedProfiles,
	modelOverrides,
	onModelChange,
	zenMode,
	onToggleZenMode,
	participantCount,
	onToggleParticipantDropdown,
	debateMode,
	onToggleDebateMode,
	searchVisible,
	onToggleSearch,
	relayEnabled,
	onToggleRelay,
	onToggleRemoteUserDropdown,
	remoteUserCount,
}) => {
	const openSettings = () => {
		(plugin.app as any).setting.open();
		(plugin.app as any).setting.openTabById(plugin.manifest.id);
	};

	const showMoreMenu = (event: React.MouseEvent) => {
		const menu = new Menu();
		menu.addItem((item) =>
			item.setTitle("Session").setIsLabel(true).setSection("session"),
		);
		menu.addItem((item) =>
			item
				.setTitle("Rename session…")
				.setIcon("pencil")
				.setSection("session")
				.onClick(() => onManualRename()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Auto-name new chats")
				.setIcon("text-cursor-input")
				.setChecked(autoNameSessions)
				.setSection("session")
				.onClick(() => onToggleAutoName()),
		);

		menu.addItem((item) =>
			item.setTitle("Safety").setIsLabel(true).setSection("safety"),
		);
		menu.addItem((item) =>
			item
				.setTitle("Auto-approve tool calls")
				.setIcon("bot")
				.setChecked(autoApprove)
				.setSection("safety")
				.onClick(() => onToggleAutoApprove()),
		);

		menu.addItem((item) =>
			item
				.setTitle("Collaboration")
				.setIsLabel(true)
				.setSection("collaboration"),
		);
		if (onToggleDebateMode && (participantCount ?? 0) >= 2) {
			menu.addItem((item) =>
				item
					.setTitle("Debate mode")
					.setIcon("message-circle")
					.setChecked(debateMode ?? false)
					.setSection("collaboration")
					.onClick(() => onToggleDebateMode()),
			);
		}
		if (onToggleRemoteUserDropdown) {
			menu.addItem((item) =>
				item
					.setTitle(`Room members (${remoteUserCount ?? 0})`)
					.setIcon("users")
					.setSection("collaboration")
					.onClick(() => onToggleRemoteUserDropdown()),
			);
		}
		if (onToggleRelay) {
			menu.addItem((item) =>
				item
					.setTitle(
						relayEnabled ? "Disconnect relay" : "Connect relay",
					)
					.setIcon("plug-zap")
					.setChecked(relayEnabled ?? false)
					.setSection("collaboration")
					.onClick(() => onToggleRelay()),
			);
		}

		menu.addItem((item) =>
			item.setTitle("Data").setIsLabel(true).setSection("data"),
		);
		menu.addItem((item) =>
			item
				.setTitle("Export sessions…")
				.setIcon("download")
				.setSection("data")
				.onClick(() => onExportChat()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Sync with remote…")
				.setIcon("sync")
				.setSection("data")
				.onClick(() => onOpenSync()),
		);

		menu.addItem((item) =>
			item.setTitle("App").setIsLabel(true).setSection("app"),
		);
		if (onToggleZenMode) {
			menu.addItem((item) =>
				item
					.setTitle("Zen mode")
					.setIcon("maximize")
					.setChecked(zenMode ?? false)
					.setSection("app")
					.onClick(() => onToggleZenMode()),
			);
		}
		menu.addItem((item) =>
			item
				.setTitle("Settings")
				.setIcon("settings")
				.setSection("app")
				.onClick(openSettings),
		);
		menu.showAtMouseEvent(event.nativeEvent as MouseEvent);
	};

	return (
		<div className="chat-action-bar">
			<div className="chat-action-bar-left">
				<button
					className="chat-btn chat-icon-btn"
					onClick={onNewChat}
					title="New chat"
					aria-label="New chat"
					type="button"
				>
					<ObsidianIcon icon="plus" size={15} />
				</button>
				<button
					data-testid="history-button"
					className="chat-btn chat-icon-btn"
					onClick={onLoadChat}
					disabled={!canLoad}
					title={
						canLoad ? "Load previous session" : "No saved sessions"
					}
					aria-label={
						canLoad ? "Load previous session" : "No saved sessions"
					}
					type="button"
				>
					<ObsidianIcon icon="history" size={15} />
				</button>
				{onToggleSearch && (
					<button
						className={`chat-btn chat-icon-btn ${searchVisible ? "is-active" : ""}`}
						onClick={onToggleSearch}
						title={searchVisible ? "Hide search" : "Search chats"}
						aria-label={
							searchVisible ? "Hide chat search" : "Search chats"
						}
						type="button"
					>
						<ObsidianIcon icon="search" size={15} />
					</button>
				)}

				{/* Keep the active provider/model control immediately before Agents. */}
				<ModelSwitcher
					profile={profile}
					plugin={plugin}
					selectedProfileIds={selectedProfileIds}
					resolvedProfiles={resolvedSelectedProfiles}
					modelOverrides={modelOverrides}
					onModelChange={onModelChange}
				/>

				{onToggleParticipantDropdown && (
					<div className="chat-council-trigger">
						<button
							className={`chat-btn chat-icon-btn ${(participantCount ?? 0) > 0 ? "is-active" : ""}`}
							onClick={onToggleParticipantDropdown}
							title={
								(participantCount ?? 0) > 0
									? `${participantCount} agents in chat`
									: "Group Chat"
							}
							aria-label={`Manage agents, ${participantCount ?? 0} selected`}
							type="button"
						>
							<ObsidianIcon icon="users" size={15} />
							<span className="chat-council-badge">
								{participantCount ?? 0}
							</span>
						</button>
					</div>
				)}
				<button
					className="chat-btn chat-icon-btn"
					onClick={showMoreMenu}
					title="More actions"
					aria-label="More actions"
					aria-haspopup="menu"
					type="button"
				>
					<ObsidianIcon icon="more-horizontal" size={17} />
				</button>
			</div>
		</div>
	);
};

export default ActionBar;

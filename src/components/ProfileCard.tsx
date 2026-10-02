import React, { useState, useCallback, useRef, useEffect } from "react";
import {
	ProviderProfile,
	ProviderType,
	createProviderProfile,
	getDefaultModel,
	getDefaultEndpoint,
	getDefaultProfileName,
	ObsidianAISettings,
} from "../settings";
import { ChatPluginLike } from "../views/ObsidianAIChatView";
import { Notice } from "obsidian";
import { isCliAgentProvider } from "../api/cliAgents/CliAgentLanguageModel";

// ─── Provider metadata ─────────────────────────────────────────────

const PROVIDER_META: Partial<
	Record<ProviderType, { label: string; color: string; icon: string }>
> = {
	openai: { label: "OpenAI", color: "#10A37F", icon: "O" },
	anthropic: { label: "Anthropic", color: "#D97757", icon: "A" },
	deepseek: { label: "DeepSeek", color: "#4D6BFA", icon: "D" },
	kimi: { label: "Kimi", color: "#FF6B6B", icon: "K" },
	gemini: { label: "Gemini", color: "#8E75B2", icon: "G" },
	openrouter: { label: "OpenRouter", color: "#FF9500", icon: "R" },
	azure: { label: "Azure", color: "#0078D4", icon: "Az" },
	custom: { label: "Custom", color: "#888888", icon: "C" },
	agent: { label: "Agent", color: "#00D26A", icon: "🤖" },
	"claude-code": { label: "Claude Code", color: "#D97757", icon: "CC" },
	codex: { label: "Codex", color: "#10A37F", icon: "Cx" },
	opencode: { label: "opencode", color: "#525252", icon: "oc" },
};

function getProviderMeta(provider: ProviderType) {
	return (
		PROVIDER_META[provider] ?? { label: provider, color: "#888", icon: "?" }
	);
}

function maskKey(key?: string): string {
	if (!key || key.length < 8) return key ? "••••••••" : "Not set";
	return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function validateProfileQuick(profile: ProviderProfile): {
	ok: boolean;
	hint?: string;
} {
	switch (profile.provider) {
		case "openai":
		case "anthropic":
		case "deepseek":
		case "kimi":
		case "gemini":
		case "openrouter":
			return profile.apiKey
				? { ok: true }
				: { ok: false, hint: "API key missing" };
		case "azure":
			return profile.apiKey && profile.azureEndpoint
				? { ok: true }
				: { ok: false, hint: "API key or endpoint missing" };
		case "custom":
			return profile.apiKey && profile.customURL
				? { ok: true }
				: { ok: false, hint: "API key or URL missing" };
		case "agent":
			return profile.endpointUrl
				? { ok: true }
				: { ok: false, hint: "Endpoint missing" };
		default:
			return { ok: true };
	}
}

// ─── Types ─────────────────────────────────────────────────────────

export interface ProfileCardProps {
	profile: ProviderProfile;
	isActive: boolean;
	isEditing: boolean;
	onEdit: () => void;
	onSave: (profile: ProviderProfile) => void;
	onCancel: () => void;
	onDelete: () => void;
	onSetDefault: () => void;
	onDuplicate: () => void;
	onTest: () => void;
	plugin: ChatPluginLike;
}

// ─── ProfileEditForm ────────────────────────────────────────────────

function ProfileEditForm({
	profile,
	onSave,
	onCancel,
	plugin,
}: {
	profile: ProviderProfile;
	onSave: (p: ProviderProfile) => void;
	onCancel: () => void;
	plugin: ChatPluginLike;
}) {
	const [draft, setDraft] = useState<ProviderProfile>({ ...profile });
	const [fetching, setFetching] = useState(false);
	const [models, setModels] = useState<string[]>(
		profile.modelCache?.models ?? [],
	);
	const [modelSearch, setModelSearch] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);
	const [testStatus, setTestStatus] = useState<null | {
		ok: boolean;
		message: string;
	}>(null);

	const updateDraft = useCallback(
		<K extends keyof ProviderProfile>(
			key: K,
			value: ProviderProfile[K],
		) => {
			setDraft((prev) => ({
				...prev,
				[key]: value,
				updatedAt: Date.now(),
			}));
		},
		[],
	);

	const handleProviderChange = useCallback(
		(provider: ProviderType) => {
			const name =
				draft.name === getDefaultProfileName(draft.provider)
					? getDefaultProfileName(provider)
					: draft.name;
			setDraft((prev) => ({
				...prev,
				provider,
				model: getDefaultModel(provider),
				name,
				apiKey: prev.apiKey,
				customURL: "",
				azureEndpoint: "",
				endpointUrl: "",
				modelCache: undefined,
				updatedAt: Date.now(),
			}));
			setModels([]);
		},
		[draft.name, draft.provider],
	);

	const handleFetchModels = useCallback(async () => {
		setFetching(true);
		try {
			const { ChatApiManager } = await import("../api");
			const chatApi = new ChatApiManager(plugin.settings, plugin.app);
			const fetched = await chatApi.fetchModels(draft);
			setModels(fetched);
			updateDraft("modelCache", {
				models: fetched,
				fetchedAt: Date.now(),
			});
			new Notice(`Fetched ${fetched.length} models`, 2000);
		} catch (err: any) {
			new Notice(`Failed to fetch models: ${err.message}`, 4000);
		} finally {
			setFetching(false);
		}
	}, [draft, plugin, updateDraft]);

	const handleTest = useCallback(async () => {
		setTestStatus(null);
		const { validateProfile } = await import("../api");
		const error = validateProfile(draft);
		if (error) {
			setTestStatus({ ok: false, message: error });
			return;
		}
		// For non-agent, we can't easily test without a ChatApiManager instance.
		// For agent, we use AgentApiManager.
		if (draft.provider === "agent") {
			try {
				const { AgentApiManager } =
					await import("../api/AgentApiManager");
				const agentApi = new AgentApiManager(
					{
						id: draft.id,
						name: draft.name,
						provider: "agent",
						model: draft.model,
						endpointUrl: draft.endpointUrl || "",
						agentId: draft.agentId || "main",
						authToken: draft.apiKey,
						sessionKey: draft.sessionKey,
						autoApprove: draft.autoApprove ?? false,
						maxSteps: draft.maxSteps ?? 10,
					},
					null as any, // app not needed for testConnection
				);
				const result = await agentApi.testConnection();
				setTestStatus(result);
			} catch (err: any) {
				setTestStatus({ ok: false, message: err.message });
			}
		} else {
			setTestStatus({
				ok: false,
				message: "Testing requires saving the profile first.",
			});
		}
	}, [draft]);

	const filteredModels = modelSearch.trim()
		? models.filter((m) =>
				m.toLowerCase().includes(modelSearch.trim().toLowerCase()),
			)
		: models;

	const meta = getProviderMeta(draft.provider);

	return (
		<div className="obsidian-ai-profile-edit-form">
			<div className="obsidian-ai-profile-edit-row">
				<label>Name</label>
				<input
					type="text"
					value={draft.name}
					onChange={(e) => updateDraft("name", e.target.value)}
					placeholder={meta.label}
				/>
			</div>

			<div className="obsidian-ai-profile-edit-row">
				<label>Provider</label>
				<select
					value={draft.provider}
					onChange={(e) =>
						handleProviderChange(e.target.value as ProviderType)
					}
				>
					<option value="openai">OpenAI</option>
					<option value="anthropic">Anthropic</option>
					<option value="deepseek">DeepSeek</option>
					<option value="kimi">Kimi</option>
					<option value="gemini">Gemini</option>
					<option value="openrouter">OpenRouter</option>
					<option value="azure">Azure OpenAI</option>
					<option value="custom">Custom/OpenAI-compatible</option>
					<option value="agent">Agent (OpenResponses)</option>
					<option value="claude-code">Claude Code (subscription)</option>
					<option value="codex">Codex CLI (ChatGPT login)</option>
					<option value="opencode">opencode</option>
				</select>
			</div>

			<div className="obsidian-ai-profile-edit-row">
				<label>Model</label>
				<div className="obsidian-ai-profile-edit-model">
					<input
						type="text"
						value={draft.model}
						onChange={(e) => updateDraft("model", e.target.value)}
						placeholder={getDefaultModel(draft.provider)}
					/>
					<button
						className="mod-cta"
						onClick={handleFetchModels}
						disabled={fetching}
						type="button"
					>
						{fetching
							? "Fetching…"
							: models.length > 0
								? "Refresh"
								: "Fetch"}
					</button>
				</div>
				{models.length > 0 && (
					<>
						<input
							type="text"
							placeholder="Search models…"
							value={modelSearch}
							onChange={(e) => setModelSearch(e.target.value)}
							className="obsidian-ai-profile-edit-model-search"
						/>
						<div className="obsidian-ai-profile-edit-model-list">
							{filteredModels.slice(0, 50).map((m) => (
								<div
									key={m}
									className={`obsidian-ai-profile-edit-model-item${
										m === draft.model ? " is-active" : ""
									}`}
									onClick={() => {
										updateDraft("model", m);
										setModelSearch("");
									}}
								>
									{m}
								</div>
							))}
							{filteredModels.length > 50 && (
								<div className="obsidian-ai-profile-edit-model-more">
									…{filteredModels.length - 50} more
								</div>
							)}
						</div>
					</>
				)}
			</div>

			{draft.provider !== "ollama" && !isCliAgentProvider(draft.provider) && (
				<div className="obsidian-ai-profile-edit-row">
					<label>API Key</label>
					<div className="obsidian-ai-api-key-control">
						<input type={showApiKey ? "text" : "password"} value={draft.apiKey || ""} onChange={(e) => updateDraft("apiKey", e.target.value)} placeholder={draft.provider === "agent" ? "Bearer token…" : "sk-…"} />
						<button type="button" aria-label={showApiKey ? "Hide API key" : "Show API key"} onClick={() => setShowApiKey((visible) => !visible)}>{showApiKey ? "◉" : "◌"}</button>
						<button type="button" aria-label="Copy API key" onClick={() => { void navigator.clipboard?.writeText(draft.apiKey || ""); }}>⧉</button>
					</div>
				</div>
			)}

			<div className="obsidian-ai-profile-edit-row">
				<label>
					{isCliAgentProvider(draft.provider) ? "CLI path" : "Endpoint"}
				</label>
				<input
					type="text"
					value={
						draft.provider === "azure"
							? draft.azureEndpoint || ""
							: draft.provider === "agent"
								? draft.endpointUrl || ""
								: draft.customURL || ""
					}
					onChange={(e) => {
						const v = e.target.value;
						if (draft.provider === "azure")
							updateDraft("azureEndpoint", v);
						else if (draft.provider === "agent")
							updateDraft("endpointUrl", v);
						else updateDraft("customURL", v);
					}}
					placeholder={getDefaultEndpoint(draft.provider)}
				/>
			</div>

			{draft.provider === "azure" && (
				<div className="obsidian-ai-profile-edit-row">
					<label>Azure API Version</label>
					<input
						type="text"
						value={draft.azureApiVersion || "2024-02-15-preview"}
						onChange={(e) =>
							updateDraft("azureApiVersion", e.target.value)
						}
						placeholder="2024-02-15-preview"
					/>
				</div>
			)}

			{draft.provider === "agent" && (
				<>
					<div className="obsidian-ai-profile-edit-row">
						<label>Agent ID</label>
						<input
							type="text"
							value={draft.agentId || "main"}
							onChange={(e) =>
								updateDraft("agentId", e.target.value || "main")
							}
							placeholder="main"
						/>
					</div>
					<div className="obsidian-ai-profile-edit-row">
						<label>Session Key</label>
						<input
							type="text"
							value={draft.sessionKey || ""}
							onChange={(e) =>
								updateDraft("sessionKey", e.target.value)
							}
							placeholder="Optional session key"
						/>
					</div>
					<div className="obsidian-ai-profile-edit-row">
						<label className="obsidian-ai-profile-edit-toggle">
							<input
								type="checkbox"
								checked={draft.autoApprove ?? false}
								onChange={(e) =>
									updateDraft("autoApprove", e.target.checked)
								}
							/>
							Auto-approve tools
						</label>
					</div>
					<div className="obsidian-ai-profile-edit-row">
						<label>Max Steps</label>
						<input
							type="range"
							min={1}
							max={50}
							value={draft.maxSteps ?? 10}
							onChange={(e) =>
								updateDraft(
									"maxSteps",
									parseInt(e.target.value, 10),
								)
							}
						/>
						<span className="obsidian-ai-profile-edit-step-value">
							{draft.maxSteps ?? 10}
						</span>
					</div>
					<div className="obsidian-ai-profile-edit-row">
						<button
							type="button"
							onClick={handleTest}
							className="obsidian-ai-profile-edit-test-btn"
						>
							Test Connection
						</button>
						{testStatus && (
							<span
								className={`obsidian-ai-profile-edit-test-status${
									testStatus.ok ? " is-ok" : " is-error"
								}`}
							>
								{testStatus.ok ? "✅" : "❌"}{" "}
								{testStatus.message}
							</span>
						)}
					</div>
				</>
			)}

			<div className="obsidian-ai-profile-edit-actions">
				<button
					className="mod-cta"
					onClick={() => onSave(draft)}
					type="button"
				>
					Save
				</button>
				<button onClick={onCancel} type="button">
					Cancel
				</button>
			</div>
		</div>
	);
}

// ─── ProfileCard ──────────────────────────────────────────────────

export function ProfileCard({
	profile,
	isActive,
	isEditing,
	onEdit,
	onSave,
	onCancel,
	onDelete,
	onSetDefault,
	onDuplicate,
	onTest,
	plugin,
}: ProfileCardProps) {
	const meta = getProviderMeta(profile.provider);
	const auth = validateProfileQuick(profile);

	if (isEditing) {
		return (
			<div className="obsidian-ai-profile-row is-editing">
				<ProfileEditForm
					profile={profile}
					onSave={onSave}
					onCancel={onCancel}
					plugin={plugin}
				/>
			</div>
		);
	}

	return (
		<div
			className={`obsidian-ai-profile-row${isActive ? " is-active" : ""}`}
		>
			{/* Icon + Name */}
			<div className="obsidian-ai-profile-col obsidian-ai-profile-col-name">
				<div className="obsidian-ai-profile-name-wrap">
					<div
						className="obsidian-ai-profile-icon-sm"
						style={{ backgroundColor: meta.color }}
						title={meta.label}
					>
						{meta.icon}
					</div>
					<div className="obsidian-ai-profile-name-stack">
						<div className="obsidian-ai-profile-name-row">
							<span className="obsidian-ai-profile-name">
								{profile.name}
							</span>
							{isActive && (
								<span className="obsidian-ai-profile-badge">
									Default
								</span>
							)}
						</div>
						<div className="obsidian-ai-profile-provider">
							{meta.label}
						</div>
					</div>
				</div>
			</div>

			{/* Model */}
			<div className="obsidian-ai-profile-col obsidian-ai-profile-col-model">
				<span
					className="obsidian-ai-profile-mono"
					title={profile.model}
				>
					{profile.model}
				</span>
			</div>

			{/* Endpoint */}
			<div className="obsidian-ai-profile-col obsidian-ai-profile-col-endpoint">
				<span
					className="obsidian-ai-profile-mono"
					title={
						profile.provider === "azure"
							? profile.azureEndpoint ||
								getDefaultEndpoint("azure")
							: profile.provider === "agent"
								? profile.endpointUrl ||
									getDefaultEndpoint("agent")
								: profile.customURL ||
									getDefaultEndpoint(profile.provider)
					}
				>
					{profile.provider === "azure"
						? (
								profile.azureEndpoint ||
								getDefaultEndpoint("azure")
							).replace(/^https?:\/\//, "")
						: profile.provider === "agent"
							? (
									profile.endpointUrl ||
									getDefaultEndpoint("agent")
								).replace(/^https?:\/\//, "")
							: (
									profile.customURL ||
									getDefaultEndpoint(profile.provider)
								).replace(/^https?:\/\//, "")}
				</span>
			</div>

			{/* Key */}
			<div className="obsidian-ai-profile-col obsidian-ai-profile-col-key">
				<span
					className={`obsidian-ai-profile-key${!auth.ok ? " is-missing" : ""}`}
				>
					{maskKey(profile.apiKey)}
				</span>
			</div>

			{/* Status */}
			<div className="obsidian-ai-profile-col obsidian-ai-profile-col-status">
				<div
					className={`obsidian-ai-profile-status-dot${auth.ok ? " is-ok" : " is-warn"}`}
					title={auth.hint || "Ready"}
				/>
			</div>

			{/* Actions */}
			<div className="obsidian-ai-profile-col obsidian-ai-profile-col-actions">
				<button
					className="obsidian-ai-icon-btn-sm"
					title="Edit"
					onClick={onEdit}
				>
					✏️
				</button>
				<button
					className="obsidian-ai-icon-btn-sm"
					title="Duplicate"
					onClick={onDuplicate}
				>
					📋
				</button>
				<button
					className="obsidian-ai-icon-btn-sm"
					title="Test connection"
					onClick={onTest}
				>
					🔌
				</button>
				<button
					className={`obsidian-ai-icon-btn-sm${isActive ? " is-active" : ""}`}
					title="Set as default"
					onClick={onSetDefault}
				>
					⭐
				</button>
				<button
					className="obsidian-ai-icon-btn-sm is-danger"
					title="Delete"
					onClick={onDelete}
				>
					🗑️
				</button>
			</div>
		</div>
	);
}

// ─── ProfileList ──────────────────────────────────────────────────

export interface ProfileListProps {
	plugin: ChatPluginLike;
}

export function ProfileList({ plugin }: ProfileListProps) {
	const [profiles, setProfiles] = useState<ProviderProfile[]>(
		plugin.settings.providerProfiles,
	);
	const [activeId, setActiveId] = useState(
		plugin.settings.activeProviderProfileId,
	);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [testingId, setTestingId] = useState<string | null>(null);

	// Sync with plugin settings when they change externally
	useEffect(() => {
		setProfiles(plugin.settings.providerProfiles);
		setActiveId(plugin.settings.activeProviderProfileId);
	}, [
		plugin.settings.providerProfiles,
		plugin.settings.activeProviderProfileId,
	]);

	const saveSettings = useCallback(async () => {
		plugin.settings.providerProfiles = profiles;
		plugin.settings.activeProviderProfileId = activeId;
		await plugin.saveSettings();
		plugin.chatapi.updateSettings(plugin.settings);
	}, [plugin, profiles, activeId]);

	const handleAdd = useCallback(() => {
		const profile = createProviderProfile({ name: "New profile" });
		const next = [...profiles, profile];
		setProfiles(next);
		setActiveId(profile.id);
		setEditingId(profile.id);
	}, [profiles]);

	const handleSave = useCallback(
		(updated: ProviderProfile) => {
			const next = profiles.map((p) =>
				p.id === updated.id ? updated : p,
			);
			setProfiles(next);
			setEditingId(null);
			// Auto-save after edit
			plugin.settings.providerProfiles = next;
			plugin.saveSettings().then(() => {
				plugin.chatapi.updateSettings(plugin.settings);
				new Notice("Profile saved", 1800);
			});
		},
		[profiles, plugin],
	);

	const handleDelete = useCallback(
		(id: string) => {
			if (profiles.length <= 1) {
				new Notice("Keep at least one provider profile.", 3000);
				return;
			}
			const next = profiles.filter((p) => p.id !== id);
			setProfiles(next);
			if (activeId === id) {
				setActiveId(next[0].id);
			}
			plugin.settings.providerProfiles = next;
			plugin.settings.activeProviderProfileId =
				activeId === id ? next[0].id : activeId;
			plugin.saveSettings().then(() => {
				plugin.chatapi.updateSettings(plugin.settings);
			});
		},
		[profiles, activeId, plugin],
	);

	const handleSetDefault = useCallback(
		(id: string) => {
			setActiveId(id);
			plugin.settings.activeProviderProfileId = id;
			plugin.saveSettings().then(() => {
				plugin.chatapi.updateSettings(plugin.settings);
			});
		},
		[plugin],
	);

	const handleDuplicate = useCallback(
		(id: string) => {
			const source = profiles.find((p) => p.id === id);
			if (!source) return;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring intentionally removes the source profile ID before duplication.
			const { id: _unused, ...sourceWithoutId } = source;
			const dup = createProviderProfile({
				...sourceWithoutId,
				name: `${source.name} copy`,
			});
			const next = [...profiles, dup];
			setProfiles(next);
			setActiveId(dup.id);
			plugin.settings.providerProfiles = next;
			plugin.settings.activeProviderProfileId = dup.id;
			plugin.saveSettings().then(() => {
				plugin.chatapi.updateSettings(plugin.settings);
			});
		},
		[profiles, plugin],
	);

	const handleTest = useCallback(
		async (id: string) => {
			setTestingId(id);
			const profile = profiles.find((p) => p.id === id);
			if (!profile) return;

			try {
				if (profile.provider === "agent") {
					const { AgentApiManager } =
						await import("../api/AgentApiManager");
					const agentApi = new AgentApiManager(
						{
							id: profile.id,
							name: profile.name,
							provider: "agent",
							model: profile.model,
							endpointUrl: profile.endpointUrl || "",
							agentId: profile.agentId || "main",
							authToken: profile.apiKey,
							sessionKey: profile.sessionKey,
							autoApprove: profile.autoApprove ?? false,
							maxSteps: profile.maxSteps ?? 10,
						},
						plugin.app,
					);
					const result = await agentApi.testConnection();
					new Notice(
						result.ok
							? `✅ ${result.message}`
							: `❌ ${result.message}`,
						6000,
					);
				} else {
					// For standard providers, we need to use the ChatApiManager.
					// The existing testApiConnection only tests the *active* profile.
					// We temporarily swap, test, and restore.
					const originalActive =
						plugin.settings.activeProviderProfileId;
					plugin.settings.activeProviderProfileId = profile.id;
					plugin.chatapi.updateSettings(plugin.settings);
					const result = await plugin.chatapi.testApiConnection();
					// Restore
					plugin.settings.activeProviderProfileId = originalActive;
					plugin.chatapi.updateSettings(plugin.settings);
					new Notice(
						result.ok
							? `✅ ${result.message}`
							: `❌ ${result.message}`,
						6000,
					);
				}
			} catch (err: any) {
				new Notice(`❌ Test failed: ${err.message}`, 6000);
			} finally {
				setTestingId(null);
			}
		},
		[profiles, plugin],
	);

	return (
		<div className="obsidian-ai-profile-list">
			<div className="obsidian-ai-profile-list-header">
				<button className="mod-cta" onClick={handleAdd} type="button">
					+ New Profile
				</button>
			</div>
			<div className="obsidian-ai-profile-rows">
				{profiles.map((profile) => (
					<ProfileCard
						key={profile.id}
						profile={profile}
						isActive={profile.id === activeId}
						isEditing={profile.id === editingId}
						onEdit={() => setEditingId(profile.id)}
						onSave={handleSave}
						onCancel={() => setEditingId(null)}
						onDelete={() => handleDelete(profile.id)}
						onSetDefault={() => handleSetDefault(profile.id)}
						onDuplicate={() => handleDuplicate(profile.id)}
						onTest={() => handleTest(profile.id)}
						plugin={plugin}
					/>
				))}
			</div>
			{testingId && (
				<div className="obsidian-ai-profile-testing-toast">
					Testing {profiles.find((p) => p.id === testingId)?.name}…
				</div>
			)}
		</div>
	);
}

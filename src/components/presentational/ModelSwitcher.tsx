import React, {
	useState,
	useRef,
	useEffect,
	useLayoutEffect,
	useCallback,
	useMemo,
} from "react";
import { createPortal } from "react-dom";
import { Notice } from "obsidian";
import type { ProviderProfile } from "../../settings";
import { getProviderColor } from "../../settings";
import { ChatPluginLike } from "../../views/ObsidianAIChatView";
import ObsidianIcon from "../ObsidianIcon";
import { getRecentModels, rememberRecentModel } from "../../lib/recentModels";

// ─── Fallback model lists per provider ─────────────────────────────

const FALLBACK_MODELS: Record<string, string[]> = {
	openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
	anthropic: [
		"claude-3-5-sonnet-latest",
		"claude-3-5-sonnet-20241022",
		"claude-3-5-haiku-latest",
		"claude-3-5-haiku-20241022",
		"claude-3-opus-latest",
		"claude-3-opus-20240229",
		"claude-3-sonnet-20240229",
		"claude-3-haiku-20240307",
	],
	gemini: [
		"gemini-1.5-pro",
		"gemini-1.5-flash",
		"gemini-1.0-pro",
		"gemini-pro",
	],
	deepseek: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
	kimi: [
		"kimi-k2",
		"kimi-k2.5",
		"kimi-k3",
		"moonshot-v1-8k",
		"moonshot-v1-32k",
		"moonshot-v1-128k",
	],
	openrouter: [
		"openai/gpt-4o",
		"openai/gpt-4o-mini",
		"anthropic/claude-3.5-sonnet",
		"meta-llama/llama-3.1-70b",
		"google/gemini-1.5-pro",
	],
	azure: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-35-turbo"],
	ollama: ["llama3.2", "llama3.1", "llama3", "mistral", "codellama", "phi4"],
	custom: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
	agent: ["openclaw"],
};

function getFallbackModels(provider: string): string[] {
	return FALLBACK_MODELS[provider] ?? [];
}

// ─── Types ─────────────────────────────────────────────────────────

interface ModelSwitcherProps {
	profile: ProviderProfile;
	plugin: ChatPluginLike;
	selectedProfileIds: Set<string>;
	resolvedProfiles?: ProviderProfile[];
	modelOverrides?: Record<string, string>;
	onModelChange?: (profileId: string, model: string) => Promise<void> | void;
}

// ─── Component ─────────────────────────────────────────────────────

export const ModelSwitcher: React.FC<ModelSwitcherProps> = ({
	profile,
	plugin,
	selectedProfileIds,
	resolvedProfiles,
	modelOverrides,
	onModelChange,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [submenuAgentId, setSubmenuAgentId] = useState<string | null>(null);
	const [models, setModels] = useState<Record<string, string[]>>({});
	const [selectedModel, setSelectedModel] = useState(profile.model);
	const [fetching, setFetching] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const [dropdownPosition, setDropdownPosition] = useState({
		top: 0,
		left: 0,
	});

	const applyModelOverride = useCallback(
		(target: ProviderProfile): ProviderProfile => {
			const model = modelOverrides?.[target.id];
			return model && model !== target.model
				? { ...target, model }
				: target;
		},
		[modelOverrides],
	);

	const selectedProfiles = useMemo(() => {
		if (resolvedProfiles) return resolvedProfiles;
		return Array.from(selectedProfileIds)
			.map((id) =>
				plugin.settings.providerProfiles.find((p) => p.id === id),
			)
			.filter(Boolean)
			.map((p) => applyModelOverride(p as ProviderProfile));
	}, [
		resolvedProfiles,
		selectedProfileIds,
		plugin.settings.providerProfiles,
		applyModelOverride,
	]);
	const isMultiAgent = selectedProfiles.length > 1;

	// Active profile for single-agent mode
	const activeProfile =
		isMultiAgent && submenuAgentId
			? (selectedProfiles.find((p) => p.id === submenuAgentId) ?? profile)
			: profile;

	// Keep the local trigger responsive even though profile settings are mutated
	// in-place by the plugin and the parent chat view may not re-render immediately.
	useEffect(() => {
		setSelectedModel(profile.model);
	}, [profile.id, profile.model]);

	// Sync cached models when a profile changes. Caches belong to profiles, not
	// providers: two credentials for the same provider may expose different models.
	useEffect(() => {
		if (activeProfile.modelCache?.models) {
			setModels((prev) => ({
				...prev,
				[activeProfile.id]: activeProfile.modelCache!.models,
			}));
		}
	}, [activeProfile.modelCache?.models, activeProfile.id]);

	// Do not leave a stale nested view behind when the selected agents change.
	useEffect(() => {
		if (
			!isMultiAgent ||
			(submenuAgentId &&
				!selectedProfiles.some((p) => p.id === submenuAgentId))
		) {
			setSubmenuAgentId(null);
			setSearch("");
		}
	}, [isMultiAgent, selectedProfiles, submenuAgentId]);

	// Focus search when opening
	useEffect(() => {
		if (isOpen && searchRef.current) {
			setTimeout(() => searchRef.current?.focus(), 10);
		}
	}, [isOpen]);

	// The toolbar scroll container clips descendants below its bottom edge.
	// Position the portaled menu against the trigger so it remains visible over
	// the chat content while the toolbar retains horizontal scrolling.
	useLayoutEffect(() => {
		if (!isOpen) return;

		const updateDropdownPosition = () => {
			const trigger = triggerRef.current;
			if (!trigger) return;

			const rect = trigger.getBoundingClientRect();
			const padding = 8;
			const menuWidth = Math.min(320, window.innerWidth - padding * 2);
			const menuHeight = Math.min(400, window.innerHeight - padding * 2);
			const maxLeft = Math.max(
				padding,
				window.innerWidth - menuWidth - padding,
			);
			const belowTop = rect.bottom + 4;
			const top =
				belowTop + menuHeight <= window.innerHeight - padding
					? belowTop
					: Math.max(padding, rect.top - menuHeight - 4);
			setDropdownPosition({
				top,
				left: Math.min(Math.max(padding, rect.left), maxLeft),
			});
		};

		updateDropdownPosition();
		window.addEventListener("resize", updateDropdownPosition);
		window.addEventListener("scroll", updateDropdownPosition, true);
		return () => {
			window.removeEventListener("resize", updateDropdownPosition);
			window.removeEventListener("scroll", updateDropdownPosition, true);
		};
	}, [isOpen]);

	// Click outside to close
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node) &&
				(!dropdownRef.current ||
					!dropdownRef.current.contains(event.target as Node))
			) {
				setIsOpen(false);
				setSubmenuAgentId(null);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	// Escape to close
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (submenuAgentId) {
					setSubmenuAgentId(null);
					setSearch("");
				} else {
					setIsOpen(false);
				}
			}
		};
		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
		}
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, submenuAgentId]);

	const getModelsForProfile = useCallback(
		(target: ProviderProfile): string[] => {
			const cached = models[target.id] ?? target.modelCache?.models ?? [];
			const fallback = getFallbackModels(target.provider);
			const recent = getRecentModels(
				plugin.settings.recentModels,
				target.provider,
			);
			const combined = [
				...(cached.length > 0 ? cached : fallback),
				...recent,
				target.model,
			];
			const seen = new Set<string>();
			const deduped: string[] = [];
			for (const m of combined) {
				if (typeof m === "string" && m.trim() && !seen.has(m)) {
					seen.add(m);
					deduped.push(m);
				}
			}
			return deduped.sort((a, b) => a.localeCompare(b));
		},
		[models, plugin.settings.recentModels],
	);

	const allModels = useMemo(() => {
		return getModelsForProfile(activeProfile);
	}, [getModelsForProfile, activeProfile]);

	const recentModels = useMemo(() => {
		const recent = getRecentModels(
			plugin.settings.recentModels,
			activeProfile.provider,
		);
		return recent.filter(
			(m, index) =>
				typeof m === "string" &&
				m.trim() &&
				recent.indexOf(m) === index,
		);
	}, [
		plugin.settings.recentModels,
		activeProfile.id,
		activeProfile.provider,
	]);

	const filteredModels = useMemo(() => {
		if (!search.trim()) return allModels;
		const q = search.trim().toLowerCase();
		return allModels.filter((m) => m.toLowerCase().includes(q));
	}, [allModels, search]);

	const handleSelectModel = useCallback(
		async (model: string, targetProfile?: ProviderProfile) => {
			const target = targetProfile ?? activeProfile;
			if (model === target.model) {
				setIsOpen(false);
				setSubmenuAgentId(null);
				setSearch("");
				return;
			}

			// The selected model belongs to this chat tab. Keep the provider profile
			// itself unchanged so another tab using the same credentials is isolated.
			if (onModelChange) {
				await onModelChange(target.id, model);
			} else {
				// Standalone/legacy consumers may not provide the tab-owned callback.
				const profiles = plugin.settings.providerProfiles.map((p) =>
					p.id === target.id
						? { ...p, model, updatedAt: Date.now() }
						: p,
				);
				plugin.settings.providerProfiles = profiles;
			}
			if (target.id === profile.id) setSelectedModel(model);

			// Update the provider-scoped recent list. All credential profiles for
			// this provider intentionally share this history.
			plugin.settings.recentModels = rememberRecentModel(
				plugin.settings.recentModels,
				target.provider,
				model,
			);

			await plugin.saveSettings();
			if (!onModelChange) plugin.chatapi.updateSettings(plugin.settings);

			if (isMultiAgent) {
				new Notice(`Updated ${target.name} to ${model}`, 2000);
				setSubmenuAgentId(null);
				setSearch("");
			} else {
				new Notice(`Switched to ${model}`, 2000);
				setIsOpen(false);
				setSearch("");
			}
		},
		[activeProfile, plugin, isMultiAgent, profile.id, onModelChange],
	);

	const handleRefresh = useCallback(async () => {
		setFetching(true);
		try {
			const { ChatApiManager } = await import("../../api");
			const chatApi = new ChatApiManager(plugin.settings, plugin.app);
			const fetched = await chatApi.fetchModels(activeProfile);
			setModels((prev) => ({
				...prev,
				[activeProfile.id]: fetched,
			}));

			// Update modelCache on the profile
			const profiles = plugin.settings.providerProfiles.map((p) =>
				p.id === activeProfile.id
					? {
							...p,
							modelCache: {
								models: fetched,
								fetchedAt: Date.now(),
							},
							updatedAt: Date.now(),
						}
					: p,
			);
			plugin.settings.providerProfiles = profiles;
			await plugin.saveSettings();
			plugin.chatapi.updateSettings(plugin.settings);
			new Notice(`Fetched ${fetched.length} models`, 2000);
		} catch (err: any) {
			new Notice(`Failed to fetch models: ${err.message}`, 4000);
		} finally {
			setFetching(false);
		}
	}, [activeProfile, plugin]);

	const handleOpenAgentModels = useCallback((agentId: string) => {
		setSubmenuAgentId(agentId);
		setSearch("");
	}, []);

	const handleBackToAgents = useCallback(() => {
		setSubmenuAgentId(null);
		setSearch("");
	}, []);

	// Recent models get their own section; do not render them a second time below.
	const recentModelSet = useMemo(() => new Set(recentModels), [recentModels]);
	const displayModels = search.trim()
		? filteredModels
		: filteredModels.filter((model) => !recentModelSet.has(model));
	const hasRecent = !search.trim() && recentModels.length > 0;
	const hasResults = displayModels.length > 0;

	// Trigger label
	const activeModelCount = Math.max(1, selectedProfileIds.size);
	const currentModel = isMultiAgent ? activeProfile.model : selectedModel;
	const triggerLabel = String(activeModelCount);
	const toggleOpen = () => {
		setIsOpen((prev) => {
			if (prev) {
				setSubmenuAgentId(null);
				setSearch("");
			}
			return !prev;
		});
	};

	return (
		<div className="chat-model-switcher" ref={containerRef}>
			<button
				data-testid="model-switcher-trigger"
				ref={triggerRef}
				className="chat-btn chat-icon-btn chat-model-switcher-trigger"
				onClick={toggleOpen}
				aria-expanded={isOpen}
				aria-haspopup="menu"
				aria-label={
					isMultiAgent
						? `Configure models for ${activeModelCount} agents`
						: `Change model: ${profile.provider} / ${currentModel}`
				}
				title={
					isMultiAgent
						? `${selectedProfileIds.size} agents — click to manage models`
						: `${profile.provider} / ${currentModel} — click to change model`
				}
				type="button"
			>
				<ObsidianIcon
					icon="cpu"
					size={14}
					className="chat-model-switcher-model-icon"
				/>
				<span className="chat-model-switcher-current">
					{triggerLabel}
				</span>
			</button>

			{isOpen && typeof document !== "undefined" && document.body
				? (createPortal(
						<div
							ref={dropdownRef}
							className="chat-model-switcher-dropdown"
							role="menu"
							style={{
								top: dropdownPosition.top,
								left: dropdownPosition.left,
							}}
						>
							{/* ─── Multi-agent: Agent list ─── */}
							{isMultiAgent && !submenuAgentId ? (
								<div
									className="chat-model-switcher-list"
									role="none"
								>
									<div className="chat-model-switcher-section-header">
										Select agent to configure
									</div>
									{selectedProfiles.map((p) => (
										<button
											key={p.id}
											className="chat-model-switcher-item"
											role="menuitem"
											onClick={() =>
												handleOpenAgentModels(p.id)
											}
											type="button"
										>
											<span
												className="chat-model-switcher-item-dot"
												style={{
													color: getProviderColor(
														p.provider,
													),
												}}
											>
												●
											</span>
											<span className="chat-model-switcher-item-name">
												{p.name}
											</span>
											<span className="chat-model-switcher-item-model">
												{p.model}
											</span>
											<ObsidianIcon
												icon="chevron-right"
												size={14}
											/>
										</button>
									))}
								</div>
							) : (
								<>
									{/* ─── Search ─── */}
									{submenuAgentId && (
										<button
											className="chat-model-switcher-back"
											role="menuitem"
											onClick={handleBackToAgents}
											type="button"
										>
											<ObsidianIcon
												icon="arrow-left"
												size={14}
											/>
											Back to agents
										</button>
									)}
									<div className="chat-model-switcher-search">
										<ObsidianIcon icon="search" size={14} />
										<input
											ref={searchRef}
											type="text"
											placeholder="Search models..."
											value={search}
											onChange={(e) =>
												setSearch(e.target.value)
											}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" &&
													displayModels.length > 0
												) {
													handleSelectModel(
														displayModels[0],
													);
												}
											}}
										/>
									</div>

									{/* ─── Model list ─── */}
									<div className="chat-model-switcher-list">
										{hasRecent && (
											<>
												<div className="chat-model-switcher-section-header">
													Recently used
												</div>
												{recentModels.map((m) => (
													<button
														key={`recent-${m}`}
														className={`chat-model-switcher-item${m === currentModel ? " is-active" : ""}`}
														role="menuitem"
														onClick={() =>
															handleSelectModel(m)
														}
														type="button"
													>
														<span className="chat-model-switcher-item-name">
															{m}
														</span>
														{m === currentModel && (
															<ObsidianIcon
																icon="check"
																size={14}
															/>
														)}
													</button>
												))}
											</>
										)}

										{hasRecent && (
											<div className="chat-model-switcher-section-header">
												All models
												<span className="chat-model-switcher-count">
													{displayModels.length}
												</span>
											</div>
										)}

										{hasResults ? (
											displayModels.map((m) => (
												<button
													key={m}
													className={`chat-model-switcher-item${m === currentModel ? " is-active" : ""}`}
													role="menuitem"
													onClick={() =>
														handleSelectModel(m)
													}
													type="button"
												>
													<span className="chat-model-switcher-item-name">
														{m}
													</span>
													{m === currentModel && (
														<ObsidianIcon
															icon="check"
															size={14}
														/>
													)}
												</button>
											))
										) : (
											<div className="chat-model-switcher-empty">
												No models match &ldquo;
												{search.trim()}
												&rdquo;
											</div>
										)}
									</div>

									{/* ─── Footer ─── */}
									<div className="chat-model-switcher-footer">
										<button
											className="chat-model-switcher-refresh"
											onClick={handleRefresh}
											disabled={fetching}
											type="button"
										>
											<ObsidianIcon
												icon={
													fetching
														? "loader"
														: "refresh-cw"
												}
												size={14}
											/>
											{fetching
												? "Fetching…"
												: "Refresh models"}
										</button>
									</div>
								</>
							)}
						</div>,
						document.body,
					) as unknown as React.ReactNode)
				: null}
		</div>
	);
};

export default ModelSwitcher;

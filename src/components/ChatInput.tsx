import React, {
	useState,
	useRef,
	useCallback,
	useEffect,
	useMemo,
} from "react";
import { App, Notice, TFile, TFolder } from "obsidian";
import { ContextItem } from "../types";
import {
	createAttachment,
	createExternalAttachment,
} from "../context/AttachmentEngine";
import { ChatPluginLike } from "../views/ObsidianAIChatView";

interface ChatInputProps {
	app: App;
	plugin: ChatPluginLike;
	onSend: (
		text: string,
		attachments?: import("../types").Attachment[],
	) => void;
	onStop: () => void;
	onAddMention: (item: ContextItem) => void;
	isStreaming: boolean;
	isEditing?: boolean;
	onCancel?: () => void;
	editMessage?: string;
	/** Whether thinking mode is enabled for LLM */
	thinkingEnabled?: boolean;
	/** Toggle thinking mode */
	onToggleThinking?: () => void;
	/** Current attachments (for rendering chips) */
	attachments?: import("../types").Attachment[];
	/** Callback when attachments change */
	onAttachmentsChange?: (
		attachments: import("../types").Attachment[],
	) => void;
	/** Whether pressing Enter sends the message (Shift+Enter for newline) */
	pressEnterToSend?: boolean;
	/** Optional token total string to display next to toggles */
	tokenTotal?: string;
	/** Optional draft text to restore on mount */
	draft?: string;
	/** Called whenever the composer text changes. */
	onDraftChange?: (text: string) => void;
	/** Called when user is typing (for relay sync) */
	onTyping?: () => void;
}

type AutoType = "mention" | "slash" | "wikilink";

interface AutoCandidate {
	key: string;
	label: string;
	icon: string;
	type: AutoType;
	// Mention data
	contextType?: ContextItem["type"];
	path?: string;
	name?: string;
	tag?: string;
	/** Parent folder path for display disambiguation */
	folderPath?: string;
}

interface AutoState {
	type: AutoType;
	query: string;
	start: number;
	index: number;
}

function makeId(): string {
	return crypto.randomUUID();
}

function detectAutocomplete(
	text: string,
	cursorPos: number,
): Omit<AutoState, "index"> | null {
	const beforeCursor = text.slice(0, cursorPos);

	// 1. Wikilink [[ — check first so it beats mention when typing inside slash cmds
	const wikiMatch = beforeCursor.match(/\[\[([^\[\]]*)$/);
	if (wikiMatch) {
		const start = beforeCursor.lastIndexOf("[[");
		return { type: "wikilink", query: wikiMatch[1], start };
	}

	// 2. Mention @
	const mentionMatch = beforeCursor.match(/@([^@\s]*)$/);
	if (mentionMatch) {
		const start = beforeCursor.lastIndexOf("@");
		return { type: "mention", query: mentionMatch[1], start };
	}

	// 3. Slash command / — only at start of input
	const slashMatch = beforeCursor.match(/^\/([^/\s]*)$/);
	if (slashMatch) {
		return { type: "slash", query: slashMatch[1], start: 0 };
	}

	return null;
}

const SLASH_COMMANDS: AutoCandidate[] = [
	{
		key: "slash:edit",
		label: "/edit [[Note]] prompt",
		icon: "✏️",
		type: "slash",
	},
	{
		key: "slash:create",
		label: "/create [[Note]] prompt",
		icon: "📝",
		type: "slash",
	},
	{
		key: "slash:append",
		label: "/append [[Note]] prompt",
		icon: "➕",
		type: "slash",
	},
];

const ChatInput: React.FC<ChatInputProps> = ({
	app,
	plugin,
	onSend,
	onStop,
	onAddMention,
	isStreaming,
	isEditing,
	onCancel,
	editMessage,
	thinkingEnabled,
	onToggleThinking,
	attachments = [],
	onAttachmentsChange,
	pressEnterToSend = true,
	tokenTotal,
	draft,
	onDraftChange,
	onTyping,
}) => {
	const [value, setValue] = useState(draft ?? "");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [auto, setAuto] = useState<AutoState | null>(null);
	const [showAttachDropdown, setShowAttachDropdown] = useState(false);
	const attachDropdownRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const typingThrottleRef = useRef<number | null>(null);

	// Close attachment dropdown when clicking outside
	useEffect(() => {
		if (!showAttachDropdown) return;
		const handleClick = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				attachDropdownRef.current &&
				!attachDropdownRef.current.contains(target)
			) {
				setShowAttachDropdown(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [showAttachDropdown]);

	const handleAttachFile = useCallback(
		(type: "note" | "image" | "pdf") => {
			setShowAttachDropdown(false);
			const files = app.vault.getAllLoadedFiles().filter((f) => {
				if (!(f instanceof TFile)) return false;
				if (type === "note") return f.extension === "md";
				if (type === "image")
					return [
						"png",
						"jpg",
						"jpeg",
						"gif",
						"webp",
						"bmp",
					].includes(f.extension);
				if (type === "pdf") return f.extension === "pdf";
				return false;
			}) as TFile[];

			if (files.length === 0) {
				new Notice(`No ${type} files found in vault.`);
				return;
			}

			const modal = document.body.createEl("div", {
				cls: "chat-attach-modal",
			});
			const content = modal.createEl("div", {
				cls: "chat-attach-modal-content",
			});
			content.createEl("h4", {
				text: `Select ${type === "note" ? "Note" : type === "image" ? "Image" : "PDF"}`,
			});
			const list = content.createEl("div", { cls: "chat-attach-list" });
			const cancelButton = content.createEl("button", {
				text: "Cancel",
				cls: "chat-btn chat-attach-cancel",
			});
			files.forEach((file) => {
				const item = list.createEl("div", {
					text: file.path,
					cls: "chat-attach-item",
				});
				item.addEventListener("click", () => {
					const att = createAttachment(file.path);
					onAttachmentsChange?.([...attachments, att]);
					modal.remove();
				});
			});
			cancelButton.addEventListener("click", () => modal.remove());
		},
		[app, attachments, onAttachmentsChange],
	);

	const handleRemoveAttachment = useCallback(
		(id: string) => {
			onAttachmentsChange?.(attachments.filter((a) => a.id !== id));
		},
		[attachments, onAttachmentsChange],
	);

	const handleFiles = useCallback(
		async (files: FileList | null) => {
			if (!files || files.length === 0) return;
			const newAttachments: import("../types").Attachment[] = [];
			for (const file of Array.from(files)) {
				try {
					const att = await createExternalAttachment(file);
					newAttachments.push(att);
				} catch (e) {
					new Notice(`Failed to attach file: ${file.name}`);
					console.error(
						"[ChatInput] Failed to attach external file:",
						e,
					);
				}
			}
			if (newAttachments.length > 0) {
				onAttachmentsChange?.([...attachments, ...newAttachments]);
			}
		},
		[attachments, onAttachmentsChange],
	);

	const handleFileInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			handleFiles(e.target.files);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		},
		[handleFiles],
	);

	const handleAttachExternal = useCallback(() => {
		setShowAttachDropdown(false);
		fileInputRef.current?.click();
	}, []);

	// Auto-resize textarea based on content
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.setCssStyles({ height: "auto" });
		const maxHeight = 96;
		const newHeight = Math.min(textarea.scrollHeight, maxHeight);
		textarea.setCssStyles({ height: newHeight + "px" });
	}, [value]);

	useEffect(() => {
		if (editMessage !== undefined) {
			setValue(editMessage);
			setTimeout(() => textareaRef.current?.focus(), 50);
		} else {
			setValue(draft ?? "");
		}
	}, [draft, editMessage]);

	const allCandidates = useMemo(() => {
		if (!auto) return [];

		if (auto.type === "slash") {
			return SLASH_COMMANDS;
		}

		const candidates: AutoCandidate[] = [];

		for (const file of app.vault
			.getMarkdownFiles()
			.sort((a, b) => b.stat.mtime - a.stat.mtime)) {
			candidates.push({
				key: `note:${file.path}`,
				label: file.basename,
				icon: "📄",
				type: auto.type,
				contextType: "note",
				path: file.path,
				name: file.basename,
			});
		}

		// Detect duplicate basenames for path display
		const pathDisplay = plugin.settings.contextPickerPathDisplay;
		const basenameCounts = new Map<string, number>();
		for (const c of candidates) {
			if (c.contextType === "note") {
				basenameCounts.set(
					c.label,
					(basenameCounts.get(c.label) || 0) + 1,
				);
			}
		}
		const getParentFolder = (filePath: string): string => {
			const lastSlash = filePath.lastIndexOf("/");
			if (lastSlash <= 0) return "";
			return filePath.slice(0, lastSlash);
		};
		for (const c of candidates) {
			if (c.contextType !== "note" || !c.path) continue;
			if (pathDisplay === "always") {
				c.folderPath = getParentFolder(c.path);
			} else if (
				pathDisplay === "duplicates" &&
				basenameCounts.get(c.label)! > 1
			) {
				c.folderPath = getParentFolder(c.path);
			}
		}

		if (auto.type === "mention") {
			for (const folder of app.vault
				.getAllLoadedFiles()
				.filter((f): f is TFolder => f instanceof TFolder)
				.sort((a, b) => a.path.localeCompare(b.path))) {
				const isRoot = folder.path === "";
				candidates.push({
					key: `folder:${folder.path}`,
					label: isRoot ? "(vault root)" : folder.name,
					icon: "📁",
					type: "mention",
					contextType: "folder",
					path: folder.path,
					name: isRoot ? "(vault root)" : folder.name,
					folderPath: isRoot ? "" : folder.path,
				});
			}
			const tagMap = (app.metadataCache as any).getTags() as Record<
				string,
				number
			>;
			for (const [tag, count] of Object.entries(tagMap)) {
				candidates.push({
					key: `tag:${tag}`,
					label: `${tag} (${count})`,
					icon: "#",
					type: "mention",
					contextType: "tag",
					tag,
				});
			}
		}

		return candidates;
	}, [app, auto?.type, plugin]);

	const filteredCandidates = useMemo(() => {
		if (!auto) return [];
		const q = auto.query.toLowerCase().trim();
		if (!q) return allCandidates;

		// Score each candidate by match quality
		const scored = allCandidates
			.map((c) => {
				const label = c.label.toLowerCase();
				const path = (c.path || "").toLowerCase();
				let score = 0;

				if (label === q || path === q) score = 100;
				else if (label.startsWith(q)) score = 80;
				else if (path.startsWith(q)) score = 70;
				else if (label.includes(q)) score = 60;
				else if (path.includes(q)) score = 50;
				else {
					// Check if all query words appear in label or path
					const words = q.split(/\s+/).filter(Boolean);
					const allInLabel = words.every((w) => label.includes(w));
					const allInPath = words.every((w) => path.includes(w));
					if (allInLabel) score = 40;
					else if (allInPath) score = 30;
				}

				return { candidate: c, score };
			})
			.filter((s) => s.score > 0);

		scored.sort((a, b) => b.score - a.score);
		return scored.map((s) => s.candidate);
	}, [allCandidates, auto]);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const text = e.target.value;
			const cursorPos = e.target.selectionStart;
			setValue(text);
			onDraftChange?.(text);

			const detected = detectAutocomplete(text, cursorPos);
			if (detected) {
				setAuto({ ...detected, index: 0 });
			} else {
				setAuto(null);
			}
			// Throttled typing indicator (max once per 2 seconds)
			if (onTyping) {
				if (!typingThrottleRef.current) {
					onTyping();
					typingThrottleRef.current = window.setTimeout(() => {
						typingThrottleRef.current = null;
					}, 2000);
				}
			}
		},
		[onDraftChange, onTyping],
	);

	const insertCandidate = useCallback(
		(candidate: AutoCandidate) => {
			if (!auto) return;

			if (auto.type === "mention") {
				const before = value.slice(0, auto.start);
				const after = value.slice(
					textareaRef.current?.selectionStart ?? value.length,
				);
				const newValue = before + candidate.label + after;
				setValue(newValue);
				onDraftChange?.(newValue);
				setAuto(null);

				let item: ContextItem;
				if (candidate.contextType === "note") {
					item = {
						type: "note",
						path: candidate.path!,
						name: candidate.name!,
						id: makeId(),
					};
				} else if (candidate.contextType === "folder") {
					item = {
						type: "folder",
						path: candidate.path!,
						name: candidate.name!,
						id: makeId(),
					};
				} else {
					item = {
						type: "tag",
						tag: candidate.tag!,
						id: makeId(),
					};
				}
				onAddMention(item);
				setTimeout(() => textareaRef.current?.focus(), 0);
				return;
			}

			if (auto.type === "slash") {
				const replacement = candidate.label + " ";
				const before = value.slice(0, auto.start);
				const after = value.slice(
					textareaRef.current?.selectionStart ?? value.length,
				);
				const newValue = before + replacement + after;
				setValue(newValue);
				onDraftChange?.(newValue);
				setAuto(null);
				setTimeout(() => {
					textareaRef.current?.focus();
					const pos = auto.start + replacement.length;
					textareaRef.current?.setSelectionRange(pos, pos);
				}, 0);
				return;
			}

			if (auto.type === "wikilink") {
				const replacement = `[[${candidate.label}]]`;
				const before = value.slice(0, auto.start);
				const after = value.slice(
					textareaRef.current?.selectionStart ?? value.length,
				);
				const newValue = before + replacement + after;
				setValue(newValue);
				onDraftChange?.(newValue);
				setAuto(null);
				setTimeout(() => {
					textareaRef.current?.focus();
					const pos = auto.start + replacement.length;
					textareaRef.current?.setSelectionRange(pos, pos);
				}, 0);
				return;
			}
		},
		[auto, value, onAddMention, onDraftChange],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (auto && filteredCandidates.length > 0) {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					setAuto((prev) =>
						prev
							? {
									...prev,
									index:
										(prev.index + 1) %
										filteredCandidates.length,
								}
							: prev,
					);
					return;
				}
				if (e.key === "ArrowUp") {
					e.preventDefault();
					setAuto((prev) =>
						prev
							? {
									...prev,
									index:
										(prev.index -
											1 +
											filteredCandidates.length) %
										filteredCandidates.length,
								}
							: prev,
					);
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					insertCandidate(filteredCandidates[auto.index]);
					return;
				}
				if (e.key === "Escape") {
					e.preventDefault();
					setAuto(null);
					return;
				}
			}

			if (e.key === "Enter") {
				const shouldSend = pressEnterToSend
					? !e.shiftKey
					: e.shiftKey || e.metaKey || e.ctrlKey;
				if (shouldSend) {
					e.preventDefault();
					const trimmed = value.trim();
					if ((trimmed || attachments.length > 0) && !isStreaming) {
						onSend(
							trimmed,
							attachments.length > 0 ? attachments : undefined,
						);
						setValue("");
						onDraftChange?.("");
						setAuto(null);
						onAttachmentsChange?.([]);
					}
				}
				// Plain Enter inserts a newline when pressEnterToSend is disabled.
			}
		},
		[
			auto,
			filteredCandidates,
			insertCandidate,
			value,
			isStreaming,
			onSend,
			attachments,
			onAttachmentsChange,
			pressEnterToSend,
		],
	);

	const [isDragOver, setIsDragOver] = useState(false);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragOver(false);
			handleFiles(e.dataTransfer.files);
		},
		[handleFiles],
	);

	/** Parse text and wrap @mentions and [[wikilinks]] in pill spans for the overlay */
	const renderMentionOverlay = (text: string): React.ReactNode[] => {
		if (!text) return [];
		const parts: React.ReactNode[] = [];
		let lastIndex = 0;

		// Find all @mentions and [[wikilinks]] in the text
		const mentionRegex = /@([^\s]+)/g;
		const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
		const matches: {
			start: number;
			end: number;
			text: string;
			type: "mention" | "wikilink";
		}[] = [];

		let m;
		while ((m = mentionRegex.exec(text)) !== null) {
			matches.push({
				start: m.index,
				end: m.index + m[0].length,
				text: m[0],
				type: "mention",
			});
		}
		while ((m = wikilinkRegex.exec(text)) !== null) {
			matches.push({
				start: m.index,
				end: m.index + m[0].length,
				text: m[0],
				type: "wikilink",
			});
		}

		matches.sort((a, b) => a.start - b.start);

		for (const match of matches) {
			if (match.start > lastIndex) {
				parts.push(text.slice(lastIndex, match.start));
			}
			parts.push(
				<span key={match.start} className="chat-mention-pill">
					{match.text}
				</span>,
			);
			lastIndex = match.end;
		}
		if (lastIndex < text.length) {
			parts.push(text.slice(lastIndex));
		}
		return parts;
	};

	const placeholder = pressEnterToSend
		? "Ask anything... (Shift+Enter for new line)"
		: "Ask anything... (Enter for new line, Shift+Enter or Cmd/Ctrl+Enter to send)";

	return (
		<div
			style={{ position: "relative" }}
			data-testid="chat-composer"
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{auto && filteredCandidates.length > 0 && (
				<div className="chat-mention-dropdown">
					{filteredCandidates.map((candidate, i) => (
						<div
							key={candidate.key}
							className={`chat-mention-item${i === auto.index ? " chat-mention-item-active" : ""}`}
							onMouseDown={(e) => {
								e.preventDefault();
								insertCandidate(candidate);
							}}
							onMouseEnter={() =>
								setAuto((prev) =>
									prev ? { ...prev, index: i } : prev,
								)
							}
						>
							<span className="chat-mention-icon">
								{candidate.icon}
							</span>
							<span className="chat-mention-label">
								{candidate.label}
								{candidate.folderPath && (
									<span className="chat-mention-folder">
										{candidate.folderPath}
									</span>
								)}
							</span>
						</div>
					))}
				</div>
			)}
			<div
				className={`chat-input-wrapper${isDragOver ? " drag-over" : ""}`}
			>
				{/* Row 1: Textarea + send button */}
				<div
					className="chat-input-row"
					style={{ position: "relative" }}
				>
					<div className="chat-textarea-overlay" aria-hidden="true">
						{renderMentionOverlay(value)}
					</div>
					<textarea
						ref={textareaRef}
						className="chat-textarea chat-textarea-with-overlay"
						rows={1}
						placeholder={placeholder}
						value={value}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						disabled={isStreaming}
					/>
					{/* Right: send/stop/edit actions */}
					<div className="chat-input-right">
						{isStreaming ? (
							<button
								className="chat-btn chat-stop-btn chat-send-icon"
								onClick={onStop}
								title="Stop"
							>
								⏹
							</button>
						) : isEditing ? (
							<div className="chat-input-actions">
								<button
									className="chat-btn chat-send-btn chat-send-icon"
									onClick={() => {
										const trimmed = value.trim();
										if (
											(trimmed ||
												attachments.length > 0) &&
											!isStreaming
										) {
											onSend(
												trimmed,
												attachments.length > 0
													? attachments
													: undefined,
											);
											setValue("");
											setAuto(null);
											onDraftChange?.("");
											onAttachmentsChange?.([]);
										}
									}}
									disabled={
										!value.trim() &&
										attachments.length === 0
									}
									title="Resubmit"
								>
									▶
								</button>
								<button
									className="chat-btn chat-send-icon"
									onClick={() => {
										setValue("");
										setAuto(null);
										onDraftChange?.("");
										onCancel?.();
									}}
									title="Cancel"
								>
									✕
								</button>
							</div>
						) : (
							<button
								className="chat-btn chat-send-btn chat-send-icon"
								onClick={() => {
									const trimmed = value.trim();
									if (
										(trimmed || attachments.length > 0) &&
										!isStreaming
									) {
										onSend(
											trimmed,
											attachments.length > 0
												? attachments
												: undefined,
										);
										setValue("");
										setAuto(null);
										onDraftChange?.("");
										onAttachmentsChange?.([]);
									}
								}}
								disabled={
									!value.trim() && attachments.length === 0
								}
								title="Send"
							>
								▶
							</button>
						)}
					</div>
				</div>
				{/* Row 2: Attachment chips + action buttons below textarea */}
				<div className="chat-input-toolbar">
					{/* Left: attachment chips + attach button */}
					<div className="chat-input-toolbar-left">
						{attachments.map((att) => (
							<div key={att.id} className="chat-attachment-chip">
								<span className="chat-attachment-icon">
									{att.type === "image"
										? "🖼️"
										: att.type === "pdf"
											? "📑"
											: "📄"}
								</span>
								<span className="chat-attachment-name">
									{att.name}
								</span>
								<button
									className="chat-attachment-remove"
									onClick={() =>
										handleRemoveAttachment(att.id)
									}
									title="Remove attachment"
									type="button"
								>
									×
								</button>
							</div>
						))}
						<div
							style={{ position: "relative" }}
							ref={attachDropdownRef}
						>
							<button
								className="chat-input-attach"
								onClick={() => setShowAttachDropdown((v) => !v)}
								title="Attach file"
								type="button"
							>
								📎
							</button>
							{showAttachDropdown && (
								<div className="chat-attach-dropdown">
									<div
										className="chat-attach-dropdown-item"
										onMouseDown={(e) => {
											e.preventDefault();
											handleAttachFile("note");
										}}
									>
										<span>📄</span>
										<span>Attach Note</span>
									</div>
									<div
										className="chat-attach-dropdown-item"
										onMouseDown={(e) => {
											e.preventDefault();
											handleAttachFile("image");
										}}
									>
										<span>🖼️</span>
										<span>Attach Image</span>
									</div>
									<div
										className="chat-attach-dropdown-item"
										onMouseDown={(e) => {
											e.preventDefault();
											handleAttachFile("pdf");
										}}
									>
										<span>📑</span>
										<span>Attach PDF</span>
									</div>
									<div className="chat-attach-dropdown-divider" />
									<div
										className="chat-attach-dropdown-item"
										onMouseDown={(e) => {
											e.preventDefault();
											handleAttachExternal();
										}}
									>
										<span>📁</span>
										<span>Browse External File</span>
									</div>
								</div>
							)}
						</div>
						{onToggleThinking && (
							<button
								className={`chat-input-thinking${thinkingEnabled ? " is-active" : ""}`}
								onClick={onToggleThinking}
								title={
									thinkingEnabled
										? "Thinking mode ON — Click to disable"
										: "Thinking mode OFF — Click to enable"
								}
								type="button"
							>
								{thinkingEnabled ? "🧠" : "💤"}
							</button>
						)}
						{tokenTotal && (
							<span className="chat-input-token-total">
								{tokenTotal}
							</span>
						)}
					</div>
				</div>
			</div>
			{/* Hidden file input for external file picker */}
			<input
				ref={fileInputRef}
				type="file"
				style={{ display: "none" }}
				accept="image/*,.pdf,.txt,.md"
				onChange={handleFileInputChange}
				multiple
			/>
		</div>
	);
};

export default ChatInput;

import React, { useEffect, useMemo, useRef, useState } from "react";
import { App, Notice, TFile } from "obsidian";
import { ChatMessage, ContextItem, ContentPart, Attachment } from "../types";
import MessageActions from "./presentational/MessageActions";
import ToolCallNotification from "./presentational/ToolCallNotification";
import ToolCallGroup from "./presentational/ToolCallGroup";
import { sanitizeHtmlForRenderer } from "../lib/sanitizeHtml";
import { makeMarkdownTablesScrollable } from "./scrollableMarkdownTables";
import {
	formatMessageTimestamp,
	formatMessageTimestampTitle,
} from "../lib/messageTimestamp";

/** Highlight context item names in rendered DOM */
export function highlightMentions(
	container: HTMLElement,
	items: ContextItem[],
): void {
	if (!items || items.length === 0) return;
	const names = items
		.map((item) => {
			switch (item.type) {
				case "note":
					return item.name;
				case "folder":
					return item.name;
				case "tag":
					return item.tag;
				case "active-note":
					return "Active note";
			}
		})
		.filter((name): name is string => Boolean(name));
	if (names.length === 0) return;
	// Sort by length descending so overlapping names prefer the longest match
	names.sort((a, b) => b.length - a.length);
	// Walk text nodes and replace EVERY occurrence, not just the first.
	const walker = document.createTreeWalker(
		container,
		NodeFilter.SHOW_TEXT,
		null,
	);
	const nodes: Text[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) {
		nodes.push(node as Text);
	}
	let pillsCreated = 0;
	for (const textNode of nodes) {
		const text = textNode.textContent || "";
		// Find all non-overlapping matches, earliest first; on a tie the
		// longest name wins (names are length-sorted).
		const matches: Array<{ start: number; name: string }> = [];
		let searchFrom = 0;
		while (searchFrom <= text.length) {
			let bestIdx = -1;
			let bestName = "";
			for (const name of names) {
				const idx = text.indexOf(name, searchFrom);
				if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
					bestIdx = idx;
					bestName = name;
				}
			}
			if (bestIdx === -1) break;
			matches.push({ start: bestIdx, name: bestName });
			searchFrom = bestIdx + bestName.length;
		}
		if (matches.length === 0) continue;
		pillsCreated += matches.length;
		const parent = textNode.parentNode;
		if (!parent) continue;
		const fragment = document.createDocumentFragment();
		let cursor = 0;
		for (const match of matches) {
			if (match.start > cursor) {
				fragment.appendChild(
					document.createTextNode(text.slice(cursor, match.start)),
				);
			}
			const span = document.createElement("span");
			span.className = "chat-mention-pill";
			span.textContent = match.name;
			fragment.appendChild(span);
			cursor = match.start + match.name.length;
		}
		if (cursor < text.length) {
			fragment.appendChild(document.createTextNode(text.slice(cursor)));
		}
		parent.replaceChild(fragment, textNode);
	}
	if (pillsCreated > 0) {
		(window as any).__obsidianAiLogger?.log?.(
			"debug",
			`[Mentions] pilled ${pillsCreated} mention(s)`,
		);
	}
}

/**
 * Wire up internal Obsidian links so they open notes instead of crashing.
 * Also opens external links in the system browser.
 */
function logChatLink(level: "debug" | "error", ...args: unknown[]): void {
	const logger = (window as any).__obsidianAiLogger;
	logger?.log?.(level, ...args);
	// Link navigation can immediately trigger a failing Obsidian view. Flush
	// breadcrumbs now so they survive even if that view interrupts the UI.
	if (level === "debug") logger?.flushNow?.();
}

const linkInterceptionContainers = new WeakSet<HTMLElement>();

export function setupLinkInterception(container: HTMLElement, app: App): void {
	const linkCount = container.querySelectorAll("a").length;
	if (linkInterceptionContainers.has(container)) {
		if (linkCount > 0) {
			logChatLink("debug", "[ChatLinks] handlers already installed", {
				count: linkCount,
			});
		}
		return;
	}
	linkInterceptionContainers.add(container);

	// Use one capture listener on the stable message container. Replacing
	// Obsidian-rendered anchors can leave the mobile renderer holding references
	// to detached nodes and crash before a target-level click handler runs.
	container.addEventListener(
		"click",
		async (e: Event) => {
			const target = e.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest("a");
			if (!(anchor instanceof HTMLAnchorElement)) return;
			if (!container.contains(anchor)) return;

			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			const rawHref = anchor.getAttribute("href") || "";
			const dataHref = anchor.getAttribute("data-href") || "";
			const href = dataHref || rawHref;
			logChatLink("debug", "[ChatLinks] click", {
				href,
				rawHref,
				dataHref,
				className: anchor.className,
				connected: anchor.isConnected,
			});
			if (href.startsWith("obsidian-ai://open-session")) {
				logChatLink(
					"debug",
					"[ChatLinks] dispatching chat session link",
				);
				const url = new URL(href);
				const sessionId = url.searchParams.get("sessionId");
				const messageId = url.searchParams.get("messageId");
				if (sessionId && messageId) {
					window.dispatchEvent(
						new CustomEvent("obsidian-ai:open-session", {
							detail: { sessionId, messageId },
						}),
					);
				}
				return;
			}

			// Internal Obsidian wiki-link or file link
			if (
				href.startsWith("[[") ||
				href.endsWith(".md") ||
				anchor.classList.contains("internal-link")
			) {
				try {
					// Remove [[ ]] wrappers if present
					const cleanHref = href
						.replace(/^\[\[/, "")
						.replace(/\]\]$/, "");
					logChatLink("debug", "[ChatLinks] openLinkText start", {
						target: cleanHref,
						sourcePath: "",
						newLeaf: false,
					});
					await app.workspace.openLinkText(cleanHref, "", false);
					logChatLink("debug", "[ChatLinks] openLinkText resolved", {
						target: cleanHref,
					});
				} catch (err) {
					logChatLink(
						"error",
						"[ChatLinks] openLinkText rejected",
						{ target: href },
						err,
					);
					console.error(
						"[obsidian-ai] Failed to open internal link:",
						err,
					);
				}
				return;
			}

			// obsidian:// protocol
			if (href.startsWith("obsidian://")) {
				try {
					window.open(href, "_blank");
				} catch (err) {
					console.error(
						"[obsidian-ai] Failed to open obsidian:// link:",
						err,
					);
				}
				return;
			}

			// External link — open in browser
			if (href.startsWith("http://") || href.startsWith("https://")) {
				window.open(href, "_blank");
				return;
			}

			// Fallback — treat as internal link
			try {
				logChatLink(
					"debug",
					"[ChatLinks] openLinkText fallback start",
					{
						target: href,
						sourcePath: "",
						newLeaf: false,
					},
				);
				await app.workspace.openLinkText(href, "", false);
				logChatLink(
					"debug",
					"[ChatLinks] openLinkText fallback resolved",
					{ target: href },
				);
			} catch (err) {
				logChatLink(
					"error",
					"[ChatLinks] openLinkText fallback rejected",
					{ target: href },
					err,
				);
				console.error("[obsidian-ai] Failed to open link:", err);
			}
		},
		true,
	);
	if (linkCount > 0) {
		logChatLink("debug", "[ChatLinks] handlers installed", {
			count: linkCount,
		});
	}
}

interface MessageBubbleProps {
	message: ChatMessage;
	app: App;
	renderMarkdown: (
		markdown: string,
		target: HTMLElement,
		sourcePath?: string,
	) => Promise<void>;
	isStreaming?: boolean;
	showThinking?: boolean;
	onAppend: (content: string) => void;
	onInsertAtCursor: (content: string) => void;
	onApply: (content: string) => void;
	onRetry: () => void;
	onEdit: () => void;
	onApplyToTarget: (content: string, target: string) => void;
	onCreateNote: (content: string, target: string) => void;
	onAppendToTarget: (content: string, target: string) => void;
	onOpenPastSession?: (sessionId: string, messageId: string) => void;
	selectionMode?: boolean;
	selected?: boolean;
	onLongPress?: (messageId: string) => void;
	onToggleSelection?: (messageId: string) => void;
}

/** Searchable name for a context item, used for inline-mention dedup. */
function contextItemName(item: ContextItem): string {
	switch (item.type) {
		case "note":
		case "folder":
			return item.name;
		case "tag":
			return item.tag;
		case "active-note":
			return "Active note";
	}
}

function formatContextItems(items: ContextItem[]): string {
	return items
		.map((item) => {
			switch (item.type) {
				case "note":
					return `📄 ${item.name}`;
				case "folder":
					return `📁 ${item.name}`;
				case "tag":
					return `#${item.tag}`;
				case "active-note":
					return "📄 Active note";
			}
		})
		.join(", ");
}

type PartBlock =
	| Extract<ContentPart, { type: "text" }>
	| { type: "tool_group"; calls: Extract<ContentPart, { type: "tool_call" }>[] };

/** Braga fork: merges runs of consecutive tool calls into one block. */
function groupToolCalls(parts: ContentPart[]): PartBlock[] {
	const blocks: PartBlock[] = [];
	for (const part of parts) {
		const last = blocks[blocks.length - 1];
		if (part.type === "text") blocks.push(part);
		else if (last?.type === "tool_group") last.calls.push(part);
		else blocks.push({ type: "tool_group", calls: [part] });
	}
	return blocks;
}

/** Strips model thinking/reasoning tag blocks from text */
export function stripThinkingTags(text: string): string {
	return text
		.replace(/<\|channel\|>[\s\S]*?<channel\|>/gi, "")
		.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
		.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
		.replace(/<\|thinking\|>[\s\S]*?<\/thinking>/gi, "")
		.trim();
}

/** Renders a text segment using Obsidian's MarkdownRenderer */
function TextSegment({
	content,
	app,
	renderMarkdown,
	showThinking,
	contextItems,
}: {
	content: string;
	app: App;
	renderMarkdown: (
		markdown: string,
		target: HTMLElement,
		sourcePath?: string,
	) => Promise<void>;
	showThinking?: boolean;
	contextItems?: ContextItem[];
}): React.ReactElement {
	const ref = useRef<HTMLDivElement>(null);
	const cleanContent = showThinking ? content : stripThinkingTags(content);

	useEffect(() => {
		if (!ref.current) return;
		let unmounted = false;
		ref.current.replaceChildren();

		renderMarkdown(sanitizeHtmlForRenderer(cleanContent), ref.current, "")
			.catch((err: any) => {
				if (unmounted || !ref.current) return;
				ref.current.replaceChildren();
				ref.current.createEl("pre", {
					text: cleanContent,
					cls: "chat-plaintext-fallback",
				});
			})
			.then(() => {
				if (!unmounted && ref.current) {
					makeMarkdownTablesScrollable(ref.current);
					if (contextItems) {
						highlightMentions(ref.current, contextItems);
					}
					setupLinkInterception(ref.current, app);
				}
			});

		return () => {
			unmounted = true;
		};
	}, [cleanContent, app, contextItems, renderMarkdown]);

	return <div ref={ref} className="chat-bubble-content-segment" />;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
	message,
	app,
	renderMarkdown,
	isStreaming,
	showThinking,
	onAppend,
	onInsertAtCursor,
	onApply,
	onRetry,
	onEdit,
	onApplyToTarget,
	onCreateNote,
	onAppendToTarget,
	onOpenPastSession,
	selectionMode,
	selected,
	onLongPress,
	onToggleSelection,
}) => {
	const [isActive, setIsActive] = useState(false);
	const bubbleRef = useRef<HTMLDivElement>(null);
	const longPressTimer = useRef<number | null>(null);
	const longPressTriggered = useRef(false);

	// Context items whose names don't appear in the message text are not
	// rendered as inline mention pills, so the footer still shows them.
	// Items already visible inline would be redundant there.
	const totalContextItems = message.contextItems?.length ?? 0;
	const visibleContextItems = useMemo(
		() =>
			message.role === "user"
				? (message.contextItems ?? []).filter(
						(item) =>
							!message.content.includes(contextItemName(item)),
					)
				: [],
		[message.role, message.contextItems, message.content],
	);

	const cancelLongPress = () => {
		if (longPressTimer.current !== null)
			window.clearTimeout(longPressTimer.current);
		longPressTimer.current = null;
	};
	const handlePointerDown = (e: React.PointerEvent) => {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		longPressTriggered.current = false;
		cancelLongPress();
		longPressTimer.current = window.setTimeout(() => {
			longPressTriggered.current = true;
			onLongPress?.(message.id);
		}, 600);
	};

	// Click outside to deactivate
	useEffect(() => {
		return cancelLongPress;
	}, []);

	useEffect(() => {
		if (message.role !== "user" || totalContextItems === 0) return;
		(window as any).__obsidianAiLogger?.log?.(
			"debug",
			`[Mentions] context footer: ${visibleContextItems.length}/${totalContextItems} items shown (rest inline)`,
		);
	}, [message.role, totalContextItems, visibleContextItems.length]);

	useEffect(() => {
		if (!isActive) return;
		const handleDocClick = (e: MouseEvent) => {
			if (
				bubbleRef.current &&
				!bubbleRef.current.contains(e.target as Node)
			) {
				setIsActive(false);
			}
		};
		document.addEventListener("mousedown", handleDocClick);
		return () => document.removeEventListener("mousedown", handleDocClick);
	}, [isActive]);

	const handleCopy = () => {
		navigator.clipboard.writeText(message.content);
	};

	const time = formatMessageTimestamp(message.timestamp);
	const timeTitle = formatMessageTimestampTitle(message.timestamp);
	const timeDateTime = Number.isNaN(new Date(message.timestamp).getTime())
		? undefined
		: new Date(message.timestamp).toISOString();

	// Determine what to render: contentParts (inline) or legacy fallback
	const hasInlineParts =
		message.contentParts && message.contentParts.length > 0;

	// For streaming display without parts yet, show the raw content
	const renderParts: ContentPart[] | null = hasInlineParts
		? message.contentParts!
		: isStreaming
			? [{ type: "text", content: message.content }]
			: null;

	// Legacy fallback: just render full content as before
	const useLegacyRender = !renderParts && !isStreaming;

	return (
		<div
			ref={bubbleRef}
			className={`chat-bubble chat-bubble-${message.role}${message.remote ? " is-remote" : ""}${message.agentId ? " chat-bubble-agent" : ""}${message.isError ? " chat-bubble-error" : ""}${isActive ? " is-active" : ""}${selected ? " chat-bubble-selected" : ""}${isStreaming ? " chat-bubble-streaming" : ""}`}
			style={
				message.agentColor && message.role === "assistant"
					? ({
							"--chat-agent-color": message.agentColor,
						} as React.CSSProperties)
					: undefined
			}
			onPointerDown={handlePointerDown}
			onPointerUp={cancelLongPress}
			onPointerCancel={cancelLongPress}
			onPointerMove={cancelLongPress}
			onClick={() => {
				cancelLongPress();
				if (longPressTriggered.current) {
					longPressTriggered.current = false;
					return;
				}
				if (selectionMode) {
					onToggleSelection?.(message.id);
					return;
				}
				// Don't activate bubble if user is selecting/highlighting text
				const selection = window.getSelection();
				if (selection && selection.toString().trim().length > 0) {
					if (
						bubbleRef.current &&
						selection.containsNode(bubbleRef.current, true)
					) {
						return;
					}
				}
				setIsActive(true);
			}}
		>
			{selectionMode && (
				<span
					className="chat-message-selection-check"
					aria-label={selected ? "Selected" : "Not selected"}
				>
					{selected ? "✓" : "○"}
				</span>
			)}
			<div className="chat-bubble-header">
				<span className="chat-bubble-role">
					{message.role === "user"
						? message.remote && message.fromUserId
							? message.fromUserId
							: "You"
						: message.agentName
							? message.agentName
							: "Obsidian AI"}
				</span>
				{message.agentColor && message.role === "assistant" && (
					<span
						className="chat-bubble-agent-dot"
						style={{ backgroundColor: message.agentColor }}
						title={message.agentName}
					/>
				)}
				<time
					className="chat-bubble-time"
					dateTime={timeDateTime}
					title={timeTitle}
				>
					{time}
				</time>
			</div>

			{/* Content: inline parts or legacy single block */}
			{useLegacyRender ? (
				<LegacyContent
					content={message.content}
					app={app}
					renderMarkdown={renderMarkdown}
					messageId={message.id}
					contextItems={message.contextItems}
				/>
			) : (
				<div className="chat-bubble-content-inline">
					{groupToolCalls(renderParts!).map((block, i) =>
						block.type === "text" ? (
							<TextSegment
								key={i}
								content={block.content}
								app={app}
								renderMarkdown={renderMarkdown}
								showThinking={showThinking}
								contextItems={message.contextItems}
							/>
						) : block.calls.length === 1 ? (
							<ToolCallNotification
								key={i}
								toolCall={block.calls[0].call}
								result={block.calls[0].result}
								isPending={!block.calls[0].result}
								onOpenPastSession={onOpenPastSession}
							/>
						) : (
							<ToolCallGroup key={i} calls={block.calls}>
								{block.calls.map((c, j) => (
									<ToolCallNotification
										key={j}
										toolCall={c.call}
										result={c.result}
										isPending={!c.result}
										onOpenPastSession={onOpenPastSession}
									/>
								))}
							</ToolCallGroup>
						),
					)}
				</div>
			)}

			{/* Context tracking for user messages — only items NOT already
			    visible as inline mention pills in the message text. */}
			{message.role === "user" && visibleContextItems.length > 0 && (
				<div className="chat-message-context-footer">
					<span className="chat-message-context-label">Context:</span>
					<span className="chat-message-context-items">
						{formatContextItems(visibleContextItems)}
					</span>
				</div>
			)}

			{/* Attachments for user messages */}
			{message.role === "user" &&
				message.attachments &&
				message.attachments.length > 0 && (
					<div className="chat-message-attachments">
						{message.attachments.map((att) =>
							att.type === "pdf" ? (
								<PdfAttachmentCard
									key={att.id}
									attachment={att}
									app={app}
								/>
							) : (
								<div
									key={att.id}
									className="chat-attachment-chip chat-attachment-chip-readonly"
								>
									<span className="chat-attachment-icon">
										{att.type === "image" ? "🖼️" : "📄"}
									</span>
									<span className="chat-attachment-name">
										{att.name}
									</span>
								</div>
							),
						)}
					</div>
				)}

			{/* Token count + metadata */}
			{(message.estimatedTokens !== undefined ||
				message.providerUsage ||
				message.modelName ||
				message.responseTimeMs) && (
				<div className="chat-message-metadata">
					{message.modelName && (
						<span className="chat-message-model">
							{message.modelName}
						</span>
					)}
					{message.responseTimeMs !== undefined && (
						<span className="chat-message-timing">
							{message.responseTimeMs}ms
						</span>
					)}
					{(message.estimatedTokens !== undefined ||
						message.providerUsage) && (
						<span className="chat-message-tokens">
							{message.providerUsage?.totalTokens ??
								`~${message.estimatedTokens ?? 0}`}{" "}
							tokens
						</span>
					)}
				</div>
			)}

			{/* Message actions — visible on hover OR when active */}
			{message.role === "assistant" && !message.isError && (
				<div
					className={`message-actions-wrapper${isActive ? " is-active" : ""}`}
				>
					<MessageActions
						onCopy={handleCopy}
						onRetry={onRetry}
						// Applying is only meaningful for explicit edit/create/append
						// commands. Ordinary assistant replies should retain the
						// standard Copy/Retry actions only.
						onApply={undefined}
						onInsertAtCursor={() =>
							onInsertAtCursor(message.content)
						}
						onAppend={
							!message.command
								? () => onAppend(message.content)
								: undefined
						}
						onApplyToTarget={
							message.command?.type === "edit"
								? () =>
										onApplyToTarget(
											message.content,
											message.command!.target,
										)
								: undefined
						}
						onCreateNote={
							message.command?.type === "create"
								? () =>
										onCreateNote(
											message.content,
											message.command!.target,
										)
								: undefined
						}
						onAppendToTarget={
							message.command?.type === "append"
								? () =>
										onAppendToTarget(
											message.content,
											message.command!.target,
										)
								: undefined
						}
						commandType={message.command?.type}
					/>
				</div>
			)}

			{/* User message actions */}
			{message.role === "user" && (
				<div
					className={`message-actions-wrapper${isActive ? " is-active" : ""}`}
				>
					<MessageActions
						isUser={true}
						onCopy={handleCopy}
						onEdit={onEdit}
					/>
				</div>
			)}
		</div>
	);
};

/** Legacy single-block markdown renderer */
function LegacyContent({
	content,
	app,
	renderMarkdown,
	messageId,
	contextItems,
}: {
	content: string;
	app: App;
	renderMarkdown: (
		markdown: string,
		target: HTMLElement,
		sourcePath?: string,
	) => Promise<void>;
	messageId: string;
	contextItems?: ContextItem[];
}): React.ReactElement {
	const contentRef = useRef<HTMLDivElement>(null);
	const [displayContent, setDisplayContent] = useState(content);

	useEffect(() => {
		setDisplayContent(content);
	}, [content]);

	useEffect(() => {
		if (!contentRef.current) return;
		const logger = (window as any).__obsidianAiLogger;
		let unmounted = false;

		try {
			contentRef.current.replaceChildren();
			renderMarkdown(
				sanitizeHtmlForRenderer(displayContent),
				contentRef.current,
				"",
			)
				.catch((err: any) => {
					if (unmounted || !contentRef.current) return;
					contentRef.current.replaceChildren();
					contentRef.current.createEl("pre", {
						text: displayContent,
						cls: "chat-plaintext-fallback",
					});
				})
				.then(() => {
					if (!unmounted && contentRef.current) {
						makeMarkdownTablesScrollable(contentRef.current);
						if (contextItems) {
							highlightMentions(contentRef.current, contextItems);
						}
						setupLinkInterception(contentRef.current, app);
					}
				});
		} catch (err: any) {
			if (!contentRef.current) return;
			contentRef.current.replaceChildren();
			contentRef.current.createEl("pre", {
				text: displayContent,
				cls: "chat-plaintext-fallback",
			});
		}

		return () => {
			unmounted = true;
		};
	}, [displayContent, app, renderMarkdown, contextItems]);

	return <div ref={contentRef} className="chat-bubble-content" />;
}

/** PDF attachment card with actions */
function PdfAttachmentCard({
	attachment,
	app,
}: {
	attachment: Attachment;
	app: App;
}): React.ReactElement {
	const [isSaving, setIsSaving] = useState(false);

	const handleSaveToVault = async () => {
		if (!attachment.data) {
			new Notice("No PDF data available to save");
			return;
		}
		setIsSaving(true);
		try {
			const folder = app.vault.getRoot();
			const filename = attachment.name || "downloaded.pdf";
			// Check if file already exists
			const existing = app.vault.getAbstractFileByPath(filename);
			const finalName = existing
				? `${filename.replace(/\.pdf$/i, "")}-${Date.now()}.pdf`
				: filename;
			const binaryString = atob(attachment.data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			await app.vault.createBinary(finalName, bytes.buffer);
			new Notice(`Saved PDF to ${finalName}`);
		} catch (err: any) {
			new Notice(`Failed to save PDF: ${err.message}`);
		} finally {
			setIsSaving(false);
		}
	};

	const handleOpenExternal = () => {
		if (attachment.path?.startsWith("http")) {
			window.open(attachment.path, "_blank");
		} else {
			new Notice("No external URL available");
		}
	};

	return (
		<div className="chat-attachment-card chat-attachment-card-pdf">
			<div className="chat-attachment-card-header">
				<span className="chat-attachment-icon">📑</span>
				<span className="chat-attachment-name">{attachment.name}</span>
			</div>
			<div className="chat-attachment-card-actions">
				<button
					className="chat-attachment-btn"
					onClick={handleSaveToVault}
					disabled={isSaving || !attachment.data}
					title="Save to vault"
				>
					{isSaving ? "Saving..." : "💾 Save"}
				</button>
				<button
					className="chat-attachment-btn"
					onClick={handleOpenExternal}
					disabled={!attachment.path?.startsWith("http")}
					title="Open in browser"
				>
					🔗 Open
				</button>
			</div>
		</div>
	);
}

export default MessageBubble;

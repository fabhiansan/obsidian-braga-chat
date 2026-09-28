import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import { App } from "obsidian";
import { ChatMessage, ContentPart } from "../types";
import { createRoot } from "react-dom/client";
import MessageBubble, { setupLinkInterception } from "./MessageBubble";
import ToolCallNotification from "./presentational/ToolCallNotification";
import { sanitizeHtmlForRenderer } from "../lib/sanitizeHtml";
import { makeMarkdownTablesScrollable } from "./scrollableMarkdownTables";

const StreamingBubble: React.FC<{
	content: string;
	contentParts?: ContentPart[];
	app: App;
	renderMarkdown: (
		markdown: string,
		target: HTMLElement,
		sourcePath?: string,
	) => Promise<void>;
	onOpenPastSession?: (sessionId: string, messageId: string) => void;
}> = ({ content, contentParts, app, renderMarkdown, onOpenPastSession }) => {
	const contentRef = useRef<HTMLDivElement>(null);
	const renderedCountRef = useRef(0);
	const lastTextRef = useRef("");
	const wasPartsModeRef = useRef(false);
	const toolRootsRef = useRef<Map<number, ReturnType<typeof createRoot>>>(
		new Map(),
	);

	useEffect(() => {
		if (!contentRef.current) return;
		const logger = (window as any).__obsidianAiLogger;
		let unmounted = false;

		try {
			const isPartsMode = Boolean(
				contentParts && contentParts.length > 0,
			);

			// If we just switched from text-only to parts mode, clear the DOM to avoid
			// duplication — the text-only path may have already rendered content directly
			// into contentRef.current, and the parts path appends without clearing.
			if (isPartsMode && !wasPartsModeRef.current && contentRef.current) {
				contentRef.current.empty();
				renderedCountRef.current = 0;
				lastTextRef.current = "";
				logger?.writeDirect?.(
					"debug",
					`[StreamingBubble] cleared DOM on text→parts transition`,
				);
			}
			wasPartsModeRef.current = isPartsMode;

			// If we have contentParts with tool calls, use incremental rendering to avoid flicker
			if (contentParts && contentParts.length > 0) {
				const currentCount = renderedCountRef.current;
				const newParts = contentParts.slice(currentCount);

				// Remove old remaining-text div before rendering new parts to avoid
				// duplication when prior remaining text becomes a formal text part.
				const oldRemainDiv = contentRef.current.querySelector(
					".chat-bubble-remain",
				);
				if (oldRemainDiv) oldRemainDiv.remove();

				// Update already-rendered tool calls when their results arrive (hourglass → checkmark)
				for (
					let i = 0;
					i < Math.min(currentCount, contentParts.length);
					i++
				) {
					const part = contentParts[i];
					if (part.type === "tool_call") {
						const root = toolRootsRef.current.get(i);
						if (root) {
							root.render(
								<ToolCallNotification
									toolCall={part.call}
									result={part.result}
									isPending={!part.result}
									onOpenPastSession={onOpenPastSession}
								/>,
							);
						}
					}
				}

				// Render only new parts (append mode)
				for (let i = 0; i < newParts.length; i++) {
					const part = newParts[i];
					const partIndex = currentCount + i;
					if (part.type === "text") {
						const textDiv = contentRef.current.createDiv({
							cls: "chat-bubble-text",
						});
						void renderMarkdown(
							sanitizeHtmlForRenderer(part.content),
							textDiv,
							"",
						).then(() => {
							if (!unmounted) {
								makeMarkdownTablesScrollable(textDiv);
								setupLinkInterception(textDiv, app);
							}
						});
					} else if (part.type === "tool_call") {
						const toolDiv = contentRef.current.createDiv({
							cls: "chat-bubble-tool",
						});
						const root = createRoot(toolDiv);
						toolRootsRef.current.set(partIndex, root);
						root.render(
							<ToolCallNotification
								toolCall={part.call}
								result={part.result}
								isPending={!part.result}
								onOpenPastSession={onOpenPastSession}
							/>,
						);
					}
				}
				renderedCountRef.current = contentParts.length;

				// Compute remaining text after all committed text parts.
				// Use prefix match instead of lastIndexOf to avoid wrong offsets when
				// the model repeats phrases.
				const committedTexts = contentParts
					.filter(
						(p): p is Extract<typeof p, { type: "text" }> =>
							p.type === "text",
					)
					.map((p) => p.content);
				const committedConcat = committedTexts.join("");
				let remainingText = "";
				if (content.startsWith(committedConcat)) {
					remainingText = content.slice(committedConcat.length);
				} else {
					// Fallback: committed text doesn't match prefix (can happen if
					// stripThinkingTags behaves differently on slices). Use first
					// occurrence of last text part.
					const lastTextPart = contentParts
						.filter((p) => p.type === "text")
						.pop();
					if (lastTextPart && lastTextPart.type === "text") {
						const idx = content.indexOf(lastTextPart.content);
						remainingText =
							idx >= 0
								? content.slice(
										idx + lastTextPart.content.length,
									)
								: content;
					}
				}
				if (remainingText.trim()) {
					let remainDiv = contentRef.current.querySelector(
						".chat-bubble-remain",
					) as HTMLDivElement | null;
					if (!remainDiv) {
						remainDiv = contentRef.current.createDiv({
							cls: "chat-bubble-remain",
						});
					} else {
						remainDiv.empty();
					}
					void renderMarkdown(
						sanitizeHtmlForRenderer(remainingText),
						remainDiv,
						"",
					).then(() => {
						if (!unmounted) {
							makeMarkdownTablesScrollable(remainDiv!);
							setupLinkInterception(remainDiv!, app);
						}
					});
				} else {
					const remainDiv = contentRef.current.querySelector(
						".chat-bubble-remain",
					);
					if (remainDiv) remainDiv.remove();
				}
			} else {
				// Simple text-only streaming (no tool calls) — only re-render if text changed
				if (content !== lastTextRef.current) {
					lastTextRef.current = content;
					contentRef.current.empty();
					renderMarkdown(
						sanitizeHtmlForRenderer(content),
						contentRef.current,
						"",
					)
						.then(() => {
							if (unmounted) return;
							if (contentRef.current) {
								makeMarkdownTablesScrollable(
									contentRef.current,
								);
								setupLinkInterception(contentRef.current, app);
							}
						})
						.catch((err: any) => {
							if (unmounted) return;
							logger?.writeDirect?.(
								"error",
								`[StreamingBubble] renderMarkdown rejected:`,
								err,
							);
							if (contentRef.current) {
								contentRef.current.empty();
								contentRef.current.createEl("pre", {
									text: content,
									cls: "chat-plaintext-fallback",
								});
							}
						});
				}
			}
		} catch (err: any) {
			logger?.writeDirect?.(
				"fatal",
				`[StreamingBubble] renderMarkdown threw synchronously:`,
				err,
			);
			if (contentRef.current) {
				contentRef.current.empty();
				contentRef.current.createEl("pre", {
					text: content,
					cls: "chat-plaintext-fallback",
				});
			}
		}

		return () => {
			unmounted = true;
		};
	}, [content, contentParts, renderMarkdown, onOpenPastSession]);

	// Cleanup tool roots on unmount
	useEffect(() => {
		return () => {
			toolRootsRef.current.forEach((root) => root.unmount());
			toolRootsRef.current.clear();
		};
	}, []);

	return (
		<div className="chat-bubble chat-bubble-assistant chat-bubble-streaming">
			<div className="chat-bubble-header">
				<span className="chat-bubble-role">Obsidian AI</span>
				<span
					className="chat-streaming-indicator"
					title="Generating response..."
				>
					<span className="chat-streaming-dot" />
					<span className="chat-streaming-label">Generating</span>
				</span>
			</div>
			<div ref={contentRef} className="chat-bubble-content" />
		</div>
	);
};

interface ChatMessagesProps {
	sessionId: string | null;
	restoreScrollTop?: number;
	onScrollPositionChange?: (sessionId: string, scrollTop: number) => void;
	messages: ChatMessage[];
	currentAiMessage: string;
	currentContentParts?: ContentPart[];
	isStreaming: boolean;
	isEditing: boolean;
	app: App;
	renderMarkdown: (
		markdown: string,
		target: HTMLElement,
		sourcePath?: string,
	) => Promise<void>;
	onAppend: (content: string) => void;
	onInsertAtCursor: (content: string) => void;
	onApply: (content: string) => void;
	onRetry: (messageId: string) => void;
	onEdit: (messageId: string) => void;
	onApplyToTarget: (content: string, target: string) => void;
	onCreateNote: (content: string, target: string) => void;
	onAppendToTarget: (content: string, target: string) => void;
	showThinking?: boolean;
	onOpenPastSession?: (sessionId: string, messageId: string) => void;
	scrollToMessageId?: string;
	typingUsers?: string[];
	selectionMode?: boolean;
	selectedMessageIds?: Set<string>;
	onLongPress?: (messageId: string) => void;
	onToggleSelection?: (messageId: string) => void;
}

interface MessageRowProps {
	msg: ChatMessage;
	app: App;
	renderMarkdown: ChatMessagesProps["renderMarkdown"];
	showThinking?: boolean;
	onOpenPastSession?: (sessionId: string, messageId: string) => void;
	onAppend: (content: string) => void;
	onInsertAtCursor: (content: string) => void;
	onApply: (content: string) => void;
	onRetry: (messageId: string) => void;
	onEdit: (messageId: string) => void;
	onApplyToTarget: (content: string, target: string) => void;
	onCreateNote: (content: string, target: string) => void;
	onAppendToTarget: (content: string, target: string) => void;
	selectionMode?: boolean;
	selected?: boolean;
	onLongPress?: (messageId: string) => void;
	onToggleSelection?: (messageId: string) => void;
}

/**
 * Memoized per-message row. The parent re-renders on every scroll-position and
 * streaming state change; without memo, every bubble in the session
 * reconciles each time, which is the main source of scroll jank in long chats.
 * The per-message arrow closures are built here so they only change when the
 * message itself changes.
 */
/** Transition-only debug logging; no-ops unless the file logger is at debug level. */
const debugLog = (...args: unknown[]) => {
	(window as any).__obsidianAiLogger?.log?.("debug", ...args);
};

const MessageRow: React.FC<MessageRowProps> = memo(
	({ msg, onRetry, onEdit, selected, ...rest }) => (
		<div data-message-id={msg.id}>
			<MessageBubble
				{...rest}
				message={msg}
				selected={selected}
				onRetry={() => onRetry(msg.id)}
				onEdit={() => onEdit(msg.id)}
			/>
		</div>
	),
);

const ChatMessages: React.FC<ChatMessagesProps> = ({
	sessionId,
	restoreScrollTop,
	onScrollPositionChange,
	messages,
	currentAiMessage,
	currentContentParts,
	isStreaming,
	isEditing,
	app,
	renderMarkdown,
	onAppend,
	onInsertAtCursor,
	onApply,
	onRetry,
	onEdit,
	onApplyToTarget,
	onCreateNote,
	onAppendToTarget,
	showThinking,
	onOpenPastSession,
	scrollToMessageId,
	typingUsers,
	selectionMode,
	selectedMessageIds,
	onLongPress,
	onToggleSelection,
}) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const [showScrollTop, setShowScrollTop] = useState(false);
	const [showScrollBottom, setShowScrollBottom] = useState(false);
	/** Auto-follow mode: true while the view should track new content. Engages
		on send and when the user is at the bottom; disengages when the user
		scrolls away, re-engages when they return to the bottom. */
	const followRef = useRef(true);
	const prevMessagesLength = useRef(messages.length);
	const hasMessages = messages.length > 0;
	/** Saved scroll position deferred from a session switch that landed on an
		index-only session (DOM still empty, so the browser clamped the restore
		to 0). The restore effect re-applies it once hydration fills the
		transcript; the follow effect must leave that fill growth alone. */
	const pendingHydrationRestoreRef = useRef<number | null>(null);

	/** Jump the container to the very bottom without touching outer panes. */
	const scrollToBottomInstant = useCallback(() => {
		const container = scrollRef.current;
		if (!container) return;
		container.scrollTop = container.scrollHeight;
	}, []);

	/** Check scroll position, sync follow mode, and update button visibility */
	const checkScrollPosition = useCallback(() => {
		const container = scrollRef.current;
		if (!container) return;
		const threshold = 80;
		const distanceFromBottom =
			container.scrollHeight -
			container.scrollTop -
			container.clientHeight;
		const atBottom = distanceFromBottom < threshold;
		if (atBottom !== followRef.current) {
			debugLog(
				`[ChatScroll] follow ${atBottom ? "engaged (near bottom)" : "released (scrolled away)"} — ${Math.round(distanceFromBottom)}px from bottom`,
			);
		}
		followRef.current = atBottom;
		setShowScrollBottom(!atBottom && messages.length > 0);
		setShowScrollTop(container.scrollTop > 200);
	}, [messages.length]);

	/** Latest checkScrollPosition, so effects can invoke it without depending
		on its identity — it changes with messages.length, which would
		otherwise re-run them on every new message. */
	const checkScrollPositionRef = useRef(checkScrollPosition);
	useEffect(() => {
		checkScrollPositionRef.current = checkScrollPosition;
	});

	/** Attach scroll listener */
	useEffect(() => {
		const container = scrollRef.current;
		if (!container) return;
		const onScroll = () => {
			checkScrollPosition();
			if (sessionId)
				onScrollPositionChange?.(sessionId, container.scrollTop);
		};
		container.addEventListener("scroll", onScroll, { passive: true });
		checkScrollPosition();
		return () => container.removeEventListener("scroll", onScroll);
	}, [checkScrollPosition, onScrollPositionChange, sessionId]);

	/** Restore the active tab's saved position after its message DOM has
		rendered. Runs on session switch / restore-value change, and once more
		when an index-only session's first messages render — but NOT on ongoing
		message growth, so a stale saved position can never fight the follow
		scroll on send. */
	useEffect(() => {
		const container = scrollRef.current;
		if (!container || !sessionId) return;
		const frame = requestAnimationFrame(() => {
			const top = Math.max(0, restoreScrollTop ?? 0);
			if (!hasMessages && top > 0) {
				// Index-only session mid-hydration: the DOM has no content yet
				// and the browser clamps scrollTop to 0. Remember the target;
				// the hasMessages dependency re-runs this effect exactly once
				// when the transcript lands.
				pendingHydrationRestoreRef.current = top;
				return;
			}
			pendingHydrationRestoreRef.current = null;
			container.scrollTop = top;
			debugLog(
				`[ChatScroll] restored saved position ${Math.round(container.scrollTop)}px for session ${sessionId}`,
			);
			checkScrollPositionRef.current();
		});
		return () => cancelAnimationFrame(frame);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- checkScrollPosition is read via ref; hasMessages gates the one-shot index-only re-run.
	}, [sessionId, restoreScrollTop, hasMessages]);

	/** Follow new content to the bottom: always on local send, otherwise only
		while follow mode is engaged (user is at / returned to the bottom). */
	useEffect(() => {
		const grew = messages.length > prevMessagesLength.current;
		// Index-only hydration fill: the restore effect owns positioning for
		// this growth — following it would yank the user to the bottom.
		if (grew && pendingHydrationRestoreRef.current != null) {
			pendingHydrationRestoreRef.current = null;
			prevMessagesLength.current = messages.length;
			requestAnimationFrame(checkScrollPosition);
			return;
		}
		const lastIsUser =
			messages.length > 0 &&
			messages[messages.length - 1]?.role === "user";
		if (grew && lastIsUser) {
			// Local send: bring the new message and its reply into view even if
			// the user was reading history above.
			if (!followRef.current) {
				debugLog(
					`[ChatScroll] new user message while scrolled up — follow forced on, jumping to bottom`,
				);
			}
			followRef.current = true;
		}
		if ((grew || isStreaming) && followRef.current) {
			if (grew) {
				debugLog(
					`[ChatScroll] following new message to bottom (streaming: ${Boolean(isStreaming)})`,
				);
			}
			scrollToBottomInstant();
		}
		prevMessagesLength.current = messages.length;
		// Update button visibility after render
		requestAnimationFrame(checkScrollPosition);
	}, [
		messages,
		isStreaming,
		currentAiMessage,
		checkScrollPosition,
		scrollToBottomInstant,
	]);

	/** Scroll to bottom on mount when there are messages and no saved position to restore. */
	useEffect(() => {
		if (messages.length > 0 && restoreScrollTop == null) {
			scrollToBottomInstant();
		}
		followRef.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only scroll positioning intentionally ignores changing message dependencies.
	}, []);

	useEffect(() => {
		if (!scrollToMessageId) return;
		const target = scrollRef.current?.querySelector<HTMLElement>(
			`[data-message-id="${scrollToMessageId}"]`,
		);
		if (!target) return;
		target.scrollIntoView({ behavior: "smooth", block: "center" });
		target.classList.add("chat-message-highlight");
		const timer = window.setTimeout(
			() => target.classList.remove("chat-message-highlight"),
			2000,
		);
		return () => window.clearTimeout(timer);
	}, [scrollToMessageId, messages]);

	const scrollToTop = useCallback(() => {
		scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	const scrollToBottom = useCallback(() => {
		debugLog(
			"[ChatScroll] ↓ button — follow engaged, smooth scroll to bottom",
		);
		followRef.current = true;
		const container = scrollRef.current;
		if (container) {
			container.scrollTo({
				top: container.scrollHeight,
				behavior: "smooth",
			});
		}
		setShowScrollBottom(false);
	}, []);

	return (
		<div
			className="chat-messages-scroll-wrapper"
			data-testid="chat-transcript"
		>
			<div className="chat-messages" ref={scrollRef}>
				{messages.length === 0 && (
					<div className="chat-empty-state">
						Ask anything about your vault...
					</div>
				)}
				{messages.map((msg) => (
					<MessageRow
						key={msg.id}
						msg={msg}
						app={app}
						renderMarkdown={renderMarkdown}
						showThinking={showThinking}
						onOpenPastSession={onOpenPastSession}
						onAppend={onAppend}
						onInsertAtCursor={onInsertAtCursor}
						onApply={onApply}
						onRetry={onRetry}
						onEdit={onEdit}
						onApplyToTarget={onApplyToTarget}
						onCreateNote={onCreateNote}
						onAppendToTarget={onAppendToTarget}
						selectionMode={selectionMode}
						selected={selectedMessageIds?.has(msg.id)}
						onLongPress={onLongPress}
						onToggleSelection={onToggleSelection}
					/>
				))}
				{isStreaming && currentAiMessage && (
					<StreamingBubble
						content={currentAiMessage}
						contentParts={currentContentParts}
						app={app}
						renderMarkdown={renderMarkdown}
						onOpenPastSession={onOpenPastSession}
					/>
				)}
				{isStreaming && !currentAiMessage && (
					<div className="chat-typing-indicator">
						<span />
						<span />
						<span />
					</div>
				)}
				{typingUsers && typingUsers.length > 0 && (
					<div className="chat-typing-indicator-remote">
						<span className="chat-typing-indicator-remote-label">
							{typingUsers.join(", ")}{" "}
							{typingUsers.length === 1 ? "is" : "are"} typing…
						</span>
						<span className="chat-typing-dot" />
						<span className="chat-typing-dot" />
						<span className="chat-typing-dot" />
					</div>
				)}
				<div ref={bottomRef} />
			</div>
			{showScrollTop && (
				<button
					className="chat-scroll-btn chat-scroll-top"
					onClick={scrollToTop}
					title="Scroll to top"
				>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<polyline points="18 15 12 9 6 15" />
					</svg>
				</button>
			)}
			{showScrollBottom && (
				<button
					className="chat-scroll-btn chat-scroll-bottom"
					onClick={scrollToBottom}
					title="Scroll to bottom"
				>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>
			)}
		</div>
	);
};

export default ChatMessages;

/**
 * Braga fork: folds a run of consecutive tool calls into one collapsible row
 * ("Used 9 tools · read note ×5, search notes, …") so long agent turns don't
 * push the answer off screen. Each call keeps its own expandable row inside.
 */
import React, { useState } from "react";
import type { ToolCall, ToolResult } from "../../agent/types";
import ObsidianIcon from "../ObsidianIcon";

interface ToolCallGroupProps {
	calls: Array<{ call: ToolCall; result?: ToolResult }>;
	children: React.ReactNode;
}

function summarize(calls: ToolCallGroupProps["calls"]): string {
	const counts = new Map<string, number>();
	for (const { call } of calls) {
		const label = call.toolName.replace(/[_.]/g, " ");
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	return Array.from(counts, ([label, n]) =>
		n > 1 ? `${label} ×${n}` : label,
	).join(", ");
}

export const ToolCallGroup: React.FC<ToolCallGroupProps> = ({
	calls,
	children,
}) => {
	const pending = calls.some((c) => !c.result);
	const failed = calls.filter((c) => c.result?.error).length;
	const [expanded, setExpanded] = useState(pending);

	return (
		<div
			className={`braga-tool-group${expanded ? " is-expanded" : ""}${failed ? " has-error" : ""}`}
		>
			<button
				type="button"
				className="braga-tool-group-header"
				onClick={() => setExpanded((v) => !v)}
				aria-expanded={expanded}
			>
				<ObsidianIcon
					icon={pending ? "loader" : failed ? "alert-circle" : "wrench"}
					size={13}
					className="braga-tool-group-icon"
				/>
				<span className="braga-tool-group-title">
					Used {calls.length} tools
					{failed ? ` · ${failed} failed` : ""}
				</span>
				<span className="braga-tool-group-summary">
					{summarize(calls)}
				</span>
				<ObsidianIcon
					icon="chevron-right"
					size={13}
					className="braga-tool-group-chevron"
				/>
			</button>
			{expanded && <div className="braga-tool-group-body">{children}</div>}
		</div>
	);
};

export default ToolCallGroup;

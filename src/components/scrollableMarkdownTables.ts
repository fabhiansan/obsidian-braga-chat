/** Give rendered markdown tables their own touch- and keyboard-scroll region. */
export function makeMarkdownTablesScrollable(container: HTMLElement): void {
	for (const table of Array.from(container.querySelectorAll("table"))) {
		const existingWrapper = table.parentElement;
		if (existingWrapper?.classList.contains("chat-markdown-table-scroll")) {
			continue;
		}

		const wrapper = container.ownerDocument.createElement("div");
		wrapper.className = "chat-markdown-table-scroll";
		wrapper.tabIndex = 0;
		wrapper.setAttribute("role", "region");
		wrapper.setAttribute(
			"aria-label",
			"Scrollable table. Use horizontal scrolling to see all columns.",
		);
		table.replaceWith(wrapper);
		wrapper.append(table);
	}
}

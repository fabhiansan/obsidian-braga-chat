import { describe, expect, it, vi } from "vitest";
import { setupLinkInterception } from "../MessageBubble";
import type { App } from "obsidian";

function makeApp(openLinkText = vi.fn().mockResolvedValue(undefined)): App {
	return {
		workspace: { openLinkText },
	} as unknown as App;
}

describe("setupLinkInterception", () => {
	it("preserves Obsidian-rendered anchor nodes", () => {
		const container = document.createElement("div");
		container.innerHTML =
			'<p><a class="internal-link" data-href="Notes/Test">Test</a></p>';
		const anchor = container.querySelector("a");

		setupLinkInterception(container, makeApp());

		expect(container.querySelector("a")).toBe(anchor);
	});

	it("intercepts internal links in capture phase", async () => {
		const openLinkText = vi.fn().mockResolvedValue(undefined);
		const container = document.createElement("div");
		container.innerHTML =
			'<p><a class="internal-link" data-href="Notes/Test"><span>Test</span></a></p>';
		const anchor = container.querySelector("a")!;
		const obsidianTargetHandler = vi.fn();
		anchor.addEventListener("click", obsidianTargetHandler);
		setupLinkInterception(container, makeApp(openLinkText));

		const click = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
		});
		container.querySelector("span")!.dispatchEvent(click);
		await Promise.resolve();

		expect(click.defaultPrevented).toBe(true);
		expect(obsidianTargetHandler).not.toHaveBeenCalled();
		expect(openLinkText).toHaveBeenCalledTimes(1);
		expect(openLinkText).toHaveBeenCalledWith("Notes/Test", "", false);
	});

	it("does not install duplicate container handlers", async () => {
		const openLinkText = vi.fn().mockResolvedValue(undefined);
		const app = makeApp(openLinkText);
		const container = document.createElement("div");
		container.innerHTML =
			'<a class="internal-link" data-href="Notes/Test">Test</a>';

		setupLinkInterception(container, app);
		setupLinkInterception(container, app);
		container
			.querySelector("a")!
			.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		await Promise.resolve();

		expect(openLinkText).toHaveBeenCalledTimes(1);
	});
});

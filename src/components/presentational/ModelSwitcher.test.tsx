import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModelSwitcher from "./ModelSwitcher";
import type { ProviderProfile } from "../../settings";

const makeProfile = (
	overrides: Partial<ProviderProfile> = {},
): ProviderProfile => ({
	id: "profile-1",
	name: "OpenAI",
	provider: "openrouter",
	model: "openai/gpt-oss-120b",
	modelCache: {
		models: ["openai/gpt-oss-120b", "gpt-4o", "z-ai/glm-5.3-flash"],
		fetchedAt: 1,
	},
	createdAt: 0,
	updatedAt: 0,
	...overrides,
});

const makePlugin = (profiles: ProviderProfile[], recentModels = {}) => ({
	app: {},
	manifest: { id: "chat-lab" },
	settings: {
		providerProfiles: profiles,
		recentModels,
	},
	chatapi: { updateSettings: vi.fn() },
	saveSettings: vi.fn().mockResolvedValue(undefined),
});

describe("ModelSwitcher", () => {
	it("keeps the toolbar trigger compact and separates recent models from all models", () => {
		const profile = makeProfile();
		const plugin = makePlugin([profile], {
			openrouter: ["z-ai/glm-5.3-flash"],
		});

		render(
			<ModelSwitcher
				profile={profile}
				plugin={plugin as any}
				selectedProfileIds={new Set([profile.id])}
			/>,
		);

		const trigger = screen.getByTestId("model-switcher-trigger");
		expect(trigger.textContent).toContain("openrouter");
		expect(trigger.textContent).toContain("openai/gpt-oss-120b");
		expect(trigger.getAttribute("aria-label")).toContain("Change model");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(trigger);
		expect(screen.getByPlaceholderText("Search models...")).toBeTruthy();
		expect(screen.getByText("Recently used")).toBeTruthy();
		expect(screen.getByText("All models")).toBeTruthy();
		expect(screen.getAllByText("z-ai/glm-5.3-flash")).toHaveLength(1);
		expect(
			screen
				.getByText("Recently used")
				.closest(".chat-model-switcher-dropdown")?.parentElement,
		).toBe(document.body);
	});

	it("updates the trigger immediately and persists a selected model", async () => {
		const profile = makeProfile();
		const plugin = makePlugin([profile]);

		render(
			<ModelSwitcher
				profile={profile}
				plugin={plugin as any}
				selectedProfileIds={new Set([profile.id])}
			/>,
		);

		fireEvent.click(screen.getByTestId("model-switcher-trigger"));
		fireEvent.click(screen.getByRole("menuitem", { name: "gpt-4o" }));

		await waitFor(() => {
			expect(plugin.saveSettings).toHaveBeenCalledOnce();
			expect(plugin.settings.providerProfiles[0].model).toBe("gpt-4o");
		});
		expect(
			screen.getByTestId("model-switcher-trigger").textContent,
		).toContain("gpt-4o");
	});

	it("keeps model caches isolated for profiles using the same provider", () => {
		const first = makeProfile({
			id: "profile-1",
			name: "First",
			model: "first-model",
			modelCache: { models: ["first-model"], fetchedAt: 1 },
		});
		const second = makeProfile({
			id: "profile-2",
			name: "Second",
			model: "second-model",
			modelCache: { models: ["second-model"], fetchedAt: 1 },
		});
		const plugin = makePlugin([first, second]);

		render(
			<ModelSwitcher
				profile={first}
				plugin={plugin as any}
				selectedProfileIds={new Set([first.id, second.id])}
			/>,
		);

		fireEvent.click(screen.getByTestId("model-switcher-trigger"));
		fireEvent.click(screen.getByRole("menuitem", { name: /Second/ }));

		expect(screen.getByText("second-model")).toBeTruthy();
		expect(screen.queryByText("first-model")).toBeNull();
	});

	it("shows the same provider recents for profiles with different credentials", () => {
		const first = makeProfile({
			id: "profile-1",
			name: "First",
			model: "first-model",
			modelCache: { models: ["first-model"], fetchedAt: 1 },
		});
		const second = makeProfile({
			id: "profile-2",
			name: "Second",
			model: "second-model",
			modelCache: { models: ["second-model"], fetchedAt: 1 },
		});
		const plugin = makePlugin([first, second], {
			openrouter: ["shared-recent-model"],
		});

		const { unmount } = render(
			<ModelSwitcher
				profile={first}
				plugin={plugin as any}
				selectedProfileIds={new Set([first.id])}
			/>,
		);
		fireEvent.click(screen.getByTestId("model-switcher-trigger"));
		expect(screen.getByText("shared-recent-model")).toBeTruthy();
		unmount();

		render(
			<ModelSwitcher
				profile={second}
				plugin={plugin as any}
				selectedProfileIds={new Set([second.id])}
			/>,
		);
		fireEvent.click(screen.getByTestId("model-switcher-trigger"));
		expect(screen.getByText("shared-recent-model")).toBeTruthy();
	});

	it("delegates model changes to the active chat tab", async () => {
		const profile = makeProfile();
		const plugin = makePlugin([profile]);
		const onModelChange = vi.fn().mockResolvedValue(undefined);

		render(
			<ModelSwitcher
				profile={profile}
				plugin={plugin as any}
				selectedProfileIds={new Set([profile.id])}
				onModelChange={onModelChange}
			/>,
		);

		fireEvent.click(screen.getByTestId("model-switcher-trigger"));
		fireEvent.click(screen.getByRole("menuitem", { name: "gpt-4o" }));

		await waitFor(() => {
			expect(onModelChange).toHaveBeenCalledWith(profile.id, "gpt-4o");
		});
		expect(plugin.settings.providerProfiles[0].model).toBe(
			"openai/gpt-oss-120b",
		);
	});

	it("uses the parent-resolved historical model for the active tab", () => {
		const profile = makeProfile({ model: "profile-default" });
		const plugin = makePlugin([profile]);

		render(
			<ModelSwitcher
				profile={{ ...profile, model: "historical-model" }}
				resolvedProfiles={[{ ...profile, model: "historical-model" }]}
				plugin={plugin as any}
				selectedProfileIds={new Set([profile.id])}
			/>,
		);

		fireEvent.click(screen.getByTestId("model-switcher-trigger"));
		expect(
			screen.getByRole("menuitem", { name: "historical-model" }),
		).toBeTruthy();
	});
});

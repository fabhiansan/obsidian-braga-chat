import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActionBar from "../presentational/ActionBar";

const profile = {
	id: "profile-1",
	name: "OpenAI",
	provider: "openai" as const,
	model: "gpt-4o",
	createdAt: 0,
	updatedAt: 0,
};

const baseProps = {
	onNewChat: vi.fn(),
	onLoadChat: vi.fn(),
	onExportChat: vi.fn(),
	onOpenSync: vi.fn(),
	canLoad: true,
	plugin: {
		app: {},
		manifest: { id: "chat-lab" },
		settings: {
			providerProfiles: [profile],
			recentModels: {},
		},
		chatapi: { updateSettings: vi.fn() },
		saveSettings: vi.fn(),
	} as any,
	autoApprove: false,
	onToggleAutoApprove: vi.fn(),
	autoNameSessions: false,
	onToggleAutoName: vi.fn(),
	onManualRename: vi.fn(),
	profile,
	selectedProfileIds: new Set<string>(),
	onToggleParticipantDropdown: vi.fn(),
	onToggleRemoteUserDropdown: vi.fn(),
	onToggleRelay: vi.fn(),
	onToggleSearch: vi.fn(),
	onToggleZenMode: vi.fn(),
	zenMode: false,
	searchVisible: false,
};

describe("ActionBar participant badges", () => {
	it("orders the model selector before Agents and keeps primary actions visible", () => {
		const { container } = render(
			<ActionBar {...baseProps} participantCount={1} />,
		);
		const controls = Array.from(
			container.querySelector(".chat-action-bar-left")!.children,
		);

		expect((controls[0] as HTMLButtonElement).title).toBe("New chat");
		expect((controls[1] as HTMLButtonElement).title).toBe(
			"Load previous session",
		);
		expect((controls[2] as HTMLButtonElement).title).toBe("Search chats");
		expect(controls[3].classList.contains("chat-model-switcher")).toBe(
			true,
		);
		expect(controls[4].classList.contains("chat-council-trigger")).toBe(
			true,
		);
		expect(
			(controls[5] as HTMLButtonElement).getAttribute("aria-label"),
		).toBe("Sync with remote");
		expect(
			(controls[6] as HTMLButtonElement).getAttribute("aria-label"),
		).toBe("Zen mode");
		expect(
			(controls[7] as HTMLButtonElement).getAttribute("aria-label"),
		).toBe("Settings");
		expect(
			(controls[8] as HTMLButtonElement).getAttribute("aria-label"),
		).toBe("More actions");
		expect(container.querySelector(".chat-action-bar-center")).toBeNull();
		fireEvent.click(controls[8]);
	});

	it("routes Sync and Zen mode from their toolbar buttons", () => {
		const { getByRole } = render(<ActionBar {...baseProps} />);

		fireEvent.click(getByRole("button", { name: "Sync with remote" }));
		fireEvent.click(getByRole("button", { name: "Zen mode" }));

		expect(baseProps.onOpenSync).toHaveBeenCalledOnce();
		expect(baseProps.onToggleZenMode).toHaveBeenCalledOnce();
	});

	it.each([0, 1, 2])(
		"shows %i selected agents in the agent badge",
		(participantCount) => {
			const { container } = render(
				<ActionBar
					{...baseProps}
					participantCount={participantCount}
				/>,
			);

			expect(
				container.querySelector(".chat-council-badge")?.textContent,
			).toBe(String(participantCount));
		},
	);

	it("routes room controls through More without affecting the agent count", () => {
		const { container } = render(
			<ActionBar
				{...baseProps}
				participantCount={1}
				remoteUserCount={2}
			/>,
		);

		expect(
			container.querySelector(".chat-council-badge")?.textContent,
		).toBe("1");
		expect(container.querySelector(".chat-remote-users-badge")).toBeNull();
		expect(
			container.querySelector('[aria-label="More actions"]'),
		).not.toBeNull();
	});
});

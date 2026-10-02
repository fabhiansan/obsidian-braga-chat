import { describe, expect, it } from "vitest";
import { createProviderProfile } from "../settings";
import {
	agentHandle,
	mentionedHandles,
	profileForRemoteMessage,
	routeOwnMessage,
} from "./relayAgents";

const claude = createProviderProfile({
	provider: "claude-code",
	name: "Claude Fabhian",
});
const codex = createProviderProfile({ provider: "codex", name: "codex-fabhian" });
const profiles = [claude, codex];

describe("relay agent routing", () => {
	it("derives handles from profile names", () => {
		expect(agentHandle(" Claude Fabhian ")).toBe("claude-fabhian");
		expect(agentHandle("Codex (Budi)")).toBe("codex-budi");
	});

	it("ignores e-mail addresses", () => {
		expect(mentionedHandles("mail a@b.com @Claude-Fabhian")).toEqual([
			"claude-fabhian",
		]);
	});

	it("routes my own messages", () => {
		expect(routeOwnMessage("halo", profiles)).toEqual({ kind: "default" });
		expect(routeOwnMessage("@codex-fabhian cek ini", profiles)).toEqual({
			kind: "answer",
			profile: codex,
		});
		expect(routeOwnMessage("@claude-budi tolong", profiles)).toEqual({
			kind: "skip",
		});
	});

	it("answers remote messages only when one of my handles is mentioned", () => {
		expect(profileForRemoteMessage("halo semua", profiles)).toBeUndefined();
		expect(profileForRemoteMessage("@claude-budi", profiles)).toBeUndefined();
		expect(profileForRemoteMessage("@claude-fabhian ringkas", profiles)).toBe(
			claude,
		);
	});
});

/**
 * Braga fork: who answers in a shared relay room.
 *
 * Every member runs their own agents on their own laptop and subscription.
 * An agent is addressed by its handle — the profile name, lowercased with
 * spaces as dashes (profile "Claude Fabhian" → @claude-fabhian). Rules:
 * - A message that mentions one of my handles is answered by that profile,
 *   whoever sent it.
 * - My own message that mentions only other handles is posted without a
 *   local answer; the owner of that handle answers it.
 * - My own message without mentions is answered by my active profile, as in
 *   upstream Chat Lab. Other members' messages without mentions are not
 *   answered automatically.
 * Handles must be unique in the room, so name profiles after their owner.
 */
import type { ProviderProfile } from "../settings";

// "@" at the start or after whitespace, so e-mail addresses don't match.
const MENTION = /(^|\s)@([a-zA-Z0-9_-]+)/g;

export function agentHandle(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9_-]/g, "");
}

export function mentionedHandles(text: string): string[] {
	return Array.from(text.matchAll(MENTION), (m) => m[2].toLowerCase());
}

export type RelayRoute =
	| { kind: "default" }
	| { kind: "answer"; profile: ProviderProfile }
	| { kind: "skip" };

/** Routing for a message I typed while the room is connected. */
export function routeOwnMessage(
	text: string,
	profiles: ProviderProfile[],
): RelayRoute {
	const handles = mentionedHandles(text);
	if (handles.length === 0) return { kind: "default" };
	const profile = findProfile(handles, profiles);
	return profile ? { kind: "answer", profile } : { kind: "skip" };
}

/** The local profile a remote member addressed, if any. */
export function profileForRemoteMessage(
	text: string,
	profiles: ProviderProfile[],
): ProviderProfile | undefined {
	return findProfile(mentionedHandles(text), profiles);
}

function findProfile(
	handles: string[],
	profiles: ProviderProfile[],
): ProviderProfile | undefined {
	for (const handle of handles) {
		const profile = profiles.find((p) => agentHandle(p.name) === handle);
		if (profile) return profile;
	}
	return undefined;
}

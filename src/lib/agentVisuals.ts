/** Get a consistent color for a provider type */
export function getAgentColor(provider: string): string {
	switch (provider) {
		case "gemini":
			return "#6366f1";
		case "openai":
			return "#10b981";
		case "anthropic":
			return "#f43f5e";
		case "agent":
			return "#06b6d4";
		case "claude-code":
			return "#d97757";
		case "codex":
			return "#10a37f";
		case "opencode":
			return "#525252";
		default:
			return "#8b5cf6";
	}
}

/** Get a consistent icon for a provider type */
export function getAgentIcon(provider: string): string {
	switch (provider) {
		case "gemini":
			return "💎";
		case "openai":
			return "🌐";
		case "anthropic":
			return "🧠";
		case "agent":
			return "☁️";
		case "claude-code":
		case "codex":
		case "opencode":
			return "💻";
		default:
			return "🤖";
	}
}

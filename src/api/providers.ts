import { Notice, requestUrl } from "obsidian";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getDefaultEndpoint, ProviderProfile } from "../settings";
import type { ProviderTokenUsage } from "../types";
import {
	CliAgentLanguageModel,
	CLI_DEFAULT_MODEL,
} from "./cliAgents/CliAgentLanguageModel";

export function normalizeProviderUsage(usage: {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	inputTokenDetails?: { cacheReadTokens?: number };
	outputTokenDetails?: { reasoningTokens?: number };
}): ProviderTokenUsage {
	return {
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		totalTokens: usage.totalTokens,
		cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
		reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
	};
}

/**
 * Maps a provider type to its required credential fields.
 * Returns an error message string if validation fails, or null if valid.
 */
export function validateProfile(profile: ProviderProfile): string | null {
	switch (profile.provider) {
		case "openai":
			return profile.apiKey ? null : "OpenAI API key is required.";
		case "anthropic":
			return profile.apiKey ? null : "Anthropic API key is required.";
		case "deepseek":
			return profile.apiKey ? null : "DeepSeek API key is required.";
		case "kimi":
			return profile.apiKey ? null : "Kimi API key is required.";
		case "gemini":
			return profile.apiKey ? null : "Gemini API key is required.";
		case "openrouter":
			return profile.apiKey ? null : "OpenRouter API key is required.";
		case "azure":
			if (!profile.apiKey || !profile.azureEndpoint) {
				return "API key and Azure endpoint are required.";
			}
			return null;
		case "custom":
			if (!profile.apiKey || !profile.customURL) {
				return "API key and custom base URL are required.";
			}
			return null;
		case "ollama":
		case "claude-code":
		case "codex":
		case "opencode":
			return null;
		default:
			return `Unsupported provider: ${profile.provider}`;
	}
}

export function getThinkingProviderOptions(
	profile: ProviderProfile,
	thinkingEnabled?: boolean,
): Record<string, any> | undefined {
	if (!thinkingEnabled) return undefined;
	switch (profile.provider) {
		case "deepseek":
			return { deepseek: { reasoningEffort: "medium" } };
		case "openai":
			// Only reasoning models (o1, o3, etc.) support reasoningEffort
			if (profile.model?.startsWith("o")) {
				return { openai: { reasoningEffort: "medium" } };
			}
			return undefined;
		case "anthropic":
			// Claude 3.7 Sonnet supports extended thinking via providerOptions
			if (profile.model?.includes("claude-3-7")) {
				return {
					anthropic: {
						thinking: { type: "enabled", budgetTokens: 12000 },
					},
				};
			}
			return undefined;
		default:
			return undefined;
	}
}

/**
 * Creates a Vercel AI SDK language model from a provider profile.
 */
export function createLanguageModel(
	profile: ProviderProfile,
): LanguageModelV4 | null {
	const error = validateProfile(profile);
	if (error) {
		new Notice(`⚠️ ${error} Please check your settings.`);
		return null;
	}

	try {
		switch (profile.provider) {
			case "openai": {
				const provider = createOpenAI({
					apiKey: profile.apiKey,
					baseURL:
						profile.customURL?.trim() ||
						getDefaultEndpoint("openai"),
				});
				return provider.chat(profile.model);
			}

			case "anthropic": {
				const provider = createAnthropic({
					apiKey: profile.apiKey,
					baseURL:
						profile.customURL?.trim() ||
						getDefaultEndpoint("anthropic"),
				});
				return provider.chat(profile.model);
			}

			case "gemini": {
				const provider = createGoogleGenerativeAI({
					apiKey: profile.apiKey,
					baseURL:
						profile.customURL?.trim() ||
						getDefaultEndpoint("gemini"),
				});
				return provider(profile.model);
			}

			case "deepseek": {
				const provider = createDeepSeek({
					apiKey: profile.apiKey,
					baseURL:
						profile.customURL?.trim() ||
						getDefaultEndpoint("deepseek"),
				});
				return provider.chat(profile.model);
			}

			case "ollama": {
				const provider = createOpenAI({
					baseURL:
						profile.customURL?.trim() ||
						getDefaultEndpoint("ollama"),
				});
				return provider.chat(profile.model);
			}

			case "openrouter": {
				const provider = createOpenRouter({
					apiKey: profile.apiKey,
					baseURL:
						profile.customURL?.trim() ||
						getDefaultEndpoint("openrouter"),
				});
				return provider.chat(profile.model);
			}

			case "kimi": {
				const provider = createOpenAI({
					apiKey: profile.apiKey,
					baseURL:
						profile.customURL?.trim() || getDefaultEndpoint("kimi"),
				});
				return provider.chat(profile.model);
			}

			case "custom": {
				const provider = createOpenAI({
					apiKey: profile.apiKey,
					baseURL: profile.customURL!.trim(),
				});
				return provider.chat(profile.model);
			}

			case "azure": {
				const provider = createOpenAI({
					apiKey: profile.apiKey,
					baseURL: profile.azureEndpoint!.trim(),
				});
				return provider.chat(profile.model);
			}

			case "claude-code":
			case "codex":
			case "opencode":
				return new CliAgentLanguageModel({
					kind: profile.provider,
					model: profile.model,
					binary: profile.customURL,
				});

			default:
				new Notice(
					`⚠️ Unsupported provider: ${(profile as ProviderProfile).provider}`,
				);
				return null;
		}
	} catch (error: any) {
		console.error("Error creating language model:", error);
		new Notice(`❌ Error creating language model: ${error.message}`);
		return null;
	}
}

/**
 * Fetches available models from the provider's API.
 * Returns a list of model IDs or an empty array on error.
 */
export async function fetchProviderModels(
	profile: ProviderProfile,
): Promise<string[]> {
	const requestJson = async (
		url: string,
		headers?: Record<string, string>,
	): Promise<any> => {
		const response = await requestUrl({ url, method: "GET", headers });
		return JSON.parse(response.text);
	};
	try {
		switch (profile.provider) {
			case "openai": {
				const baseURL =
					profile.customURL?.trim() || getDefaultEndpoint("openai");
				const data = await requestJson(`${baseURL}/models`, {
					Authorization: `Bearer ${profile.apiKey}`,
				});
				return (data.data ?? [])
					.map((m: any) => m.id)
					.filter((id: string) => id.includes("gpt"));
			}

			case "anthropic": {
				// Anthropic has no public models API; return known models.
				return [
					"claude-3-5-sonnet-latest",
					"claude-3-5-sonnet-20241022",
					"claude-3-5-haiku-latest",
					"claude-3-5-haiku-20241022",
					"claude-3-opus-latest",
					"claude-3-opus-20240229",
					"claude-3-sonnet-20240229",
					"claude-3-haiku-20240307",
				];
			}

			case "gemini": {
				const baseURL =
					profile.customURL?.trim() || getDefaultEndpoint("gemini");
				const data = await requestJson(
					`${baseURL}/models?key=${profile.apiKey}`,
				);
				return (data.models ?? [])
					.map((m: any) => m.name.replace("models/", ""))
					.filter((id: string) => id.startsWith("gemini"));
			}

			case "deepseek": {
				const baseURL =
					profile.customURL?.trim() || getDefaultEndpoint("deepseek");
				const data = await requestJson(`${baseURL}/models`, {
					Authorization: `Bearer ${profile.apiKey}`,
				});
				return (data.data ?? []).map((m: any) => m.id);
			}

			case "openrouter": {
				const baseURL =
					profile.customURL?.trim() ||
					getDefaultEndpoint("openrouter");
				const data = await requestJson(`${baseURL}/models`);
				return (data.data ?? []).map((m: any) => m.id);
			}

			case "kimi": {
				const baseURL =
					profile.customURL?.trim() || getDefaultEndpoint("kimi");
				const data = await requestJson(`${baseURL}/models`, {
					Authorization: `Bearer ${profile.apiKey}`,
				});
				return (data.data ?? [])
					.map((m: any) => m.id)
					.filter((id: string) => id.includes("kimi"));
			}

			case "claude-code":
				return [CLI_DEFAULT_MODEL, "sonnet", "opus", "haiku"];

			case "codex":
			case "opencode":
				// The CLI's own config picks the model; type a name to override.
				return [CLI_DEFAULT_MODEL];

			case "ollama": {
				const baseURL =
					profile.customURL?.trim() || getDefaultEndpoint("ollama");
				const data = await requestJson(
					`${baseURL.replace("/v1", "")}/api/tags`,
				);
				return (data.models ?? []).map((m: any) => m.name);
			}

			case "custom": {
				const baseURL = profile.customURL!.trim();
				const data = await requestJson(`${baseURL}/models`, {
					Authorization: `Bearer ${profile.apiKey}`,
				});
				return (data.data ?? []).map((m: any) => m.id);
			}

			case "azure": {
				// Azure OpenAI: list deployments via management API or fallback
				const endpoint = profile.azureEndpoint!.trim();
				const instanceMatch = endpoint.match(
					/https:\/\/([^.]+)\.(?:openai|cognitiveservices)\.azure\.com/,
				);
				if (!instanceMatch) {
					throw new Error(
						"Could not parse Azure instance name from endpoint.",
					);
				}
				const instance = instanceMatch[1];
				const data = await requestJson(
					`https://${instance}.openai.azure.com/openai/deployments?api-version=2023-03-15-preview`,
					{ "api-key": profile.apiKey! },
				);
				return (data.data ?? []).map((m: any) => m.id || m.model);
			}

			default:
				return [];
		}
	} catch (error: any) {
		console.error("Error fetching models:", error);
		throw error;
	}
}

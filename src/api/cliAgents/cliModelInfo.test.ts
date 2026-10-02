import { describe, expect, it } from "vitest";
import {
	parseCodexModelInfo,
	parseJsonc,
	parseOpencodeModelInfo,
	supportedEffort,
} from "./cliModelInfo";

describe("CLI model info", () => {
	it("reads Codex names, effort levels and the configured default", () => {
		const info = parseCodexModelInfo(
			{
				models: [
					{
						slug: "gpt-6-sol",
						display_name: "GPT-6 Sol",
						supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
					},
				],
			},
			'model = "gpt-6-sol"\nmodel_reasoning_effort = "high"\n',
		);
		expect(info["gpt-6-sol"]).toEqual({ label: "GPT-6 Sol", efforts: ["low", "high"] });
		expect(info.default).toEqual({
			label: "Default (GPT-6 Sol)",
			efforts: ["low", "high"],
		});
	});

	it("merges the opencode catalog with configured providers", () => {
		const info = parseOpencodeModelInfo(
			{
				deepseek: {
					models: {
						"deepseek-flash": {
							name: "DeepSeek V4.1 Flash",
							reasoning_options: [
								{ type: "toggle" },
								{ type: "effort", values: ["low", "high", "max"] },
							],
						},
					},
				},
			},
			[
				{
					provider: {
						factory: {
							models: {
								"deepseek-v4.1-flash": {
									name: "DeepSeek V4.1 Flash",
									variants: {
										off: {},
										medium: { disabled: true },
										high: {},
									},
								},
							},
						},
					},
				},
			],
		);
		expect(info["deepseek/deepseek-flash"].efforts).toEqual(["low", "high", "max"]);
		expect(info["factory/deepseek-v4.1-flash"]).toEqual({
			label: "DeepSeek V4.1 Flash",
			efforts: ["off", "high"],
		});
		expect(info.default.efforts).toEqual([]);
	});

	it("drops efforts the model does not list", () => {
		const info = { m: { efforts: ["low", "high"] } };
		expect(supportedEffort(info, "m", "high")).toBe("high");
		expect(supportedEffort(info, "m", "max")).toBeUndefined();
		expect(supportedEffort(info, "other", "high")).toBeUndefined();
		expect(supportedEffort(undefined, "m", "high")).toBeUndefined();
	});

	it("parses JSONC without touching strings", () => {
		expect(
			parseJsonc('{\n // note\n "url": "http://x//y", /* c */ "a": [1,],\n}'),
		).toEqual({ url: "http://x//y", a: [1] });
	});
});

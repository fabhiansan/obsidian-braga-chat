import { Setting } from "obsidian";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

export function createSection(
	containerEl: HTMLElement,
	title: string,
	description?: string,
): HTMLElement {
	const sectionEl = containerEl.createDiv({
		cls: "obsidian-ai-settings-section",
	});
	sectionEl.id = `obsidian-ai-settings-${title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")}`;
	sectionEl.createEl("h3", { text: title });
	if (description) {
		sectionEl.createEl("p", {
			text: description,
			cls: "obsidian-ai-settings-section-desc",
		});
	}
	return sectionEl;
}

export function createPasswordInput(
	containerEl: HTMLElement,
	options: {
		value: string;
		placeholder?: string;
		onChange: (value: string) => void | Promise<void>;
	},
): { inputEl: HTMLInputElement; wrapperEl: HTMLElement } {
	const wrapper = containerEl.createDiv({ cls: "obsidian-ai-password-input-wrapper" });

	const input = wrapper.createEl("input", {
		cls: "obsidian-ai-password-input",
		attr: {
			type: "password",
			value: options.value,
			placeholder: options.placeholder || "",
		},
	});

	const toggleBtn = wrapper.createEl("button", {
		cls: "obsidian-ai-password-toggle",
		attr: { type: "button", "aria-label": "Show password" },
	});
	toggleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

	const copyBtn = wrapper.createEl("button", {
		cls: "obsidian-ai-password-copy",
		attr: { type: "button", "aria-label": "Copy to clipboard" },
	});
	copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

	let isVisible = false;
	toggleBtn.addEventListener("click", () => {
		isVisible = !isVisible;
		input.type = isVisible ? "text" : "password";
		toggleBtn.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
		if (isVisible) {
			toggleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
		} else {
			toggleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
		}
	});

	copyBtn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(input.value);
			copyBtn.classList.add("is-copied");
			setTimeout(() => copyBtn.classList.remove("is-copied"), 1200);
		} catch {
			// ignore
		}
	});

	input.addEventListener("change", () => {
		void options.onChange(input.value);
	});
	input.addEventListener("blur", () => {
		void options.onChange(input.value);
	});

	return { inputEl: input, wrapperEl: wrapper };
}

export function createSliderWithValue(
	setting: Setting,
	options: {
		value: number;
		min: number;
		max: number;
		step: number;
		onChange: (value: number) => void | Promise<void>;
	},
): void {
	let valueEl: HTMLElement | null = null;

	setting.addSlider((slider) => {
		slider
			.setLimits(options.min, options.max, options.step)
			.setValue(options.value)
			.onChange(async (value) => {
				if (valueEl) valueEl.textContent = String(value);
				await options.onChange(value);
			});
	});

	const controlEl = setting.controlEl;
	valueEl = controlEl.createEl("span", {
		cls: "obsidian-ai-slider-value",
		text: String(options.value),
	});
}

export function getProviderLabel(provider: string): string {
	switch (provider) {
		case "openai":
			return "OpenAI";
		case "anthropic":
			return "Anthropic";
		case "deepseek":
			return "DeepSeek";
		case "kimi":
			return "Kimi";
		case "gemini":
			return "Gemini";
		case "openrouter":
			return "OpenRouter";
		case "azure":
			return "Azure OpenAI";
		case "custom":
			return "Custom endpoint";
		case "agent":
			return "Agent (OpenResponses)";
		case "claude-code":
			return "Claude Code";
		case "codex":
			return "Codex";
		case "opencode":
			return "opencode";
		default:
			return "OpenAI";
	}
}

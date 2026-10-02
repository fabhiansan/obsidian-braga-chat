import { App, Notice, Modal, Setting, requestUrl } from "obsidian";

/** Simple logger interface for PluginUpdater diagnostics */
export interface UpdaterLogger {
	log(level: string, ...args: any[]): void;
}

export interface ReleaseInfo {
	tag_name: string;
	name: string;
	body: string;
	prerelease: boolean;
	published_at: string;
	html_url: string;
	assets: Array<{
		name: string;
		browser_download_url: string;
		size: number;
	}>;
}

export interface AvailableBuild {
	release: ReleaseInfo;
	branch: string;
	commitHash?: string;
	/** Git commit timestamp; release publication time is the fallback. */
	committedAt?: string;
}

export interface CommitInfo {
	sha: string;
	message: string;
	authorName: string;
	committedAt: string;
}

export interface UpdateCheckResult {
	hasUpdate: boolean;
	currentVersion: string;
	latestVersion: string;
	release: ReleaseInfo | null;
	isPrerelease: boolean;
	commitMatch?: boolean;
	latestCommit?: CommitInfo | null;
}

const GITHUB_REPO = "fabhiansan/obsidian-braga-chat";
const RELEASE_FILES = ["main.js", "manifest.json", "styles.css"];

/** Simple semver comparison: returns >0 if v1 > v2, <0 if v1 < v2, 0 if equal.
 *  Non-semver tags (e.g. "latest-dev") are treated as always newer than semver versions. */
function compareVersions(v1: string, v2: string): number {
	const clean1 = v1.replace(/^v/, "");
	const clean2 = v2.replace(/^v/, "");

	const isSemver1 = /^\d+(\.\d+)*$/.test(clean1);
	const isSemver2 = /^\d+(\.\d+)*$/.test(clean2);

	// Non-semver vs semver: non-semver is always "newer" (dev build)
	if (!isSemver1 && isSemver2) return 1;
	if (isSemver1 && !isSemver2) return -1;
	if (!isSemver1 && !isSemver2) return clean1 === clean2 ? 0 : 1;

	const a = clean1.split(".").map(Number);
	const b = clean2.split(".").map(Number);
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const av = a[i] || 0;
		const bv = b[i] || 0;
		if (av !== bv) return av - bv;
	}
	return 0;
}

/** Fetch the latest commit SHA for a branch from GitHub */
async function fetchLatestCommit(
	branch: string = "main",
): Promise<CommitInfo | null> {
	try {
		const data = await fetchJson(
			`https://api.github.com/repos/${GITHUB_REPO}/commits/${encodeURIComponent(branch)}?_cb=${Date.now()}`,
		);
		if (!data?.sha) return null;
		return {
			sha: data.sha,
			message: data.commit?.message?.split("\n")[0] ?? "",
			authorName: data.commit?.author?.name ?? data.author?.login ?? "",
			committedAt:
				data.commit?.author?.date ?? data.commit?.committer?.date ?? "",
		};
	} catch {
		return null;
	}
}
async function fetchJson(url: string): Promise<any> {
	const response = await requestUrl({
		url,
		method: "GET",
		headers: { "User-Agent": "obsidian-ai-updater" },
	});
	if (response.status < 200 || response.status >= 300) {
		const info = response.text ? JSON.parse(response.text) : {};
		const msg = info?.message || `HTTP ${response.status}`;
		const err: any = new Error(msg);
		err.status = response.status;
		throw err;
	}
	return JSON.parse(response.text);
}

function branchFromRelease(release: ReleaseInfo): string {
	const prefix = "latest-dev-";
	return release.tag_name.startsWith(prefix)
		? release.tag_name.slice(prefix.length)
		: "main";
}

/** Extract the immutable source identity recorded in an automated release. */
function commitInfoFromRelease(release: ReleaseInfo): CommitInfo | null {
	const sha = release.body?.match(/\*\*Commit:\*\*\s*`([^`]+)`/)?.[1];
	if (!sha) return null;
	return {
		sha,
		message: release.name || `Published ${release.tag_name}`,
		authorName: "GitHub Actions",
		committedAt:
			release.body?.match(/\*\*Built at:\*\*\s*(.+)/)?.[1]?.trim() ??
			release.published_at,
	};
}

/** Cross-platform file download using requestUrl + vault adapter */
async function downloadFile(
	app: App,
	url: string,
	destPath: string,
): Promise<void> {
	const response = await requestUrl({
		url,
		method: "GET",
		headers: { "User-Agent": "obsidian-ai-updater" },
	});
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Download failed: HTTP ${response.status}`);
	}
	await app.vault.adapter.write(destPath, response.text);
}

export class PluginUpdater {
	private app: App;
	private pluginDir: string;
	private logger: UpdaterLogger | null = null;

	constructor(app: App, pluginId: string, logger?: UpdaterLogger) {
		this.app = app;
		// Vault-relative path to plugin directory
		this.pluginDir = `.obsidian/plugins/${pluginId}`;
		this.logger = logger ?? null;
	}

	private log(level: string, ...args: any[]): void {
		if (this.logger) {
			this.logger.log(level, "[PluginUpdater]", ...args);
		} else {
			// Fallback to console if no logger attached (shouldn't happen in practice)
			const fn = level === "error" ? console.error : console.log;
			fn("[PluginUpdater]", ...args);
		}
	}

	private async ensureDir(dirPath: string): Promise<void> {
		try {
			await this.app.vault.adapter.mkdir(dirPath);
		} catch {
			// Directory may already exist
		}
	}

	private async fileExists(filePath: string): Promise<boolean> {
		return this.app.vault.adapter.exists(filePath);
	}

	private async readFile(filePath: string): Promise<string> {
		return this.app.vault.adapter.read(filePath);
	}

	private async writeFile(filePath: string, data: string): Promise<void> {
		return this.app.vault.adapter.write(filePath, data);
	}

	private async removeFile(filePath: string): Promise<void> {
		try {
			// Obsidian adapter doesn't have a direct remove, but we can write empty
			// and rely on overwrite, or use the internal API
			const adapter = this.app.vault.adapter as any;
			if (adapter.remove) {
				await adapter.remove(filePath);
			}
		} catch {
			// Best effort
		}
	}

	/** Check if an update is available. For dev channel, prefers branch-specific releases. */
	async checkForUpdate(
		currentVersion: string,
		includePrerelease: boolean,
		currentCommitHash?: string,
		currentBranch?: string,
	): Promise<UpdateCheckResult> {
		this.log("info", "checkForUpdate:", {
			currentVersion,
			includePrerelease,
			currentCommitHash: currentCommitHash?.slice(0, 7),
			currentBranch,
		});
		try {
			let release: ReleaseInfo;

			if (includePrerelease) {
				const releases = (await fetchJson(
					`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30&_cb=${Date.now()}`,
				)) as ReleaseInfo[];
				this.log("info", "fetched releases:", releases.length);
				if (!releases || releases.length === 0) {
					this.log("info", "no releases found");
					return {
						hasUpdate: false,
						currentVersion,
						latestVersion: currentVersion,
						release: null,
						isPrerelease: false,
					};
				}

				// For dev channel: try branch-specific release first, then fall back to latest-dev (main)
				let branchRelease: ReleaseInfo | undefined;
				if (currentBranch && currentBranch !== "main") {
					const branchTag = `latest-dev-${currentBranch}`;
					branchRelease = releases.find(
						(r) => r.tag_name === branchTag,
					);
				}

				// Use branch release if found, otherwise fall back to latest-dev or any pre-release
				release =
					branchRelease ??
					releases.find((r) => r.tag_name === "latest-dev") ??
					releases.find((r) => r.prerelease) ??
					releases[0];
				this.log(
					"info",
					"selected release:",
					release?.tag_name,
					"prerelease:",
					release?.prerelease,
				);
			} else {
				release = await fetchJson(
					`https://api.github.com/repos/${GITHUB_REPO}/releases/latest?_cb=${Date.now()}`,
				);
				this.log("info", "fetched latest release:", release?.tag_name);
			}

			const latestVersion = release.tag_name.replace(/^v/, "");

			const latestCommit = includePrerelease
				? commitInfoFromRelease(release)
				: await fetchLatestCommit("main");
			this.log("info", "latestCommit:", latestCommit?.sha?.slice(0, 7));
			// For dev channel: compare commit hashes to detect if already on latest
			let commitMatch = false;
			if (includePrerelease && currentCommitHash && latestCommit) {
				const shortLocal = currentCommitHash.slice(0, 7);
				const shortRemote = latestCommit.sha.slice(0, 7);
				commitMatch = shortLocal === shortRemote;
				this.log(
					"info",
					"commit compare:",
					shortLocal,
					"vs",
					shortRemote,
					"match:",
					commitMatch,
				);
				if (commitMatch) {
					this.log("info", "commits match - no update");
					return {
						hasUpdate: false,
						currentVersion,
						latestVersion,
						release,
						isPrerelease: true,
						commitMatch: true,
						latestCommit,
					};
				}
			}

			// Dev releases intentionally reuse the same tag. A commit mismatch is
			// therefore the authoritative signal for a dev update.
			const hasUpdate =
				includePrerelease && currentCommitHash
					? latestCommit
						? !commitMatch
						: false
					: compareVersions(latestVersion, currentVersion) > 0;
			this.log(
				"info",
				"version compare:",
				latestVersion,
				"vs",
				currentVersion,
				"hasUpdate:",
				hasUpdate,
			);

			return {
				hasUpdate,
				currentVersion,
				latestVersion,
				release,
				isPrerelease: release.prerelease,
				commitMatch,
				latestCommit,
			};
		} catch (error) {
			this.log("error", "Check failed:", error);
			return {
				hasUpdate: false,
				currentVersion,
				latestVersion: currentVersion,
				release: null,
				isPrerelease: false,
			};
		}
	}

	/** Return the published dev build for each available branch. */
	async listAvailableBuilds(): Promise<AvailableBuild[]> {
		const releases = (await fetchJson(
			`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100&_cb=${Date.now()}`,
		)) as ReleaseInfo[];

		const builds: AvailableBuild[] = [];
		for (const release of (releases ?? []).filter(
			(r) => r.prerelease && r.tag_name.startsWith("latest-dev"),
		)) {
			const branch = branchFromRelease(release);
			const commitInfo = commitInfoFromRelease(release);

			builds.push({
				release,
				branch,
				commitHash: commitInfo?.sha,
				committedAt: commitInfo?.committedAt ?? release.published_at,
			});
		}
		return builds;
	}

	/** Download update files to a temp directory */
	async downloadUpdate(release: ReleaseInfo): Promise<string> {
		const tempDir = `${this.pluginDir}/.update-tmp`;
		await this.ensureDir(tempDir);
		this.log(
			"info",
			"downloading to",
			tempDir,
			"assets:",
			release.assets.map((a) => a.name),
		);

		// Download each required file
		for (const filename of RELEASE_FILES) {
			const asset = release.assets.find((a) => a.name === filename);
			if (!asset) {
				throw new Error(`Release missing required file: ${filename}`);
			}
			const destPath = `${tempDir}/${filename}`;
			this.log(
				"info",
				"downloading",
				filename,
				"from",
				asset.browser_download_url,
			);
			await downloadFile(this.app, asset.browser_download_url, destPath);
			const stat = await this.app.vault.adapter.stat(destPath);
			this.log(
				"info",
				"downloaded",
				filename,
				"size:",
				stat?.size ?? "unknown",
			);
		}

		return tempDir;
	}

	/** Install downloaded update files */
	async installUpdate(tempDir: string): Promise<void> {
		const backupDir = `${this.pluginDir}/.backup`;
		await this.ensureDir(backupDir);
		this.log(
			"info",
			"installing from",
			tempDir,
			"backing up to",
			backupDir,
		);

		// Backup current files
		for (const filename of RELEASE_FILES) {
			const currentPath = `${this.pluginDir}/${filename}`;
			const backupPath = `${backupDir}/${filename}`;
			if (await this.fileExists(currentPath)) {
				const content = await this.readFile(currentPath);
				await this.writeFile(backupPath, content);
				this.log("info", "backed up", filename);
			}
		}

		// Copy new files
		for (const filename of RELEASE_FILES) {
			const src = `${tempDir}/${filename}`;
			const dest = `${this.pluginDir}/${filename}`;
			const content = await this.readFile(src);
			await this.writeFile(dest, content);
			this.log(
				"info",
				"installed",
				filename,
				"(" + content.length + " chars)",
			);
		}
	}

	/** Rollback to backup files */
	async rollback(): Promise<void> {
		const backupDir = `${this.pluginDir}/.backup`;
		if (!(await this.fileExists(backupDir))) {
			throw new Error("No backup available for rollback");
		}

		for (const filename of RELEASE_FILES) {
			const backupPath = `${backupDir}/${filename}`;
			const dest = `${this.pluginDir}/${filename}`;
			if (await this.fileExists(backupPath)) {
				const content = await this.readFile(backupPath);
				await this.writeFile(dest, content);
			}
		}
	}
}

/** Modal shown when an update is available */
export class UpdateAvailableModal extends Modal {
	private result: "install" | "skip" | null = null;

	constructor(
		app: App,
		private checkResult: UpdateCheckResult,
		private onInstall: () => Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Update Available" });

		const info = contentEl.createDiv();
		info.createEl("p", {
			text: `Current version: ${this.checkResult.currentVersion}`,
		});
		info.createEl("p", {
			text: `Latest version: ${this.checkResult.latestVersion}`,
		});

		if (this.checkResult.isPrerelease) {
			info.createEl("p", {
				text: "⚠️ This is a pre-release (dev build).",
				cls: "updater-prerelease-warning",
			});
		}

		if (this.checkResult.latestCommit) {
			const commit = this.checkResult.latestCommit;
			contentEl.createEl("h3", { text: "Build information" });
			const buildInfo = contentEl.createDiv("updater-build-info");
			const commitLink = buildInfo.createEl("a", {
				text: commit.sha.slice(0, 7),
				href: `https://github.com/${GITHUB_REPO}/commit/${commit.sha}`,
			});
			commitLink.setAttr("target", "_blank");
			buildInfo.createEl("span", {
				text: ` — ${commit.message || "No commit message"}`,
			});
			buildInfo.createEl("br");
			buildInfo.createEl("span", {
				text: `${commit.authorName ? `${commit.authorName} · ` : ""}${commit.committedAt ? new Date(commit.committedAt).toLocaleString() : "Timestamp unavailable"}`,
			});
		}

		if (this.checkResult.release?.body) {
			contentEl.createEl("h3", { text: "Changelog" });
			const changelog = contentEl.createDiv("updater-changelog");
			changelog.createEl("pre", { text: this.checkResult.release.body });
		}

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Install & Reload")
					.setCta()
					.onClick(async () => {
						btn.setDisabled(true);
						btn.setButtonText("Installing…");
						try {
							await this.onInstall();
							this.result = "install";
							this.close();
							new Notice(
								"✅ Update installed. Reloading Obsidian…",
							);
							// @ts-ignore
							this.app.commands.executeCommandById("app:reload");
						} catch (error: any) {
							btn.setButtonText("Install & Reload");
							btn.setDisabled(false);
							new Notice(`❌ Update failed: ${error.message}`);
						}
					}),
			)
			.addButton((btn) =>
				btn.setButtonText("Skip").onClick(() => {
					this.result = "skip";
					this.close();
				}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}

	async awaitChoice(): Promise<"install" | "skip"> {
		return new Promise((resolve) => {
			const check = () => {
				if (this.result !== null) {
					resolve(this.result);
				} else {
					setTimeout(check, 50);
				}
			};
			check();
		});
	}
}

/** Modal for selecting a published dev build from any branch. */
export class AvailableBuildsModal extends Modal {
	private builds: AvailableBuild[] = [];

	constructor(
		app: App,
		private updater: PluginUpdater,
		private onInstall: (build: AvailableBuild) => Promise<void>,
	) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Available dev builds" });
		contentEl.createEl("p", {
			text: "Choose a published branch build to download and install.",
		});
		const status = contentEl.createEl("p", { text: "Loading builds…" });

		try {
			this.builds = await this.updater.listAvailableBuilds();
			status.remove();
			if (this.builds.length === 0) {
				contentEl.createEl("p", {
					text: "No branch builds are currently available.",
				});
				return;
			}

			for (const build of this.builds) {
				const timestamp = build.committedAt
					? new Date(build.committedAt).toLocaleString()
					: new Date(build.release.published_at).toLocaleString();
				new Setting(contentEl)
					.setName(build.branch)
					.setDesc(
						`${build.release.name} · ${build.commitHash?.slice(0, 7) ?? "commit unavailable"} · ${timestamp}`,
					)
					.addButton((button) =>
						button.setButtonText("Install").onClick(async () => {
							button.setDisabled(true);
							button.setButtonText("Installing…");
							try {
								await this.onInstall(build);
								this.close();
								new Notice(
									"✅ Build installed. Reloading Obsidian…",
								);
								// @ts-ignore Obsidian exposes this command at runtime.
								this.app.commands.executeCommandById(
									"app:reload",
								);
							} catch (error: any) {
								button.setDisabled(false);
								button.setButtonText("Install");
								new Notice(
									`❌ Install failed: ${error.message}`,
								);
							}
						}),
					);
			}
		} catch (error) {
			status.setText(
				`Could not load builds: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}

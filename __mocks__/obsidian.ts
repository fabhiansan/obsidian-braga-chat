export class MarkdownView {
	file = null;
}

export class Notice {
	constructor(public message: string) {}
}

export function setIcon(element: HTMLElement, icon: string): void {
	element.dataset.icon = icon;
}

export class Menu {
	addItem(callback: (item: MenuItem) => unknown): this {
		callback(new MenuItem());
		return this;
	}

	addSeparator(): this {
		return this;
	}

	showAtMouseEvent(_event: MouseEvent): this {
		return this;
	}
}

export class MenuItem {
	setTitle(_title: string): this {
		return this;
	}

	setIcon(_icon: string): this {
		return this;
	}

	setSection(_section: string): this {
		return this;
	}

	setIsLabel(_isLabel: boolean): this {
		return this;
	}

	setChecked(_checked: boolean | null): this {
		return this;
	}

	onClick(_callback: () => unknown): this {
		return this;
	}
}

export class TFile {
	basename = "";
	path = "";
}

export class WorkspaceLeaf {
	view: any = null;
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: HTMLElement;

	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement("div");
	}

	display(): void {}
	hide(): void {}
}

export class Setting {
	private containerEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
	}

	setName(name: string): this {
		return this;
	}

	setDesc(desc: string | DocumentFragment): this {
		return this;
	}

	setTooltip(tooltip: string): this {
		return this;
	}

	addText(cb: (component: any) => any): this {
		cb({
			inputEl: document.createElement("input"),
			setPlaceholder: () => {},
			setValue: () => {},
			onChange: () => {},
			setDisabled: () => {},
		});
		return this;
	}

	addTextArea(cb: (component: any) => any): this {
		cb({
			inputEl: document.createElement("textarea"),
			setPlaceholder: () => {},
			setValue: () => {},
			onChange: () => {},
			setDisabled: () => {},
		});
		return this;
	}

	addDropdown(cb: (component: any) => any): this {
		cb({
			selectEl: document.createElement("select"),
			addOption: () => {},
			setValue: () => {},
			onChange: () => {},
			setDisabled: () => {},
		});
		return this;
	}

	addToggle(cb: (component: any) => any): this {
		cb({
			toggleEl: document.createElement("input"),
			setValue: () => {},
			onChange: () => {},
			setTooltip: () => {},
			setDisabled: () => {},
		});
		return this;
	}

	addButton(cb: (component: any) => any): this {
		cb({
			buttonEl: document.createElement("button"),
			setButtonText: () => {},
			setCta: () => {},
			setWarning: () => {},
			setDisabled: () => {},
			onClick: () => {},
		});
		return this;
	}

	addSlider(cb: (component: any) => any): this {
		cb({
			sliderEl: document.createElement("input"),
			setLimits: () => {},
			setValue: () => {},
			onChange: () => {},
			setDynamicTooltip: () => {},
			setDisabled: () => {},
		});
		return this;
	}

	addExtraButton(cb: (component: any) => any): this {
		cb({
			extraSettingsEl: document.createElement("span"),
			setIcon: () => {},
			setTooltip: () => {},
			onClick: () => {},
			setDisabled: () => {},
		});
		return this;
	}

	setHeading(): this {
		return this;
	}

	setClass(cls: string): this {
		return this;
	}

	setDisabled(disabled: boolean): this {
		return this;
	}

	then(cb: (setting: Setting) => any): this {
		cb(this);
		return this;
	}
}

export class Platform {
	static isMobile = false;
	static isDesktop = true;
}

export class Component {
	registerEvent(event: any): void {}
	registerDomEvent(el: any, type: any, callback: any): void {}
	registerInterval(id: number): void {}
	registerEditorExtension(extension: any): void {}
	onload(): void {}
	onunload(): void {}
}

export class Plugin extends Component {
	app: any;
	manifest: any;
	constructor(app: any, manifest: any) {
		super();
		this.app = app;
		this.manifest = manifest;
	}
	addRibbonIcon(icon: string, title: string, callback: any): HTMLElement {
		return document.createElement("div");
	}
	addStatusBarItem(): HTMLElement {
		return document.createElement("div");
	}
	addCommand(command: any): any {
		return {};
	}
	addSettingTab(tab: any): void {}
	registerView(type: string, viewCreator: any): void {}
	registerHoverLinkSource(id: string, info: any): void {}
	registerEditorExtension(extension: any): void {}
	loadData(): Promise<any> {
		return Promise.resolve({});
	}
	saveData(data: any): Promise<void> {
		return Promise.resolve();
	}
}

export class ItemView extends Component {
	app: any;
	leaf: any;
	constructor(leaf: any) {
		super();
		this.leaf = leaf;
	}
	getViewType(): string {
		return "";
	}
	getDisplayText(): string {
		return "";
	}
	getIcon(): string {
		return "";
	}
	getState(): any {
		return {};
	}
}

export class View {
	app: any;
	leaf: any;
	getViewType(): string {
		return "";
	}
	getDisplayText(): string {
		return "";
	}
	getIcon(): string {
		return "";
	}
	getState(): any {
		return {};
	}
}

export class TAbstractFile {
	vault: any;
	path: string;
	name: string;
}

export class Vault extends Component {
	getAbstractFileByPath(path: string): TAbstractFile | null {
		return null;
	}
	read(file: TAbstractFile): Promise<string> {
		return Promise.resolve("");
	}
	readBinary(file: TAbstractFile): Promise<ArrayBuffer> {
		return Promise.resolve(new ArrayBuffer(0));
	}
	create(path: string, data: string): Promise<TFile> {
		return Promise.resolve(new TFile());
	}
	createFolder(path: string): Promise<void> {
		return Promise.resolve();
	}
	getAllLoadedFiles(): TAbstractFile[] {
		return [];
	}
	getMarkdownFiles(): TFile[] {
		return [];
	}
	getFiles(): TFile[] {
		return [];
	}
	getRoot(): TAbstractFile {
		return new TAbstractFile();
	}
	delete(file: TAbstractFile, system?: boolean): Promise<void> {
		return Promise.resolve();
	}
	rename(file: TAbstractFile, newPath: string): Promise<void> {
		return Promise.resolve();
	}
	cachedRead(file: TFile): Promise<string> {
		return Promise.resolve("");
	}
	append(file: TFile, data: string): Promise<void> {
		return Promise.resolve();
	}
	modify(file: TFile, data: string): Promise<void> {
		return Promise.resolve();
	}
	readAbstractFileByPath(path: string): Promise<ArrayBuffer> {
		return Promise.resolve(new ArrayBuffer(0));
	}
}

export class MetadataCache extends Component {
	getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null {
		return null;
	}
	getFileCache(file: TFile): any {
		return null;
	}
	getAllTags(): Record<string, number> {
		return {};
	}
}

export class Workspace extends Component {
	getActiveViewOfType(viewType: any): View | null {
		return null;
	}
	getLeavesOfType(type: string): WorkspaceLeaf[] {
		return [];
	}
	getRightLeaf(split?: boolean): WorkspaceLeaf | null {
		return null;
	}
	revealLeaf(leaf: WorkspaceLeaf): void {}
	detachLeavesOfType(type: string): void {}
	on(name: string, callback: any): any {
		return {};
	}
	off(name: string, callback: any): void {}
}

export class Editor {
	getValue(): string {
		return "";
	}
	setValue(value: string): void {}
	getLine(line: number): string {
		return "";
	}
	getCursor(): any {
		return { line: 0, ch: 0 };
	}
	setCursor(cursor: any): void {}
	replaceRange(replacement: string, from: any, to?: any): void {}
	replaceSelection(replacement: string): void {}
	getSelection(): string {
		return "";
	}
	hasFocus(): boolean {
		return false;
	}
	focus(): void {}
	blur(): void {}
	getDoc(): any {
		return {};
	}
	getScrollInfo(): any {
		return {};
	}
	scrollTo(x: number, y: number): void {}
	scrollIntoView(range: any, center?: boolean): void {}
	undo(): void {}
	redo(): void {}
}

export class Modal {
	app: any;
	containerEl: HTMLElement;
	modalEl: HTMLElement;
	constructor(app: any) {
		this.app = app;
		this.containerEl = document.createElement("div");
		this.modalEl = document.createElement("div");
	}
	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
	setTitle(title: string): void {}
	setContent(content: string): void {}
}

export class TextFileView extends View {
	getViewData(): string {
		return "";
	}
	setViewData(data: string, clear: boolean): void {}
	clear(): void {}
	getViewType(): string {
		return "";
	}
}

export class MarkdownRenderer {
	static renderMarkdown(
		markdown: string,
		el: HTMLElement,
		sourcePath: string,
		component: Component,
	): Promise<void> {
		return Promise.resolve();
	}
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/");
}

export function requireApiVersion(version: string): boolean {
	return true;
}

export function getAllTags(cache: any): Record<string, number> {
	return {};
}

export function parseFrontMatterEntry(cache: any, key: string): any {
	return undefined;
}

export function parseFrontMatterTags(cache: any): string[] {
	return [];
}

export function parseFrontMatterStringArray(
	cache: any,
	key: string,
): string[] | undefined {
	return undefined;
}

export function stripHeading(heading: string): string {
	return heading.replace(/^#+\s+/, "");
}

export class moment {}

export function debounce(fn: any, timeout: number): any {
	return fn;
}

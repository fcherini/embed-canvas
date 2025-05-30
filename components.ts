import { App, FuzzySuggestModal, TFile } from "obsidian";

export class FileModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onChoose: (file: TFile, evt: MouseEvent | KeyboardEvent) => void;

	constructor(
		app: App,
		onChoose: (file: TFile, evt: MouseEvent | KeyboardEvent) => void
	) {
		super(app);
		this.files = app.vault.getFiles();
		this.onChoose = onChoose;
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent) {
		this.onChoose(file, evt);
	}
}
export enum Option {
	create = "Create new file",
	append = "Append existing file",
	replace = "Replace existing file's content",
}

export class OptionsModal extends FuzzySuggestModal<Option> {
	private onChoose: (option: Option, evt: MouseEvent | KeyboardEvent) => void;

	constructor(
		app: App,
		onChoose: (option: Option, evt: MouseEvent | KeyboardEvent) => void
	) {
		super(app); // ✅ Required
		this.onChoose = onChoose;
	}

	getItems(): Option[] {
		// ✅ Object.values gets enum *values*
		return Object.values(Option);
	}

	getItemText(option: Option): string {
		// The enum *value* is the label text
		return option;
	}

	onChooseItem(option: Option, evt: MouseEvent | KeyboardEvent) {
		this.onChoose(option, evt);
	}
}

import { FileModal } from "components";
import { createNewFile, nodesToMarkdown } from "utils";
import { Menu, Notice, Plugin, TFile } from "obsidian";
import {
	Canvas,
	CanvasData,
	CanvasNodeData,
	CanvasView,
	WorkspaceWithCanvas,
} from "types";
import { buildEmbedStructure, buildLinkIcon } from "embedBuilder";

export default class CanvasNodeEmbedPlugin extends Plugin {
	async onload() {
		this.observeEmbeds();
		// 	id: "canvas-to-new-markdown",
		// 	name: "Canvas to new markdown file (retains canvas file)",
		// 	checkCallback: (checking: boolean) => {
		// 		const file = this.app.workspace.getActiveFile();

		// 		if (file?.extension === "canvas") {
		// 			if (!checking) {
		// 				const canvasView =
		// 					this.app.workspace.getMostRecentLeaf()
		// 						?.view as CanvasView;
		// 				this.onCanvasToNewMarkdown(
		// 					canvasView.canvas.getData().nodes,
		// 					canvasView.file
		// 				);
		// 			}
		// 			return true;
		// 		}
		// 		if (file?.extension === "markdown") {
		// 			if (!checking) {
		// 				new FileModal(this.app, async (chosenFile, evt) => {
		// 					const canvasFile = await this.app.vault.read(
		// 						chosenFile
		// 					);
		// 					const nodes = JSON.parse(canvasFile) as CanvasData;
		// 					this.onCanvasToNewMarkdown(nodes.nodes, chosenFile);
		// 				}).open();
		// 			}
		// 			return true;
		// 		}
		// 	},
		// });

		this.addCommand({
			id: "canvas-to-new-markdown",
			name: "Canvas to new markdown file (retains canvas file)",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();

				if (file?.extension === "canvas") {
					const view = this.app.workspace.getMostRecentLeaf()
						?.view as CanvasView;

					if (!checking) {
						this.onCanvasToNewMarkdown(
							view.canvas.getData().nodes,
							view.file
						);
					}
					return true;
				}

				if (file?.extension === "md") {
					if (!checking) {
						new FileModal(this.app, async (chosenFile, evt) => {
							try {
								const canvasFile = await this.app.vault.read(
									chosenFile
								);
								const nodes = JSON.parse(
									canvasFile
								) as CanvasData;
								this.onCanvasToNewMarkdown(
									nodes.nodes,
									chosenFile
								);
							} catch (err) {
								new Notice("Failed to read canvas file");
								console.error(err);
							}
						}).open();
					}
					return true;
				}

				return false;
			},
		});

		this.addCommand({
			id: "append-canvas-to-file",
			name: "Append canvas to this file",
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveFile();
				if (view?.extension === "markdown") {
					if (!checking) {
						new Notice("Canvas appended to file");
						// this.onCanvasToNewMarkdown();
					}
					return true;
				}
			},
		});

		// this.addCommand({
		// 	id: "canvas-to-new-markdown",
		// 	name: "Canvas to new markdown file (retains canvas file)",
		// 	checkCallback: (checking: boolean) => {
		// 		const canvasView = this.app.workspace.getActiveFile();
		// 		if (canvasView?.extension !== "canvas") {
		// 			if (!checking) {
		// 				new Notice("File created");
		// 				this.onCanvasToNewMarkdown();
		// 			}
		// 			return true;
		// 		}
		// 	},
		// });

		this.addCommand({
			id: "append-canvas-to-markdown",
			name: "Append canvas content to markdown file (retains canvas file)",
			checkCallback: (checking: boolean) => {
				const canvasView = this.app.workspace.getMostRecentLeaf()
					?.view as CanvasView;
				if (canvasView.file.extension === "canvas") {
					if (!checking) {
						new FileModal(this.app, (file, evt) => {
							this.onAppendCanvasToMarkdown(
								canvasView.canvas,
								file
							);
						}).open();
					}
					return true;
				}
			},
		});

		const workspace = this.app.workspace as unknown as WorkspaceWithCanvas;
		this.registerEvent(
			workspace.on("canvas:node-menu", (menu: Menu, node: any) => {
				menu.addItem((item) => {
					item.setTitle("Copy card embed link").onClick(() =>
						this.onCopyCardEmbed(node)
					);
				});
			})
		);

		this.registerEvent(
			workspace.on(
				"canvas:selection-menu",
				(menu: Menu, canvas: Canvas) => {
					menu.addItem((item) => {
						item.setTitle("New .md file from selection").onClick(
							() => this.onSelectionToMarkdown(canvas)
						);
					});
				}
			)
		);

		this.registerEvent(
			workspace.on(
				"canvas:selection-menu",
				(menu: Menu, canvas: Canvas) => {
					menu.addItem((item) => {
						item.setTitle("Append selection to .md file").onClick(
							() => {
								new FileModal(this.app, (file, evt) => {
									this.onAppendSelectionToFile(canvas, file);
								}).open();
							}
						);
					});
				}
			)
		);
	}
	//TODO markdown commands: append canvas to this file, replace this file with canvas content
	//TODO check for file type on FileModal
	//TODO update existing file
	//TODO link and zoom to node
	//TODO line break on appending

	observeEmbeds() {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (!(node instanceof HTMLElement)) continue;

					if (
						node.matches(
							'.internal-embed:not([data-node-embed="parsed"])'
						)
					) {
						this.tryReplaceEmbed(node);
					} else {
						const embeds = node.querySelectorAll?.(
							'.internal-embed:not([data-node-embed="parsed"])'
						);
						embeds?.forEach((embed) => this.tryReplaceEmbed(embed));
					}
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	async onAppendSelectionToFile(canvas: Canvas, file: TFile) {
		const data = nodesToMarkdown(
			canvas.getSelectionData().nodes,
			canvas.view.file
		);
		await this.app.vault.append(file, data);
		new Notice(`Selection appended to ${file.name}`);
		this.app.workspace.getLeaf(true).openFile(file);
	}

	async onSelectionToMarkdown(canvas: Canvas) {
		const file = canvas.view.file;
		const data = nodesToMarkdown(canvas.getSelectionData().nodes, file);
		await createNewFile(data, file.path.replace(".canvas", ""), this.app);
	}

	async onAppendCanvasToMarkdown(canvas: Canvas, mdFile: TFile) {
		const data = nodesToMarkdown(canvas.getData().nodes, canvas.view.file);
		await this.app.vault.append(mdFile, data);
		new Notice(`Selection appended to ${mdFile.name}`);
		this.app.workspace.getLeaf(true).openFile(mdFile);
	}

	async onCanvasToNewMarkdown(nodes: CanvasNodeData[], file: TFile) {
		const data = nodesToMarkdown(nodes, file);
		await createNewFile(data, file.path.replace(".canvas", ""), this.app);
	}

	async onCopyCardEmbed(node: CanvasNodeData) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;

		let link = "";
		if (node.file) {
			link = `![[${node.file}]]`;
		} else {
			link = `![[${activeFile.name}#${node.id}]]`;
		}

		try {
			await navigator.clipboard.writeText(link);
			new Notice("Node link copied to clipboard!");
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
			new Notice("Failed to copy node link to clipboard.");
		}
	}

	async tryReplaceEmbed(embed: Element) {
		if (!(embed instanceof HTMLElement)) return;
		if (embed.getAttribute("data-node-embed") === "parsed") return;

		const src = embed.getAttribute("src");
		const match = src?.match(/^([\w\s\-/.]+\.canvas)#([a-f0-9]+)$/);
		if (!match) return;

		const [_, canvasPath, nodeId] = match;
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;

		const file = this.app.metadataCache.getFirstLinkpathDest(
			canvasPath,
			activeFile.path
		);
		if (!file) return;

		try {
			const content = await this.app.vault.read(file);
			const json = JSON.parse(content);
			const node = json.nodes?.find(
				(n: CanvasNodeData) => n.id === nodeId
			);
			if (!node) return;

			const linkIcon = await buildLinkIcon(node, file, this.app);
			const container = await buildEmbedStructure(node, this.app);
			embed.setAttribute("data-node-embed", "parsed");

			embed.empty();
			embed.appendChild(container);
			embed.appendChild(linkIcon);
			embed.classList.add("markdown-embed");
			embed.setAttribute("data-type", "block");
			embed.style.position = "relative";
			embed.addEventListener(
				"click",
				(e) => {
					e.stopImmediatePropagation();
					e.preventDefault();
				},
				true
			);
		} catch (err) {
			console.error("Failed to render canvas embed:", err);
		}
	}
}

import { MarkdownRenderer, Menu, Notice, Plugin, TFile } from "obsidian";
import { Canvas, CanvasNodeData, CanvasView, WorkspaceWithCanvas } from "types";

export default class CanvasNodeEmbedPlugin extends Plugin {
	async onload() {
		this.observeEmbeds();

		this.addCommand({
			id: "canvas-to-markdown",
			name: "Canvas to markdown (retains canvas file)",
			checkCallback: (checking: boolean) => {
				const canvasView = this.app.workspace.getActiveFile();
				if (canvasView?.extension === "canvas") {
					if (!checking) {
						new Notice("File created");
						this.canvasToMarkdown();
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
						this.getClipboardEmbedLink(node)
					);
				});
			})
		);

		this.registerEvent(
			workspace.on(
				"canvas:selection-menu",
				(menu: Menu, canvas: Canvas) => {
					menu.addItem((item) => {
						item.setTitle(
							"New markdown file from selection"
						).onClick(() => this.selectionToMarkdown(canvas));
					});
				}
			)
		);
	}

	getNodeEmbedLink(node: CanvasNodeData, fileName: string) {
		switch (node.type) {
			case "file":
				return `![[${node.file}]]`;
			case "text":
				return `![[${fileName}#${node.id}]]`;
			default:
				return "";
		}
	}

	//TODO new file (choose file or create new)
	//TODO update existing file
	//TODO link and zoom to node

	updateCanvasToMarkdown() {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;
		this.app.fileManager.processFrontMatter(file, () => {});
	}

	selectionToMarkdown(canvas: Canvas) {
		this.nodesToMarkdown(canvas.getSelectionData().nodes, canvas.view);
	}

	async nodesToMarkdown(nodes: CanvasNodeData[], canvasView: CanvasView) {
		const basePath = canvasView.file.path.replace(".canvas", "");
		const embedArray: string[] = [];

		nodes.forEach((node) => {
			embedArray.push(this.getNodeEmbedLink(node, canvasView.file.name));
		});

		let attemptPath = `${basePath}.md`;
		let counter = 1;

		while (this.app.vault.getFileByPath(attemptPath)) {
			attemptPath = `${basePath} (${counter}).md`;
			counter++;
		}

		const newFile = await this.app.vault.create(
			attemptPath,
			embedArray.join("\b")
		);
		this.app.workspace.getLeaf(true).openFile(newFile);
	}

	canvasToMarkdown() {
		const canvasView = this.app.workspace.getMostRecentLeaf()
			?.view as CanvasView;
		const nodes = canvasView.canvas.getData().nodes;
		this.nodesToMarkdown(nodes, canvasView);
	}

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

	async tryReplaceEmbed(embed: Element) {
		if (!(embed instanceof HTMLElement)) return;
		if (embed.getAttribute("data-node-embed") === "parsed") return;

		const src = embed.getAttribute("src");
		const match = src?.match(/^([\w\s\-\/.]+\.canvas)#([a-f0-9]+)$/);
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

			const linkIcon = await this.buildLinkIcon(node, file);
			const container = await this.buildEmbedStructure(node);
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

	getEmbedLink(fileName: string, nodeId: string) {
		const link = `![[${fileName}#${nodeId}]]`;
		return link;
	}

	async getClipboardEmbedLink(node: CanvasNodeData) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file found.");
			return;
		}

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

	async buildEmbedStructure(node: any) {
		// Create the content container
		const contentEl = document.createElement("div");
		contentEl.classList.add("markdown-embed-content", "node-insert-event");

		// Create the markdown preview container
		const previewEl = document.createElement("div");
		previewEl.classList.add(
			"markdown-preview-view",
			"markdown-rendered",
			"node-insert-event",
			"show-indentation-guide",
			"allow-fold-headings",
			"allow-fold-lists"
		);

		const paragraphEl = document.createElement("div");
		paragraphEl.classList.add("el-p");

		// Create the sizer container
		const sizerEl = document.createElement("div");
		sizerEl.classList.add(
			"markdown-preview-sizer",
			"markdown-preview-section"
		);

		// Create the pusher element
		const pusherEl = document.createElement("div");
		pusherEl.classList.add("markdown-preview-pusher");
		sizerEl.appendChild(pusherEl);

		// Render the markdown content into the sizer
		await MarkdownRenderer.render(
			this.app,
			node.text || "",
			paragraphEl,
			this.app.workspace.getActiveFile()?.path || "",
			this
		);
		sizerEl.appendChild(paragraphEl);
		previewEl.appendChild(sizerEl);
		contentEl.appendChild(previewEl);

		return contentEl;
	}

	buildLinkIcon(node: any, canvasFile: TFile) {
		// Create link
		const linkIcon = document.createElement("div");
		linkIcon.classList.add("markdown-embed-link");
		const src = `${canvasFile.path}#${node.id}`;
		linkIcon.setAttribute("aria-label", "Open in canvas");
		linkIcon.setAttribute("src", src);
		linkIcon.innerHTML = `
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
						fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
						stroke-linejoin="round" class="svg-icon lucide-link">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
				</svg>
		`;

		linkIcon.addEventListener("click", async (e) => {
			//TODO open link
			this.app.workspace.getLeaf(true).openFile(canvasFile);
		});
		// Assemble the elements
		linkIcon.style.position = "absolute";
		linkIcon.style.top = "8px";
		linkIcon.style.right = "8px";
		linkIcon.style.cursor = "pointer";
		linkIcon.style.opacity = "0.6";
		linkIcon.style.transition = "opacity 0.2s ease-in-out";

		linkIcon.addEventListener(
			"mouseenter",
			() => (linkIcon.style.opacity = "1")
		);
		linkIcon.addEventListener(
			"mouseleave",
			() => (linkIcon.style.opacity = "0.6")
		);

		return linkIcon;
	}
}

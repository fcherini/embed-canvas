import { MarkdownRenderer, Menu, Notice, Plugin, View } from "obsidian";
import { CanvasNodeData, NodeEmbed, WorkspaceWithCanvas } from "types";

interface MyPluginSettings {
	mySetting: string;
}

function debounce(func: (...args: any[]) => void, delay: number) {
	let timeoutId: number | undefined;
	return (...args: any[]) => {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
		timeoutId = window.setTimeout(() => {
			func(...args);
		}, delay);
	};
}
// export const onNodeMenu = createEvent<{ menu: Menu; node: CanvasNode }>();

export default class CanvasNodeEmbedPlugin extends Plugin {
	async onload() {
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
			this.app.workspace.on("layout-change", async () => {
				const activeView = this.getActiveView();
				if (activeView) {
					const embeds = this.getEmbeds(activeView);
					const nodeEmbeds = await this.getEmbeddedNodes(embeds);
					await this.replaceEmbeds(nodeEmbeds);
				}
			})
		);
	}

	getActiveView() {
		const activeLeaf = this.app.workspace.getMostRecentLeaf();
		if (activeLeaf) {
			return activeLeaf.view;
		}
		return null;
	}

	async replaceEmbeds(nodeEmbeds: NodeEmbed[]) {
		for (const { embed, node } of nodeEmbeds) {
			embed.empty();

			const container = await this.buildEmbedStructure(node);

			embed.appendChild(container);
		}
	}

	getEmbeds(view: View): Element[] {
		const embeds = Array.from(
			view.containerEl.querySelectorAll(
				".internal-embed:not(.canvas-nodecard-embed)"
			)
		);
		return embeds;
	}

	private activeEmbeds = new Set<string>();

	async getEmbeddedNodes(embeds: Element[]): Promise<NodeEmbed[]> {
		const results: NodeEmbed[] = [];

		for (const embed of embeds) {
			const src = embed.getAttribute("src");
			const match = src?.match(/^([\w\s\-\/.]+\.canvas)#([a-f0-9]+)$/);
			if (!match) continue;

			const [_, canvasPath, nodeId] = match;
			const currentFilePath =
				this.app.workspace.getActiveFile()?.path || "";
			const file = this.app.metadataCache.getFirstLinkpathDest(
				canvasPath,
				currentFilePath
			);
			if (!file) continue;

			try {
				const content = await this.app.vault.read(file);
				const json = JSON.parse(content);
				const node = json.nodes?.find(
					(n: CanvasNodeData) => n.id === nodeId
				);
				if (node) {
					results.push({ embed, node });
				}
			} catch (err) {
				console.error("Failed to read or parse canvas file:", err);
			}
		}

		return results;
	}

	async getClipboardEmbedLink(node: any) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file found.");
			return;
		}

		const link = `![[${activeFile.name}#${node.id}]]`;

		try {
			await navigator.clipboard.writeText(link);
			new Notice("Node link copied to clipboard!");
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
			new Notice("Failed to copy node link to clipboard.");
		}
	}

	async buildEmbedStructure(node: CanvasNodeData) {
		// Create the top-level container with appropriate classes
		const container = document.createElement("div");
		container.classList.add(
			"internal-embed",
			"markdown-embed",
			"inline-embed",
			"is-loaded",
			"canvas-nodecard-embed" // Custom class to identify canvas node embeds
		);
		container.setAttribute("tabindex", "-1");
		container.setAttribute("contenteditable", "false");
		container.setAttribute("data-type", "block");

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
			sizerEl,
			this.app.workspace.getActiveFile()?.path || "",
			this
		);

		// Assemble the elements
		previewEl.appendChild(sizerEl);
		contentEl.appendChild(previewEl);
		container.appendChild(contentEl);

		return container;
	}
}

export class CanvasEmbed extends Plugin {
	settings: MyPluginSettings;

	onload() {
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				console.log("!!!!!!!! layout changed !!!!!!!!!!");
				const canvasView = this.getActiveCanvasView();
				if (canvasView) {
					this.observeCanvasChanges(canvasView);
				}
			})
		);
	}

	getActiveCanvasView() {
		const activeLeaf = this.app.workspace.getMostRecentLeaf();
		if (
			activeLeaf &&
			activeLeaf.view &&
			activeLeaf.view.containerEl.querySelector(".canvas-wrapper")
		) {
			return activeLeaf.view;
		}
		return null;
	}

	observeCanvasChanges(canvasView: View) {
		const checkAndObserve = () => {
			const target =
				canvasView.containerEl.querySelector(".canvas-wrapper");
			if (target) {
				const view = canvasView as any;
				const debouncedReplace = debounce(() => {
					console.log("!!!! mutation triggered !!!!!");
					console.log(view.canvas.data.nodes);
					// this.replaceMinimapWithIcon();
				}, 300); // Adjust the delay as needed

				const observer = new MutationObserver(() => {
					debouncedReplace();
				});

				observer.observe(target, {
					childList: true,
					subtree: true,
				});

				this.register(() => observer.disconnect());
			} else {
				// Retry after a short delay
				setTimeout(checkAndObserve, 100);
			}
		};

		checkAndObserve();
	}
}

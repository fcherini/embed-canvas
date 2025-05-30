import { App, MarkdownRenderer, TFile } from "obsidian";

export async function buildEmbedStructure(node: any, app: App) {
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
	sizerEl.classList.add("markdown-preview-sizer", "markdown-preview-section");

	// Create the pusher element
	const pusherEl = document.createElement("div");
	pusherEl.classList.add("markdown-preview-pusher");
	sizerEl.appendChild(pusherEl);

	// Render the markdown content into the sizer
	await MarkdownRenderer.render(
		app,
		node.text || "",
		paragraphEl,
		app.workspace.getActiveFile()?.path || "",
		this
	);
	sizerEl.appendChild(paragraphEl);
	previewEl.appendChild(sizerEl);
	contentEl.appendChild(previewEl);

	return contentEl;
}

export function buildLinkIcon(node: any, canvasFile: TFile, app: App) {
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
		app.workspace.getLeaf(true).openFile(canvasFile);
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

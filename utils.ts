import { App, TFile } from "obsidian";
import { CanvasNodeData } from "types";

export async function createNewFile(data: string, basePath: string, app: App) {
	let attemptPath = `${basePath}.md`;
	let counter = 1;
	console.log(attemptPath);
	console.log(app.vault.getFileByPath(`${attemptPath}`));
	while (app.vault.getFileByPath(attemptPath)) {
		attemptPath = `${basePath} (${counter}).md`;
		counter++;
	}

	const newFile = await app.vault.create(attemptPath, data);
	app.workspace.getLeaf(true).openFile(newFile);
}

export function nodesToMarkdown(nodes: CanvasNodeData[], file: TFile) {
	const embedArray: string[] = ["\b"];

	nodes.forEach((node) => {
		embedArray.push(getNodeEmbedLink(node, file.name));
	});

	return embedArray.join("\b");
}

export function getNodeEmbedLink(node: CanvasNodeData, fileName: string) {
	switch (node.type) {
		case "file":
			return `![[${node.file}]]`;
		case "text":
			return `![[${fileName}#${node.id}]]`;
		default:
			return "";
	}
}

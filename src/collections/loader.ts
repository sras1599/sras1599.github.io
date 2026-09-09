import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Loader } from "astro/loaders";
import { parseMarkdownDocument } from "../../scripts/markdown-document.mjs";

/** Load one build-time-known collection from the importer's public snapshot. */
export function collectionLoader(collectionId: string): Loader {
  return {
    name: `vault-${collectionId}`,
    async load(context) {
      const directory = fileURLToPath(
        new URL(`.generated/${collectionId}/`, context.config.root),
      );

      async function sync() {
        const files = await listMarkdownFiles(directory);

        const entries = await Promise.all(
          files.map(async (file) => {
            const absolutePath = path.join(directory, file);
            const filePath = path.relative(
              fileURLToPath(context.config.root),
              absolutePath,
            );

            const source = await readFile(absolutePath, "utf8");
            const document = parseMarkdownDocument(source, { file: filePath });

            if (!document.hasFrontmatter)
              throw new Error(`Invalid generated Markdown: ${file}`);

            const id = file.slice(0, -3).split(path.sep).join("/");
            const body = document.body;
            const digest = context.generateDigest(source);

            const data = await context.parseData({
              id,
              data: document.metadata,
              filePath,
            });
            const rendered = await context.renderMarkdown(body, {
              fileURL: pathToFileURL(absolutePath),
            });

            return { id, data, body, digest, rendered, filePath };
          }),
        );

        const ids = new Set(entries.map((entry) => entry.id));
        for (const id of context.store.keys())
          if (!ids.has(id)) context.store.delete(id);

        for (const entry of entries) context.store.set(entry);
      }

      await sync();

      if (context.watcher) {
        context.watcher.add(directory);

        let queue = Promise.resolve();

        context.watcher.on("all", (_event, file) => {
          const relative = path.relative(directory, path.resolve(file));
          if (
            relative === ".." ||
            relative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relative) ||
            !file.endsWith(".md")
          )
            return;
          queue = queue
            .then(sync)
            .catch((error) => context.logger.error(String(error)));
        });
      }
    },
  };
}

async function listMarkdownFiles(directory: string, relative = "") {
  const files: string[] = [];

  for (const entry of await readdir(path.join(directory, relative), {
    withFileTypes: true,
  })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(directory, child)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(child);
    }
  }

  return files;
}

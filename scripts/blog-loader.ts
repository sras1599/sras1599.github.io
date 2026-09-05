import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";
import type { Loader } from "astro/loaders";

/** Read only the importer's public output, including an explicitly empty set. */
export function blogLoader(): Loader {
  return {
    name: "vault-blog",
    async load(context) {
      const directory = fileURLToPath(
        new URL(".generated/blog/", context.config.root),
      );
      async function sync() {
        const files = (await readdir(directory)).filter((file) =>
          file.endsWith(".md"),
        );
        const entries = await Promise.all(
          files.map(async (file) => {
            const absolutePath = path.join(directory, file);
            const filePath = path.relative(
              fileURLToPath(context.config.root),
              absolutePath,
            );
            const source = await readFile(absolutePath, "utf8");
            const match = source.match(/^---\n([\s\S]*?)\n---\n/);
            if (!match) throw new Error(`Invalid generated Markdown: ${file}`);
            const id = file.slice(0, -3);
            const body = source.slice(match[0].length);
            const digest = context.generateDigest(source);
            const data = await context.parseData({
              id,
              data: parse(match[1]),
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
          if (
            path.dirname(path.resolve(file)) !== directory.replace(/\/$/, "") ||
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

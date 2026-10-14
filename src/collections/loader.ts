/**
 * Load importer-generated Markdown into Astro's content layer. Entry loaders
 * read one collection directory; the index loader reads the separate indexes
 * directory. Both use the same recursive synchronization and Markdown renderer.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Loader } from "astro/loaders";
import { parseMarkdownDocument } from "../../scripts/markdown-document.mjs";

/** Load one build-time-known collection from the importer's public snapshot. */
export function collectionLoader(collectionId: string): Loader {
  return generatedMarkdownLoader(`vault-${collectionId}`, collectionId);
}

/** Load authored collection indexes without mixing them into entry collections. */
export function collectionIndexLoader(): Loader {
  return generatedMarkdownLoader("vault-collection-indexes", "_indexes");
}

/**
 * Create a loader for one importer-owned directory relative to .generated.
 * Missing files remove stale store entries; watcher bursts are debounced and
 * updates stay serialized. Preparation failures leave the previous store intact.
 * Digests are reused only after this load session has rendered every document.
 */
function generatedMarkdownLoader(
  name: string,
  generatedDirectory: string,
): Loader {
  return {
    name,
    async load(context) {
      const directory = fileURLToPath(
        new URL(`.generated/${generatedDirectory}/`, context.config.root),
      );

      let initialized = false;

      async function sync() {
        const files = await listMarkdownFiles(directory);

        const prepared = await Promise.allSettled(
          files.map(async (file) => {
            const absolutePath = path.join(directory, file);
            const filePath = path.relative(
              fileURLToPath(context.config.root),
              absolutePath,
            );

            const source = await readFile(absolutePath, "utf8");
            const id = file.slice(0, -3).split(path.sep).join("/");
            const digest = context.generateDigest(source);
            const stored = context.store.get(id);
            if (initialized && stored?.digest === digest) {
              return { id, entry: undefined };
            }

            const document = parseMarkdownDocument(source, { file: filePath });

            if (!document.hasFrontmatter)
              throw new Error(`Invalid generated Markdown: ${file}`);

            const body = document.body;

            const data = await context.parseData({
              id,
              data: document.metadata,
              filePath,
            });
            const rendered = await context.renderMarkdown(body, {
              fileURL: pathToFileURL(absolutePath),
            });

            return { id, entry: { id, data, body, digest, rendered, filePath } };
          }),
        );

        // Await all preparation, including failures, before touching the store.
        const entries = prepared.map((result) => {
          if (result.status === "rejected") throw result.reason;
          return result.value;
        });
        const ids = new Set(entries.map(({ id }) => id));
        // Astro's store ignores writes with an existing matching digest. Clear
        // only after successful initial preparation so new renderer/schema
        // results replace cached entries even when their source is unchanged.
        if (!initialized) context.store.clear();
        for (const { entry } of entries)
          if (entry) context.store.set(entry);

        for (const id of context.store.keys())
          if (!ids.has(id)) context.store.delete(id);

        initialized = true;
      }

      await sync();

      if (context.watcher) {
        context.watcher.add(directory);

        let timer: ReturnType<typeof setTimeout> | undefined;
        let running = false;
        let pending = false;

        async function refresh() {
          if (running) return;
          pending = false;
          running = true;
          try {
            await sync();
          } catch (error) {
            context.logger.error(String(error));
          } finally {
            running = false;
            // If a burst's debounce elapsed during preparation, run its pass now.
            // Otherwise its still-pending timer will start the next pass.
            if (pending && timer === undefined) void refresh();
          }
        }

        context.watcher.on("all", (_event, file) => {
          const relative = path.relative(directory, path.resolve(file));
          if (
            relative === ".." ||
            relative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relative) ||
            !file.endsWith(".md")
          )
            return;
          pending = true;
          clearTimeout(timer);
          timer = setTimeout(() => {
            timer = undefined;
            void refresh();
          }, 100);
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

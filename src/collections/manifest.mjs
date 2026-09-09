import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizeCollectionRoute } from "./definition.mjs";
import { CollectionRegistry } from "./registry.mjs";

const manifestPath = fileURLToPath(
  new URL("../../.generated/collections.json", import.meta.url),
);

/** Read the importer's active-collection snapshot for Astro route generation. */
export async function readActiveCollections() {
  let source;
  try {
    source = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const manifest = JSON.parse(source);
  if (!Array.isArray(manifest.collections)) {
    throw new Error("Invalid generated collection manifest");
  }

  return manifest.collections.map((collection) => {
    const definition = CollectionRegistry.get(collection.id);
    if (!definition) {
      throw new Error(
        `Generated collection manifest contains unregistered collection ${collection.id}`,
      );
    }

    return {
      definition,
      route: normalizeCollectionRoute(collection.route, {
        label: `generated route for collection ${collection.id}`,
      }),
    };
  });
}

export async function activeCollectionRoute(collectionId) {
  const collection = (await readActiveCollections()).find(
    ({ definition }) => definition.id === collectionId,
  );
  return collection?.route;
}

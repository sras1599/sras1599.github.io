import { z } from "zod";

/** Define all website-owned behavior for one vault collection. */
export function defineCollectionDefinition({
  id,
  defaultRoute,
  entryRenderer,
  metadataDefaults = { publish: false, preview: false },
  folderDefaultsSchema = z.object({}),
  entrySchema,
  contentSchema,
  projectEntry,
}) {
  return {
    id,
    defaultRoute,
    entryRenderer,
    metadataDefaults,
    folderDefaultsSchema,
    entrySchema,
    contentSchema,
    projectEntry,
    markerSchema: z.strictObject({
      collection: z.literal(id),
      route: z.string().optional(),
      title: z.string().optional(),
      metaDescription: z.unknown().optional(),
      ...folderDefaultsSchema.shape,
    }),
  };
}

export function createCollectionRegistry(definitions) {
  const registry = new Map();

  for (const definition of definitions) {
    if (registry.has(definition.id)) {
      throw new Error(`Duplicate collection definition ${definition.id}`);
    }
    registry.set(definition.id, definition);
  }

  return registry;
}

/** Construct an entry URL without coupling Markdown conversion to a collection. */
export function collectionEntryUrl(definition, slug) {
  return `${definition.defaultRoute.replace(/\/$/, "")}/${slug}`;
}

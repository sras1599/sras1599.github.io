/**
 * Register notes at the website-owned /notes route. The marker authors the
 * collection index and may set publish or preview defaults; individual notes
 * provide public entry metadata; folder-sidebar entries may omit their date.
 * The importer projects shared navigation separately from collection metadata.
 */
import { defineCollectionDefinition } from "../definition.mjs";
import { baseIndexSchema } from "../schema.mjs";
import { notesEntrySchema, notesFolderDefaultsSchema } from "./schema.mjs";

export const notesCollectionDefinition = defineCollectionDefinition({
  id: "notes",
  route: "/notes",
  indexSchema: baseIndexSchema,
  metadataDefaults: {
    publish: false,
    preview: false,
    tags: [],
  },
  folderDefaultsSchema: notesFolderDefaultsSchema,
  entrySchema: notesEntrySchema,
  // Only the documented public fields leave the vault.
  projectEntry(data) {
    return {
      title: data.title,
      ...(data.description === undefined
        ? {}
        : { description: data.description }),
      ...(data.publishDate === undefined ? {} : { publishDate: data.publishDate }),
      slug: data.slug,
      tags: data.tags ?? [],
    };
  },
});

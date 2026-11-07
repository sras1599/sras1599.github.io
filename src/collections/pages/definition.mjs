/** Publish standalone vault pages relative to the site root, without a collection index. */
import { defineCollectionDefinition } from "../definition.mjs";
import { pagesEntrySchema, pagesFolderDefaultsSchema } from "./schema.mjs";

export const pagesCollectionDefinition = defineCollectionDefinition({
  id: "pages",
  route: "/",
  supportsDirectories: false,
  folderDefaultsSchema: pagesFolderDefaultsSchema,
  entrySchema: pagesEntrySchema,
  projectEntry(data) {
    return {
      title: data.title,
      slug: data.slug,
      ...(data.description === undefined ? {} : { description: data.description }),
    };
  },
});

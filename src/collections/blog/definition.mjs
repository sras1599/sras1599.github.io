/**
 * Register the blog's website-owned route and vault schemas. The importer uses
 * this definition to validate, project, and link content; Astro page modules own
 * presentation and list ordering.
 */
import { defineCollectionDefinition } from "../definition.mjs";
import { baseIndexSchema } from "../schema.mjs";
import { blogEntrySchema, blogFolderDefaultsSchema } from "./schema.mjs";

export const blogCollectionDefinition = defineCollectionDefinition({
  id: "blog",
  route: "/blog",
  indexSchema: baseIndexSchema,
  metadataDefaults: {
    publish: false,
    preview: false,
    displayInFeed: true,
    tags: [],
  },
  folderDefaultsSchema: blogFolderDefaultsSchema,
  entrySchema: blogEntrySchema,
  // Only these fields may leave the vault; other frontmatter stays private.
  projectEntry(data) {
    return {
      title: data.title,
      description: data.description,
      slug: data.slug,
      publishDate: data.publishDate,
      tags: data.tags ?? [],
      displayInFeed: data.displayInFeed ?? true,
      ...(data.series === undefined ? {} : { series: data.series }),
    };
  },
});

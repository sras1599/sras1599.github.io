import { defineCollectionDefinition } from "../definition.mjs";
import {
  blogContentSchema,
  blogEntrySchema,
  blogFolderDefaultsSchema,
} from "./schema.mjs";

export const blogCollectionDefinition = defineCollectionDefinition({
  id: "blog",
  defaultRoute: "/blog",
  entryRenderer: "blog",
  indexRenderer: "blog",
  metadataDefaults: {
    publish: false,
    preview: false,
    displayInFeed: true,
    tags: [],
  },
  folderDefaultsSchema: blogFolderDefaultsSchema,
  entrySchema: blogEntrySchema,
  contentSchema: blogContentSchema,
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

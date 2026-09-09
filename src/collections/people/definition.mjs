/**
 * Register the people collection's website-owned route and vault schemas. Each
 * person note owns its title and slug; its marker may provide publish and preview
 * defaults. Astro page modules own presentation and alphabetical list ordering.
 */
import { defineCollectionDefinition } from "../definition.mjs";
import { baseIndexSchema } from "../schema.mjs";
import {
  peopleEntrySchema,
  peopleFolderDefaultsSchema,
} from "./schema.mjs";

export const peopleCollectionDefinition = defineCollectionDefinition({
  id: "people",
  route: "/people",
  indexSchema: baseIndexSchema,
  folderDefaultsSchema: peopleFolderDefaultsSchema,
  entrySchema: peopleEntrySchema,
  // Only these fields may leave the vault; other frontmatter stays private.
  projectEntry(data) {
    return {
      title: data.title,
      slug: data.slug,
    };
  },
});

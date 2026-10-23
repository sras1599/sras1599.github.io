/**
 * Register the people collection's website-owned route and vault schemas. Each
 * person note supplies or derives its title and slug; its marker may provide publish and preview
 * defaults. Astro owns individual page presentation; there is no people index
 * page template even though an imported index document is required.
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

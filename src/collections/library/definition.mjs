/** Library publishes an introduction and category pages; media cards load separately from routed entries. */
import { defineCollectionDefinition } from "../definition.mjs";
import { baseIndexSchema, selectionSchema } from "../schema.mjs";

export const libraryCollectionDefinition = defineCollectionDefinition({
  id: "library",
  route: "/library",
  supportsDirectories: false,
  folderDefaultsSchema: selectionSchema.partial(),
  indexSchema: baseIndexSchema.extend({
    title: baseIndexSchema.shape.title.default("Library"),
    metaDescription: baseIndexSchema.shape.metaDescription.default(
      "A library of the books, films, and other media I've consumed.",
    ),
  }),
});

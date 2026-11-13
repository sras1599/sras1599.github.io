/** Library currently publishes its root introduction; category records are not entries. */
import { defineCollectionDefinition } from "../definition.mjs";
import { baseIndexSchema } from "../schema.mjs";

export const libraryCollectionDefinition = defineCollectionDefinition({
  id: "library",
  route: "/library",
  supportsDirectories: false,
  indexSchema: baseIndexSchema.extend({
    title: baseIndexSchema.shape.title.default("Library"),
    metaDescription: baseIndexSchema.shape.metaDescription.default(
      "A library of the books, films, and other media I've consumed.",
    ),
  }),
});

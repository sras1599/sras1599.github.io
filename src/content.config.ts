/**
 * Register Astro's build-time blog, notes, people, and pages content collections.
 * Ordinary vault entries load by collection ID, while authored collection
 * indexes, directory cards, and Library media cards load from dedicated generated directories
 * so they never enter entry queries or entry schemas.
 */
import { defineCollection } from "astro:content";
import {
  collectionIndexLoader,
  collectionLoader,
  directoryCardLoader,
  libraryItemLoader,
} from "./collections/loader";
import { blogContentSchema } from "./collections/blog/schema.mjs";
import { notesContentSchema } from "./collections/notes/schema.mjs";
import { peopleContentSchema } from "./collections/people/schema.mjs";
import { pagesContentSchema } from "./collections/pages/schema.mjs";
import { indexContentSchema } from "./collections/schema.mjs";
import { directoryCardSchema } from "./collections/sidebar.mjs";
import { libraryCategoryContentSchema, libraryItemContentSchema } from "./collections/library/schema.mjs";

const blog = defineCollection({
  loader: collectionLoader("blog"),
  schema: blogContentSchema,
});

const people = defineCollection({
  loader: collectionLoader("people"),
  schema: peopleContentSchema,
});

const notes = defineCollection({
  loader: collectionLoader("notes"),
  schema: notesContentSchema,
});

const collectionIndexes = defineCollection({
  loader: collectionIndexLoader(),
  schema: indexContentSchema.extend({
    categories: libraryCategoryContentSchema.array().optional(),
  }),
});

const pages = defineCollection({
  loader: collectionLoader("pages"),
  schema: pagesContentSchema,
});

const directoryCards = defineCollection({
  loader: directoryCardLoader(),
  schema: directoryCardSchema,
});

const libraryItems = defineCollection({
  loader: libraryItemLoader(),
  schema: libraryItemContentSchema,
});

export const collections = { blog, notes, people, pages, collectionIndexes, directoryCards, libraryItems };

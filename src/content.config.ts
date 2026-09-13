/**
 * Register Astro's build-time blog, notes, and people content collections.
 * Ordinary vault entries load by collection ID, while authored collection
 * indexes load from a dedicated generated directory so they never enter entry
 * queries or entry schemas.
 */
import { defineCollection } from "astro:content";
import {
  collectionIndexLoader,
  collectionLoader,
} from "./collections/loader";
import { blogContentSchema } from "./collections/blog/schema.mjs";
import { notesContentSchema } from "./collections/notes/schema.mjs";
import { peopleContentSchema } from "./collections/people/schema.mjs";
import { indexContentSchema } from "./collections/schema.mjs";

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
  schema: indexContentSchema,
});

export const collections = { blog, notes, people, collectionIndexes };

/**
 * Register Astro's build-time content collections. Ordinary vault entries load
 * by collection ID, while authored collection indexes load from a dedicated
 * generated directory so they never enter entry queries or entry schemas.
 */
import { defineCollection } from "astro:content";
import {
  collectionIndexLoader,
  collectionLoader,
} from "./collections/loader";
import { blogContentSchema } from "./collections/blog/schema.mjs";
import { indexContentSchema } from "./collections/schema.mjs";

const blog = defineCollection({
  loader: collectionLoader("blog"),
  schema: blogContentSchema,
});

const collectionIndexes = defineCollection({
  loader: collectionIndexLoader(),
  schema: indexContentSchema,
});

export const collections = { blog, collectionIndexes };

import { defineCollection } from "astro:content";
import { collectionLoader } from "./collections/loader";
import { productionCollectionRegistry } from "./collections/registry.mjs";

const blogDefinition = productionCollectionRegistry.get("blog");
if (!blogDefinition) {
  throw new Error("Production collection registry is missing blog");
}

const blog = defineCollection({
  loader: collectionLoader(blogDefinition.id),
  schema: blogDefinition.contentSchema,
});

export const collections = { blog };

import { createCollectionRegistry } from "./definition.mjs";
import { blogCollectionDefinition } from "./blog/definition.mjs";

// This is the single authoritative set of production collection IDs.
export const productionCollectionDefinitions = Object.freeze([
  blogCollectionDefinition,
]);

export const productionCollectionRegistry = createCollectionRegistry(
  productionCollectionDefinitions,
);

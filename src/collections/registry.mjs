import { createCollectionRegistry } from "./definition.mjs";
import { blogCollectionDefinition } from "./blog/definition.mjs";

// This is the single authoritative set of production collection IDs.
const collectionDefinitions = Object.freeze([
  blogCollectionDefinition,
]);

export const CollectionRegistry = createCollectionRegistry(
  collectionDefinitions,
);

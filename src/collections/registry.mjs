import { createCollectionRegistry } from "./definition.mjs";
import { blogCollectionDefinition } from "./blog/definition.mjs";
import { peopleCollectionDefinition } from "./people/definition.mjs";

// This is the single authoritative set of production collection IDs.
const collectionDefinitions = Object.freeze([
  blogCollectionDefinition,
  peopleCollectionDefinition,
]);

export const CollectionRegistry = createCollectionRegistry(
  collectionDefinitions,
);

/**
 * Assemble the authoritative production collection registry shared by the vault
 * importer, route helpers, and browser previews. Each imported definition owns
 * one collection ID, its public route, and its metadata contracts.
 */
import { createCollectionRegistry } from "./definition.mjs";
import { blogCollectionDefinition } from "./blog/definition.mjs";
import { notesCollectionDefinition } from "./notes/definition.mjs";
import { peopleCollectionDefinition } from "./people/definition.mjs";

// This is the single authoritative set of production collection IDs.
const collectionDefinitions = Object.freeze([
  blogCollectionDefinition,
  notesCollectionDefinition,
  peopleCollectionDefinition,
]);

export const CollectionRegistry = createCollectionRegistry(
  collectionDefinitions,
);

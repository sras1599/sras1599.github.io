/**
 * Define the vault and generated-content metadata accepted by people entries.
 * Authors must put title and slug on each note, while publish and preview may
 * come from either the note or its owning marker. Only title and slug are
 * projected into the website's generated Markdown.
 */
import {
  baseContentSchema,
  baseEntrySchema,
  selectionSchema,
} from "../schema.mjs";

export const peopleFolderDefaultsSchema = selectionSchema.partial();

export const peopleEntrySchema = baseEntrySchema.loose();

export const peopleContentSchema = baseContentSchema;

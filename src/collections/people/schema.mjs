/**
 * Define the vault and generated-content metadata accepted by people entries.
 * Title and slug are authored or derived inside sidebar folders; publish and preview may
 * come from either the note or its owning marker. The collection projects title
 * and slug; the importer separately projects shared navigation metadata.
 */
import {
  baseContentSchema,
  baseEntrySchema,
  selectionSchema,
} from "../schema.mjs";

export const peopleFolderDefaultsSchema = selectionSchema.partial();

export const peopleEntrySchema = baseEntrySchema.loose();

export const peopleContentSchema = baseContentSchema;

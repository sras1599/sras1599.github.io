/**
 * Define source and generated metadata for notes. Markers may only provide
 * publish and preview folder defaults; each selected note supplies its public
 * identity and date, with an optional description and tags. Source schemas stay
 * loose so private Obsidian properties can remain in the vault, while the
 * collection definition explicitly projects only website-owned fields.
 */
import { z } from "zod";
import {
  baseContentSchema,
  baseEntrySchema,
  nonemptyStringSchema,
  publishDateSchema,
  selectionSchema,
} from "../schema.mjs";

export const notesFolderDefaultsSchema = selectionSchema.partial();

export const notesEntrySchema = baseEntrySchema
  .extend({
    description: nonemptyStringSchema.optional(),
    publishDate: publishDateSchema,
    tags: z
      .array(z.string({ error: "must be a string" }), {
        error: "must be a list of strings",
      })
      .optional(),
  })
  .loose();

export const notesContentSchema = baseContentSchema.extend({
  description: z.string().optional(),
  publishDate: z.coerce.date(),
  tags: z.array(z.string()).default([]),
});

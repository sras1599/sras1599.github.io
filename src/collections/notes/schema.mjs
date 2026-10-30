/**
 * Define source and generated metadata for notes. Sidebar entries may derive
 * identity from their folder and omit dates; ordinary notes require dates.
 * Description and tags remain optional. Source schemas stay
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

const tocSchema = z.boolean({ error: "must be a boolean" });

export const notesFolderDefaultsSchema = selectionSchema.partial().extend({
  toc: tocSchema.optional(),
});

export const notesEntrySchema = baseEntrySchema
  .extend({
    description: nonemptyStringSchema.optional(),
    publishDate: publishDateSchema.optional(),
    toc: tocSchema.optional(),
    tags: z
      .array(z.string({ error: "must be a string" }), {
        error: "must be a list of strings",
      })
      .optional(),
  })
  .loose()
  .refine((data) => data.navigation || data.publishDate, {
    path: ["publishDate"],
    message: "is required outside sidebar folders",
  });

export const notesContentSchema = baseContentSchema.extend({
  description: z.string().optional(),
  publishDate: z.coerce.date().optional(),
  toc: tocSchema.default(true),
  tags: z.array(z.string()).default([]),
}).refine((data) => data.navigation || data.publishDate, {
  path: ["publishDate"],
  message: "is required outside sidebar folders",
});

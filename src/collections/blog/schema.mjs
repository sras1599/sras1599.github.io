import { z } from "zod";
import {
  baseContentSchema,
  baseEntrySchema,
  nonemptyStringSchema,
  publishDateSchema,
  selectionSchema,
  slugSegmentSchema,
} from "../schema.mjs";

export const blogFolderDefaultsSchema = selectionSchema.partial().extend({
  displayInFeed: z.boolean({ error: "must be a boolean" }).optional(),
  tags: z
    .array(z.string({ error: "must be a string" }), {
      error: "must be a list of strings",
    })
    .optional(),
});

export const blogEntrySchema = baseEntrySchema
  .extend({
    description: nonemptyStringSchema,
    publishDate: publishDateSchema,
    tags: z.array(z.string({ error: "must be a string" }), {
      error: "must be a list of strings",
    }),
    displayInFeed: z.boolean({ error: "must be a boolean" }),
    series: slugSegmentSchema.optional(),
  })
  .loose();

export const blogContentSchema = baseContentSchema.extend({
  description: z.string(),
  publishDate: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  displayInFeed: z.boolean().default(true),
  series: slugSegmentSchema.optional(),
});

import { z } from "zod";
import {
  baseContentSchema,
  baseEntrySchema,
  nonemptyStringSchema,
  selectionSchema,
  slugSegmentSchema,
  slugSchema,
} from "../schema.mjs";

const publishDateSchema = z
  .string({ error: "must be a valid YYYY-MM-DD date" })
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "must be a valid YYYY-MM-DD date",
  );

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

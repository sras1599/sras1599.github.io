import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const nonemptyStringSchema = z
  .string({ error: "must be a nonempty string" })
  .refine((value) => value.trim(), "must be a nonempty string");

export const slugSchema = z
  .string({
    error: "must contain lowercase letters, digits, and single hyphens",
  })
  .regex(
    slugPattern,
    "must contain lowercase letters, digits, and single hyphens",
  );

export const selectionSchema = z.object({
  publish: z.boolean({ error: "must be a boolean" }),
  preview: z.boolean({ error: "must be a boolean" }),
});

export const baseEntrySchema = selectionSchema.extend({
  title: nonemptyStringSchema,
  slug: slugSchema,
});

export const baseContentSchema = z.object({
  title: z.string(),
  slug: slugSchema,
});

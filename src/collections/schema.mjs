/**
 * Shared Zod schemas for collection definitions. These schemas validate the
 * common selection and identity fields used by entries plus the authored title
 * and description required by collection indexes.
 */
import { z } from "zod";
import { collectionSlugPattern } from "./definition.mjs";

const slugSegmentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const nonemptyStringSchema = z
  .string({ error: "must be a nonempty string" })
  .refine((value) => value.trim(), "must be a nonempty string");

export const slugSchema = z
  .string({
    error:
      "must contain lowercase letters, digits, and single hyphens in slash-separated segments",
  })
  .regex(
    collectionSlugPattern,
    "must contain lowercase letters, digits, and single hyphens in slash-separated segments",
  );

export const slugSegmentSchema = z
  .string({
    error: "must contain lowercase letters, digits, and single hyphens",
  })
  .regex(
    slugSegmentPattern,
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

export const baseIndexSchema = z.strictObject({
  title: nonemptyStringSchema,
  metaDescription: nonemptyStringSchema,
});

export const indexContentSchema = baseIndexSchema.extend({
  collection: z.string(),
}).loose();

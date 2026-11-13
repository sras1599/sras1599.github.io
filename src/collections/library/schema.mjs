import { z } from "zod";
import { nonemptyStringSchema, selectionSchema, slugSchema } from "../schema.mjs";

export const libraryCategorySchema = z.object({
  title: nonemptyStringSchema,
  slug: slugSchema,
});

export const libraryCategoryMarkerSchema = selectionSchema.partial()
  .extend(libraryCategorySchema.shape)
  .strict();

export const libraryCategoryContentSchema = libraryCategorySchema.extend({
  itemCount: z.number().int().nonnegative(),
});

const ratingSchema = z.number({ error: "must be a numeric rating, not a string" })
  .min(0).max(5).multipleOf(0.5);
const yearSchema = z.number().int().min(1).max(9999);
const linkSchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.url().refine((value) => /^https?:\/\//i.test(value), "must use HTTP or HTTPS").optional(),
);

const commonItemSchema = z.object({
  year: yearSchema.optional(),
  rating: ratingSchema.optional(),
  link: linkSchema,
  creator: nonemptyStringSchema.optional(),
}).loose();

export const libraryItemSourceSchemas = {
  books: commonItemSchema.extend({ author: nonemptyStringSchema }),
  "film-and-tv": commonItemSchema.extend({
    year: yearSchema,
    director: nonemptyStringSchema.optional(),
  }),
  music: commonItemSchema.extend({ artist: nonemptyStringSchema }),
};
export const libraryDefaultItemSourceSchema = commonItemSchema;

export const libraryItemContentSchema = z.object({
  category: slugSchema,
  title: nonemptyStringSchema,
  creator: nonemptyStringSchema.optional(),
  year: yearSchema.optional(),
  rating: ratingSchema.optional(),
  link: z.url().optional(),
});

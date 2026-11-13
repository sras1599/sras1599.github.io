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

// Partial dates retain authored precision. A range ends at the end of its final
// year/month/day, allowing comparisons without inventing an exact reading date.
function readingDateBounds(value) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return;
  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  if (year < 1 || month < 1 || month > 12) return;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return;
  const endMonth = match[2] ? month : 12;
  const endDay = match[3] ? day : days[endMonth - 1];
  return [year * 10000 + month * 100 + day, year * 10000 + endMonth * 100 + endDay];
}

export const libraryReadSchema = z.union([
  z.string(),
  z.number().int().min(1).max(9999).transform((year) => String(year).padStart(4, "0")),
]).refine((value) => {
  const parts = value.split("..");
  if (parts.length > 2) return false;
  const first = readingDateBounds(parts[0]);
  const last = readingDateBounds(parts.at(-1));
  return first && last && first[0] <= last[1];
}, "must be YYYY, YYYY-MM, YYYY-MM-DD, or a non-reversed range joined by ..");

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
  reads: z.array(libraryReadSchema).default([]),
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
  reads: z.array(libraryReadSchema),
});

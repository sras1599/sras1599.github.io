/** Standalone pages publish only identity and an optional description, without dates or navigation. */
import { z } from "zod";
import {
  nonemptyStringSchema,
  selectionSchema,
  slugSchema,
} from "../schema.mjs";

export const pagesFolderDefaultsSchema = selectionSchema.partial();

const pageProperties = {
  title: nonemptyStringSchema,
  slug: slugSchema,
  description: nonemptyStringSchema.optional(),
};

export const pagesEntrySchema = selectionSchema.extend(pageProperties).loose();

export const pagesContentSchema = z.object(pageProperties);

/** Shared marker configuration and public navigation metadata for every collection. */
import { z } from "zod";
import { collectionSlugPattern } from "./slug.mjs";

const slug = z.string().regex(collectionSlugPattern, "must use lowercase letters, digits, and single hyphens in slash-separated segments");
const label = z.string().refine((value) => Boolean(value.trim()), "must be nonempty");
const tagsSchema = z.array(z.string({ error: "must be a string" }), {
  error: "must be a list of strings",
});

export const sidebarSchema = z.strictObject({ title: label, slug });

/** Directory markers own card Markdown and establish a sidebar root. */
export function withDirectoryProperties(schema) {
  const supportsTagDefaults = Object.hasOwn(schema.shape, "tags");
  return schema.extend({
    directory: z.boolean().optional(),
    title: label.optional(),
    slug: slug.optional(),
    tags: tagsSchema.optional(),
  }).superRefine((data, context) => {
    if (data.directory === true) {
      for (const property of ["title", "slug"]) {
        if (data[property] === undefined) {
          context.addIssue({ code: "custom", path: [property], message: "is required when directory is true" });
        }
      }
      if (data.metaDescription !== undefined) {
        context.addIssue({ code: "custom", path: ["metaDescription"], message: "belongs to a collection index, not a directory marker" });
      }
    } else {
      if (data.slug !== undefined) {
        context.addIssue({ code: "custom", path: ["slug"], message: "is only allowed when directory is true" });
      }
      if (!supportsTagDefaults && data.tags !== undefined) {
        context.addIssue({ code: "custom", path: ["tags"], message: "is only allowed when directory is true for this collection" });
      }
    }
  });
}

export const directoryCardSchema = sidebarSchema.extend({
  collection: label,
  tags: tagsSchema.default([]),
});

const locationSchema = z.strictObject({
  root: sidebarSchema,
  folders: z.array(label),
});

export const navigationSchema = locationSchema.extend({
  overview: z.boolean(),
  // A nested root's overview is also a leaf link in its parent explorer.
  parent: locationSchema.optional(),
});

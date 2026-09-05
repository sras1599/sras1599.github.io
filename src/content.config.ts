import { defineCollection } from "astro:content";
import { blogLoader } from "../scripts/blog-loader";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: blogLoader(),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }),
});

export const collections = { blog };

import BlogEntry from "./blog/Entry.astro";
import BlogIndex from "./blog/Index.astro";

/** Static Astro component imports keyed by website-owned renderer IDs. */
export const collectionRenderers: Record<
  string,
  { entry: any; index?: any }
> = {
  blog: {
    entry: BlogEntry,
    index: BlogIndex,
  },
};

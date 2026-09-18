/**
 * Configure the static Astro website, its Markdown rendering, and local-only
 * development tools. The admin integration registers routes only for Astro's
 * dev command, leaving the production route graph and output unchanged.
 */
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import developmentAdmin from "./src/dev-admin/integration.mjs";

const removeFootnoteBacklinks = {
  name: "remove-footnote-backlinks",
  element: {
    filter: ["a"],
    visit(node, context) {
      if (Object.hasOwn(node.properties ?? {}, "dataFootnoteBackref")) {
        context.removeNode(node);
      }
    },
  },
};

export default defineConfig({
  site: "https://rasmalai.dev",
  output: "static",
  trailingSlash: "never",
  integrations: [developmentAdmin()],
  markdown: {
    processor: satteri({ hastPlugins: [removeFootnoteBacklinks] }),
  },
});

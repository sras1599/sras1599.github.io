import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";

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
  markdown: {
    processor: satteri({ hastPlugins: [removeFootnoteBacklinks] }),
  },
});

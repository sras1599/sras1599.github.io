/**
 * Configure the static Astro website, its Markdown rendering, and local-only
 * development tools. The admin integration registers routes only for Astro's
 * dev command, leaving the production route graph and output unchanged.
 */
import { defineConfig } from "astro/config";
import { satteri } from "@astrojs/markdown-satteri";
import developmentAdmin from "./src/dev-admin/integration.mjs";
import { markdownHighlights } from "./scripts/markdown-highlights.mjs";

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

const imageCaptions = {
  name: "image-captions",
  element: [{
    filter: ["p"],
    visit(paragraph, context) {
      if (isInsideFigure(paragraph, context)) return;

      const anchors = paragraph.children.filter(isBlockAnchor);
      const contents = paragraph.children.filter((node) =>
        !(node.type === "text" && !node.value.trim()) &&
        !(node.type === "element" && node.tagName === "br") &&
        !isBlockAnchor(node),
      );
      if (!contents.length) return;

      const images = contents.map(imageFromContent);
      if (images.some((image) => !image)) return;
      if (!images.some((image) => hasCaption(image))) return;

      // Multiple embeds can share a Markdown paragraph. Figures need a block
      // wrapper instead of a p, and their margins replace the separating brs.
      const figures = contents.map((content, index) =>
        captionedImage(content, images[index]),
      );
      if (figures.length === 1) {
        const figure = figures[0];
        figure.children.unshift(...anchors);
        const classes = paragraph.properties?.className ?? [];
        figure.properties = {
          ...paragraph.properties,
          ...figure.properties,
          className: [
            ...(Array.isArray(classes) ? classes : String(classes).split(/\s+/)),
            ...figure.properties.className,
          ],
        };
        context.replaceNode(paragraph, figure);
        return;
      }

      context.replaceNode(paragraph, {
        type: "element",
        tagName: "div",
        properties: paragraph.properties,
        children: [...anchors, ...figures],
      });
    },
  }, {
    filter: ["img"],
    visit(image, context) {
      if (!hasCaption(image) || isInsideFigure(image, context)) return;

      let content = image;
      let parent = context.parent(content);
      if (parent?.type === "element" && parent.tagName === "a") {
        if (!hasOnlyChild(parent, content, context)) return;
        content = parent;
        parent = context.parent(content);
      }

      if (!parent) return;
      // Top-level HTML images are standalone blocks even beside other blocks.
      if (parent.type !== "root" && !hasOnlyChild(parent, content, context)) return;

      const isBlock = parent.type === "root" || (
        parent.type === "element" &&
        ["div", "section", "article", "aside", "main", "li", "td", "th", "blockquote"].includes(parent.tagName)
      );
      if (!isBlock) return;

      context.replaceNode(content, captionedImage(content, image));
    },
  }],
};

function isInsideFigure(node, context) {
  for (let ancestor = context.parent(node); ancestor; ancestor = context.parent(ancestor)) {
    if (ancestor.type === "element" && ancestor.tagName === "figure") return true;
  }
  return false;
}

function imageFromContent(content) {
  if (content.type !== "element") return;
  if (content.tagName === "img") return content;
  if (content.tagName !== "a") return;

  const children = content.children.filter((node) =>
    !(node.type === "text" && !node.value.trim()),
  );
  if (children.length === 1 && children[0].type === "element" && children[0].tagName === "img") {
    return children[0];
  }
}

function hasCaption(image) {
  return typeof image.properties?.alt === "string" && Boolean(image.properties.alt.trim());
}

function captionedImage(content, image) {
  if (!hasCaption(image)) return content;

  const classes = image.properties?.className;
  const centered = Array.isArray(classes)
    ? classes.includes("content-image-center")
    : typeof classes === "string" && classes.split(/\s+/).includes("content-image-center");
  const figureClasses = ["content-image-figure"];
  if (centered) figureClasses.push("content-image-center");

  return {
    type: "element",
    tagName: "figure",
    properties: { className: figureClasses },
    children: [content, {
      type: "element",
      tagName: "figcaption",
      properties: {},
      children: [{ type: "text", value: image.properties.alt }],
    }],
  };
}

function hasOnlyChild(parent, child, context) {
  const childIndex = context.indexOf(child);
  return parent.children.every((node, index) =>
    index === childIndex || (node.type === "text" && !node.value.trim()) || isBlockAnchor(node),
  );
}

// List-item anchors stay inline in generated Markdown. They must not prevent an
// otherwise standalone image from receiving its usual figure and caption.
function isBlockAnchor(node) {
  return node.type === "element" && node.tagName === "span" &&
    typeof node.properties?.id === "string" && node.properties.id.startsWith("^") &&
    node.children.length === 0;
}

export default defineConfig({
  site: "https://rasmalai.dev",
  output: "static",
  trailingSlash: "never",
  integrations: [developmentAdmin()],
  markdown: {
    processor: satteri({
      features: { rawHtml: true },
      mdastPlugins: [markdownHighlights],
      hastPlugins: [removeFootnoteBacklinks, imageCaptions],
    }),
  },
});

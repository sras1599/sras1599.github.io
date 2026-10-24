/**
 * Preserve highlight delimiters across vault serialization and interpret them
 * in Satteri. Source spelling distinguishes delimiters from escaped/entity '='.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";

const entityParser = unified().use(remarkParse);

export function highlightTextParts(node, source) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return [{ type: "text", value: node.value }];

  const raw = source.slice(start, end);
  const tokens = /\\[!-/:-@\[-`{-~]|&(?:#[xX][\da-fA-F]+|#\d+|[A-Za-z][A-Za-z\d]+);|=+/g;
  const parts = [];
  let cursor = 0;

  for (const match of raw.matchAll(tokens)) {
    const token = match[0];
    let decoded = token;
    if (token.startsWith("\\")) decoded = token.slice(1);
    if (token.startsWith("&")) {
      decoded = entityParser.parse(token).children[0]?.children?.[0]?.value ?? token;
    }

    const equals = decoded.match(/=/g)?.length ?? 0;
    for (let index = 0; index < equals;) {
      const offset = node.value.indexOf("=", cursor);
      if (offset === -1) break;
      if (offset > cursor) parts.push({ type: "text", value: node.value.slice(cursor, offset) });

      const delimiter = token === "==";
      const length = delimiter ? 2 : 1;
      parts.push({ type: delimiter ? "delimiter" : "literal", value: "=".repeat(length) });
      cursor = offset + length;
      index += length;
    }
  }

  if (cursor < node.value.length) parts.push({ type: "text", value: node.value.slice(cursor) });
  return parts;
}

/** Serialize just a surviving text slice after wiki links have been rewritten. */
export function preservedHighlightText(parts, start, end) {
  const nodes = [];
  let offset = 0;
  for (const part of parts) {
    const value = part.value.slice(Math.max(0, start - offset), Math.max(0, end - offset));
    offset += part.value.length;
    if (!value) continue;

    if (part.type === "text") nodes.push({ type: "text", value });
    // Raw inline nodes bypass remark-stringify's automatic '=' escaping.
    else nodes.push({ type: "html", value: part.type === "delimiter" ? value : "&#61;".repeat(value.length) });
  }
  return nodes;
}

export const markdownHighlights = {
  name: "markdown-highlights",
  options: { position: true },
  before(root, context) {
    function transform(parent) {
      if (!parent.children) return parent;

      const children = parent.children.flatMap((child) => {
        if (child.type !== "text") return [transform(child)];
        return highlightTextParts(child, context.source).map((part) => ({
          type: part.type === "delimiter" ? "highlightDelimiter" : "text",
          value: part.value,
        }));
      });
      const result = [];
      for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (child.type !== "highlightDelimiter") {
          result.push(child);
          continue;
        }

        const closing = children.findIndex((candidate, next) =>
          next > index && candidate.type === "highlightDelimiter",
        );
        const contents = closing === -1 ? [] : children.slice(index + 1, closing);
        const hasContent = contents.some((node) => node.type !== "text" || node.value.trim());
        if (!hasContent) {
          result.push({ type: "text", value: "==" });
          if (closing !== -1) {
            result.push(...contents, { type: "text", value: "==" });
            index = closing;
          }
          continue;
        }

        result.push({ type: "html", value: "<mark>" }, ...contents, { type: "html", value: "</mark>" });
        index = closing;
      }
      return { ...parent, children: result };
    }

    context.replaceNode(root, transform(root));
  },
};

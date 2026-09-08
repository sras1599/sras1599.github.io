import { parse } from "yaml";

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Parse a Markdown document without applying publishing or schema rules. */
export function parseMarkdownDocument(text, { file }) {
  const source = text.replace(/^\uFEFF/, "");
  const match = source.match(frontmatterPattern);

  if (!match) {
    return { metadata: undefined, body: source, hasFrontmatter: false };
  }

  try {
    return {
      metadata: parse(match[1]),
      body: source.slice(match[0].length),
      hasFrontmatter: true,
    };
  } catch (cause) {
    const error = new Error(`${file}: invalid YAML: ${cause.message}`, {
      cause,
    });
    // The current importer uses the source only to preserve its existing
    // malformed-but-unselected-note behavior. Parsing policy stays here.
    error.frontmatter = match[1];
    throw error;
  }
}

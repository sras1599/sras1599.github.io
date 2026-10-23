/**
 * Index Obsidian block declarations and replace them with native HTML anchors in
 * a parsed Markdown tree. Only selected, individually addressable documents pass
 * through here; private notes and directory-card bodies are never indexed.
 */
const blockTypes = new Set([
  "paragraph", "heading", "blockquote", "list", "table", "code", "thematicBreak",
]);
const declarationPattern = /(?:^|[ \t\r\n]+)\^([A-Za-z0-9_-]+)[ \t]*$/;

/** Mutate tree in place and return its case-sensitive set of published IDs. */
export function prepareBlockAnchors(tree, source, file) {
  const ids = new Set();
  const anchorsByNode = new Map();
  const declarations = new Set();

  function register(node, id) {
    if (ids.has(id)) {
      throw new Error(`${file}: duplicate block ID ${id}`);
    }
    ids.add(id);
    const anchors = anchorsByNode.get(node) ?? [];
    anchors.push(id);
    anchorsByNode.set(node, anchors);
  }

  function collect(parent) {
    for (const [index, node] of parent.children.entries()) {
      if (node.type === "paragraph" || node.type === "heading") {
        const declaration = findDeclaration(node, source);
        if (declaration) {
          const { id, text, suffixIndex, standalone } = declaration;
          if (standalone) {
            const previous = parent.children[index - 1];
            if (!previous || declarations.has(previous) || !blockTypes.has(previous.type)) {
              throw new Error(`${file}: orphan block ID ${id}; put it after a Markdown block`);
            }
            register(previous, id);
            declarations.add(node);
            continue;
          }

          text.value = text.value.slice(0, suffixIndex);
          // A declaration on the bullet's first paragraph identifies that item,
          // including any continuation paragraphs and nested lists it contains.
          const target = node.type === "paragraph" && parent.type === "listItem" && index === 0
            ? parent
            : node;
          register(target, id);
        }
      }
      if (node.children) collect(node);
    }
  }

  function insert(parent) {
    const children = [];
    for (const node of parent.children) {
      if (declarations.has(node)) continue;
      if (node.children) insert(node);

      const inline = node.type === "listItem" ||
        (parent.type === "listItem" && node.type === "paragraph");
      // A div is a Markdown HTML block; a standalone empty span can acquire an
      // unwanted paragraph wrapper when the generated Markdown is parsed again.
      const tag = inline ? "span" : "div";
      const anchors = (anchorsByNode.get(node) ?? []).map((id) => ({
        type: "html", value: `<${tag} id="${id}"></${tag}>`,
      }));
      // Separate HTML blocks inside a list item can make a tight list loose.
      // Keep these anchors inline, before the item's existing content instead.
      if (node.type === "listItem" && anchors.length) {
        node.children[0].children.unshift(...anchors);
      } else if (parent.type === "listItem" && node.type === "paragraph") {
        node.children.unshift(...anchors);
      } else {
        children.push(...anchors);
      }
      children.push(node);
    }
    parent.children = children;
  }

  collect(tree);
  insert(tree);
  return ids;
}

function findDeclaration(node, source) {
  const text = node.children.at(-1);
  if (text?.type !== "text") return;

  const suffix = declarationPattern.exec(text.value);
  if (!suffix) return;

  // Parsed text has already lost escapes and decoded entities. Check the source
  // too, so literal \^example and &#94;example never become declarations.
  const raw = source.slice(text.position.start.offset, text.position.end.offset);
  const rawSuffix = declarationPattern.exec(raw);
  if (!rawSuffix || rawSuffix[1] !== suffix[1]) return;

  const caretOffset = text.position.start.offset + rawSuffix.index + rawSuffix[0].indexOf("^");
  if (caretOffset !== node.position.start.offset && !/\s/.test(source[caretOffset - 1])) {
    return;
  }

  return {
    id: `^${suffix[1]}`,
    text,
    suffixIndex: suffix.index,
    standalone: node.type === "paragraph" && node.children.length === 1 &&
      !text.value.slice(0, suffix.index).trim(),
  };
}

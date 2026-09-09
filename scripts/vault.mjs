import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { stringify } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { slug as heading } from "github-slugger";
import { z } from "zod";
import { parseMarkdownDocument } from "./markdown-document.mjs";

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);
const raster = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nonemptyStringSchema = z
  .string({ error: "must be a nonempty string" })
  .refine((value) => value.trim(), "must be a nonempty string");
const slugSchema = z
  .string({
    error: "must contain lowercase letters, digits, and single hyphens",
  })
  .regex(
    slugPattern,
    "must contain lowercase letters, digits, and single hyphens",
  );
const publishDateSchema = z
  .string({ error: "must be a valid YYYY-MM-DD date" })
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "must be a valid YYYY-MM-DD date",
  );
const blogFolderDefaultsSchema = z.object({
  publish: z.boolean({ error: "must be a boolean" }).optional(),
  preview: z.boolean({ error: "must be a boolean" }).optional(),
  displayInFeed: z.boolean({ error: "must be a boolean" }).optional(),
  tags: z
    .array(z.string({ error: "must be a string" }), {
      error: "must be a list of strings",
    })
    .optional(),
});
const blogMarkerSchema = z.strictObject({
  collection: z.literal("blog"),
  route: z.string().optional(),
  title: z.string().optional(),
  metaDescription: z.unknown().optional(),
  ...blogFolderDefaultsSchema.shape,
});
const blogEntrySchema = z
  .object({
    publish: z.boolean({ error: "must be a boolean" }),
    preview: z.boolean({ error: "must be a boolean" }),
    title: nonemptyStringSchema,
    description: nonemptyStringSchema,
    slug: slugSchema,
    publishDate: publishDateSchema,
    tags: z.array(z.string({ error: "must be a string" }), {
      error: "must be a list of strings",
    }),
    displayInFeed: z.boolean({ error: "must be a boolean" }),
    series: slugSchema.optional(),
  })
  .loose();
const collectionRegistry = new Map([
  [
    "blog",
    {
      id: "blog",
      metadataDefaults: {
        publish: false,
        preview: false,
        displayInFeed: true,
        tags: [],
      },
      folderDefaultsSchema: blogFolderDefaultsSchema,
      markerSchema: blogMarkerSchema,
      entrySchema: blogEntrySchema,
    },
  ],
]);
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
      ],
  );

/** Prepare all selected content before touching generated output. The vault is read-only. */
export async function importVault({
  vaultPath,
  projectRoot = process.cwd(),
  preview = false,
}) {
  if (!vaultPath) {
    throw new Error(
      "Set VAULT_PATH in .env to an accessible Obsidian vault directory.",
    );
  }

  const root = path.resolve(vaultPath);
  let discovery;
  try {
    discovery = await discoverVault(root);
  } catch (error) {
    if (!error.code) throw error;
    throw new Error(`Cannot read VAULT_PATH (${root}): ${error.message}`);
  }

  const notes = await readSelectedNotes(
    root,
    discovery.ownedMarkdown,
    preview,
  );
  validateUniqueSlugs(notes);
  const context = {
    root,
    files: discovery.files,
    fileSet: new Set(discovery.files),
    byFile: new Map(notes.map((note) => [note.file, note])),
    assets: new Map(),
  };
  const output = new Map();

  // Convert everything before updating the last successful import.
  for (const note of notes) {
    output.set(`${note.data.slug}.md`, await renderNote(note, context));
  }

  await syncGeneratedFiles(
    path.join(projectRoot, "public/_vault"),
    context.assets,
  );
  await syncGeneratedFiles(path.join(projectRoot, ".generated/blog"), output);
  return { entries: notes.length, assets: context.assets.size };
}

async function discoverVault(
  root,
  dir = "",
  inheritedOwner,
  result = { files: [], markers: [], ownedMarkdown: new Map() },
) {
  const entries = await fs.readdir(path.join(root, dir), {
    withFileTypes: true,
  });
  const marker = entries.find(
    (entry) =>
      entry.name === "_website.md" &&
      entry.isFile() &&
      !entry.isSymbolicLink(),
  );
  let owner = inheritedOwner;

  if (marker) {
    const markerPath = path.posix.join(dir, marker.name);
    const source = await fs.readFile(path.join(root, markerPath), "utf8");
    const document = parseMarkdownDocument(source, { file: markerPath });

    if (!document.hasFrontmatter) {
      throw new Error(`${markerPath}: marker must have leading YAML frontmatter`);
    }
    if (
      !document.metadata ||
      typeof document.metadata !== "object" ||
      Array.isArray(document.metadata)
    ) {
      throw new Error(`${markerPath}: marker frontmatter must be a YAML mapping`);
    }

    if (Object.hasOwn(document.metadata, "collection")) {
      const collectionId = document.metadata.collection;
      if (typeof collectionId !== "string" || !collectionId.trim()) {
        throw new Error(
          `${markerPath}: collection must be a nonempty string`,
        );
      }

      const definition = collectionRegistry.get(collectionId);
      owner = definition
        ? resolveCollectionBoundary(document.metadata, markerPath, definition)
        : { markerPath, collectionId, registered: false };
      if (!owner.registered) {
        console.warn(
          `Vault: unknown collection ${collectionId} at ${markerPath}; skipping its entries.`,
        );
      }
    }

    // Retain the whole marker document for later phases without treating it as
    // an ordinary entry or activating its other properties yet.
    result.markers.push({
      file: markerPath,
      metadata: document.metadata,
      body: document.body,
      owner,
    });
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) {
      continue;
    }
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      await discoverVault(root, relative, owner, result);
    } else if (entry.isFile()) {
      result.files.push(relative);
      if (entry.name !== "_website.md" && relative.endsWith(".md") && owner) {
        result.ownedMarkdown.set(relative, owner);
      }
    }
  }

  return result;
}

function resolveCollectionBoundary(metadata, markerPath, definition) {
  const markerMetadata = parseSchema(
    definition.markerSchema,
    metadata,
    markerPath,
    { unknownKeyLabel: "marker property" },
  );
  const declaredDefaults = parseSchema(
    definition.folderDefaultsSchema,
    markerMetadata,
    markerPath,
  );

  return {
    markerPath,
    collectionId: definition.id,
    registered: true,
    definition,
    // Collection normalization is lowest precedence; author-declared marker
    // values replace it, including arrays such as tags.
    effectiveFolderDefaults: {
      ...definition.metadataDefaults,
      ...declaredDefaults,
    },
  };
}

function readNote(text, file, owner, preview) {
  // Every owned note is parsed before selection so invalid YAML and structural
  // collection misuse cannot hide in unpublished content.
  const document = parseMarkdownDocument(text, { file });
  const rawMetadata =
    document.hasFrontmatter &&
      document.metadata &&
      typeof document.metadata === "object" &&
      !Array.isArray(document.metadata)
      ? document.metadata
      : {};

  if (Object.hasOwn(rawMetadata, "collection")) {
    throw new Error(
      `${file}: collection is only allowed in _website.md; move this note to the intended collection boundary or edit its _website.md`,
    );
  }

  // Note values have final precedence over the collection and marker defaults.
  // Object spread replaces arrays rather than combining them.
  const effectiveMetadata = {
    ...owner.effectiveFolderDefaults,
    ...rawMetadata,
  };
  if (
    effectiveMetadata.publish !== true &&
    !(preview && effectiveMetadata.preview === true)
  ) {
    return null;
  }
  const validatedMetadata = parseSchema(
    owner.definition.entrySchema,
    effectiveMetadata,
    file,
  );

  return {
    file,
    body: document.body,
    data: publicMetadata(validatedMetadata),
  };
}

function parseSchema(schema, value, file, { unknownKeyLabel = "property" } = {}) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const messages = result.error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map(
        (key) => `${file}: unknown ${unknownKeyLabel} ${key}`,
      );
    }

    const property = issue.path.join(".") || "frontmatter";
    return `${file}: ${property} ${issue.message}`;
  });
  throw new Error(messages.join("; "));
}

// Only these fields may leave the vault; other frontmatter stays private.
function publicMetadata(data) {
  return {
    title: data.title,
    description: data.description,
    slug: data.slug,
    publishDate: data.publishDate,
    tags: data.tags ?? [],
    displayInFeed: data.displayInFeed ?? true,
    ...(data.series === undefined ? {} : { series: data.series }),
  };
}

async function readSelectedNotes(root, ownedMarkdown, preview) {
  const notes = [];
  for (const [file, owner] of ownedMarkdown) {
    if (!owner.registered) continue;

    const note = readNote(
      await fs.readFile(path.join(root, file), "utf8"),
      file,
      owner,
      preview,
    );
    if (note) {
      notes.push(note);
    }
  }

  return notes;
}

function validateUniqueSlugs(notes) {
  const slugs = new Set();

  for (const note of notes) {
    if (slugs.has(note.data.slug)) {
      throw new Error(`${note.file}: duplicate slug ${note.data.slug}`);
    }
    slugs.add(note.data.slug);
  }
}

async function renderNote(note, context) {
  const tree = markdown.parse(note.body);
  const definitions = collectDefinitions(tree);
  await transformChildren(tree, note.file, definitions, context);
  return `---\n${stringify(note.data)}---\n\n${markdown.stringify(tree)}`;
}

async function transformChildren(parent, file, definitions, context) {
  const children = [];

  for (const node of parent.children ?? []) {
    const result = await transformNode(node, file, definitions, context);
    children.push(...[result].flat());
  }

  parent.children = children;
}

async function transformNode(node, file, definitions, context) {
  if (node.type === "definition") {
    return [];
  }

  validateStaticContent(node, file);
  node = expandReference(node, definitions, file);

  if (node.type === "text") {
    return transformWikiText(node.value, file, context);
  }

  if (node.type === "image") {
    return createImageNode(node.url, node.alt, file, context);
  }

  if (node.children) {
    await transformChildren(node, file, definitions, context);
  }

  if (node.type === "link") {
    return createNoteLink(node.url, node.children, file, context);
  }

  return node;
}

function collectDefinitions(node, definitions = new Map()) {
  if (node.type === "definition") {
    definitions.set(node.identifier, node);
  }
  node.children?.forEach((child) => collectDefinitions(child, definitions));
  return definitions;
}

function validateStaticContent(node, file) {
  if (
    node.type === "code" &&
    /^(dataview|dataviewjs|templater)$/i.test(node.lang ?? "")
  ) {
    throw new Error(`${file}: dynamic plugin blocks are unsupported`);
  }

  if (
    !["code", "inlineCode"].includes(node.type) &&
    typeof node.value === "string" &&
    /<%|\$=|`=/.test(node.value)
  ) {
    throw new Error(`${file}: dynamic plugin content is unsupported`);
  }

  if (node.type === "inlineCode" && /^\$?=/.test(node.value)) {
    throw new Error(`${file}: inline Dataview is unsupported`);
  }

  if (node.type === "html" && /(?:src|href)\s*=|<%/i.test(node.value)) {
    throw new Error(
      `${file}: use Markdown links and images instead of HTML resource attributes`,
    );
  }
}

function expandReference(node, definitions, file) {
  if (node.type === "linkReference" || node.type === "imageReference") {
    const definition = definitions.get(node.identifier);
    if (!definition) {
      throw new Error(`${file}: missing link definition ${node.identifier}`);
    }
    node = {
      ...node,
      type: node.type === "linkReference" ? "link" : "image",
      url: definition.url,
      title: definition.title,
    };
  }

  return node;
}

async function transformWikiText(value, file, context) {
  // Obsidian block references use the `^id` syntax to link to a specific block,
  // like `^my-block` on its own line. They are unsupported here because this
  // pipeline converts notes to plain Markdown and does not preserve block-level
  // anchors/targets.
  if (/(?:^|\s)\^[\w-]+\s*$/m.test(value)) {
    throw new Error(`${file}: block references are unsupported`);
  }

  const children = [];
  let start = 0;
  const wikiPattern = /(!?)\[\[([^\]\n]+)\]\]/g;

  for (const match of value.matchAll(wikiPattern)) {
    if (match.index > start) {
      children.push({
        type: "text",
        value: value.slice(start, match.index),
      });
    }

    const replacement = await transformWikiMatch(match, file, context);
    children.push(...[replacement].flat());
    start = match.index + match[0].length;
  }

  children.push({ type: "text", value: value.slice(start) });
  return children;
}

// Obsidian uses [[note|label]] for links and ![[image|widthxheight]] for embeds.
async function transformWikiMatch(match, file, context) {
  const [target, ...aliases] = match[2].split("|");
  const alias = aliases.join("|");
  const isEmbed = Boolean(match[1]);

  if (isEmbed) {
    return createWikiImage(target, alias, file, context);
  }

  const label = alias || path.posix.basename(target).replace(/\.md(?=#|$)/, "");
  return createNoteLink(
    target,
    [{ type: "text", value: label }],
    file,
    context,
    true,
  );
}

async function createWikiImage(target, alias, file, context) {
  const fileTarget = target.split("#")[0];
  if (!raster.test(fileTarget)) {
    throw new Error(`${file}: note transclusions are unsupported; use a link`);
  }

  const dimensions = /^\d+(?:x\d+)?$/.test(alias) ? alias : undefined;
  return createImageNode(
    target,
    dimensions ? "" : alias,
    file,
    context,
    dimensions,
  );
}

// Prefer a relative path, then a vault-root path, then a unique filename.
function resolveReference(target, from, context, image = false) {
  const { files, fileSet } = context;

  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    throw new Error(`${from}: invalid encoded reference ${target}`);
  }

  const variants = (candidate) =>
    image || candidate.endsWith(".md")
      ? [candidate]
      : [candidate, `${candidate}.md`];
  const candidates = [
    path.posix.normalize(path.posix.join(path.posix.dirname(from), decoded)),
    path.posix.normalize(decoded.replace(/^\//, "")),
  ];
  if (decoded.startsWith("/")) {
    candidates.shift();
  }
  for (const candidate of candidates) {
    for (const variant of variants(candidate)) {
      if (fileSet.has(variant)) {
        return variant;
      }
    }
  }

  const names = variants(path.posix.basename(decoded));
  const matches = files.filter((file) =>
    names.includes(path.posix.basename(file)),
  );
  if (matches.length !== 1) {
    throw new Error(
      `${from}: ${matches.length ? "ambiguous" : "missing"} reference ${target}`,
    );
  }

  return matches[0];
}

async function createImageNode(url, alt, from, context, dimensions) {
  const { root, assets } = context;

  if (url.startsWith("https://")) {
    return { type: "image", url, alt: alt ?? "" };
  }

  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) {
    throw new Error(`${from}: images must be local raster files or HTTPS URLs`);
  }

  const file = resolveReference(url, from, context, true);
  if (!raster.test(file)) {
    throw new Error(`${from}: only local raster images are supported: ${url}`);
  }
  // Content-based names let notes share an asset and invalidate changed images.
  const bytes = await fs.readFile(path.join(root, file));
  const name = `${createHash("sha256").update(bytes).digest("hex")}${path.extname(file).toLowerCase()}`;
  assets.set(name, bytes);
  const src = `/_vault/${name}`;
  if (dimensions) {
    const [width, height] = dimensions.split("x");
    return {
      type: "html",
      value: `<img src="${src}" alt="${escapeHtml(alt ?? "")}" width="${width}"${height ? ` height="${height}"` : ""}>`,
    };
  }

  return { type: "image", url: src, alt: alt ?? "" };
}

function createNoteLink(url, children, from, context, wiki = false) {
  const { fileSet, byFile } = context;

  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) {
    return { type: "link", url, children };
  }

  const [target, ...fragmentParts] = url.split("#");
  const fragment = fragmentParts.join("#");
  if (fragment.startsWith("^")) {
    throw new Error(
      `${from}: block references are unsupported; use a heading link`,
    );
  }

  if (!target) {
    return {
      type: "link",
      url: `#${wiki ? heading(fragment) : fragment}`,
      children,
    };
  }

  if (
    !wiki &&
    target.startsWith("/") &&
    !fileSet.has(target.slice(1)) &&
    !fileSet.has(`${target.slice(1)}.md`)
  ) {
    return { type: "link", url, children };
  }

  const file = resolveReference(target, from, context);
  if (!file.endsWith(".md")) {
    throw new Error(
      `${from}: attachment links are unsupported; embed a raster image instead`,
    );
  }
  // Unselected notes keep their link label without exposing a private destination.
  const selected = byFile.get(file);
  return selected
    ? {
      type: "link",
      url: `/blog/${selected.data.slug}${fragment ? `#${wiki ? heading(fragment) : fragment}` : ""}`,
      children,
    }
    : children;
}

// Remove stale generated files and replace changed files via a temporary file.
async function syncGeneratedFiles(directory, entries) {
  await fs.mkdir(directory, { recursive: true });
  for (const file of await fs.readdir(directory)) {
    if (!entries.has(file)) {
      await fs.rm(path.join(directory, file), {
        recursive: true,
        force: true,
      });
    }
  }

  for (const [name, contents] of entries) {
    const destination = path.join(directory, name);
    const current = await fs.readFile(destination).catch(() => null);
    if (!current?.equals(Buffer.from(contents))) {
      const temporary = `${destination}.tmp`;
      await fs.writeFile(temporary, contents);
      await fs.rename(temporary, destination);
    }
  }
}

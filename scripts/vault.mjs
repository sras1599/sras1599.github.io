/**
 * Convert an Obsidian vault into the Markdown and images consumed by the website.
 * importVault is the entry point used by scripts/site.mjs during builds and local
 * development. It reads the vault; it never modifies the author's source files.
 *
 * A collection boundary is a folder whose _website.md declares a collection ID.
 * That boundary owns notes in its subtree until another collection declaration
 * takes over. The website's registry supplies schemas and publishing behavior;
 * marker frontmatter supplies folder defaults and optional public route overrides.
 *
 * The import proceeds in four stages:
 * 1. Discover files and boundaries, then resolve one public route per collection.
 * 2. Merge note metadata with defaults, select published notes (plus preview notes
 *    in writing mode), and reject duplicate identities or conflicting public URLs.
 * 3. Rewrite Markdown and Obsidian links, read embedded local images, and prepare
 *    all output in memory. Links to existing unselected notes become their labels;
 *    missing or ambiguous vault references fail the import.
 * 4. Synchronize .generated/<collection>/<slug>.md, .generated/collections.json,
 *    and public/_vault/<content-hash>.<extension>, removing obsolete output.
 *
 * Vault lookup paths use forward slashes and are relative to the vault root.
 * Entry identity (collection ID plus slug) is separate from its public URL, so a
 * route override changes website links without changing generated file locations.
 *
 * Parsing, validation, and rendering failures leave the previous output untouched.
 * Once synchronization starts, files are replaced individually; an I/O failure can
 * leave a partially updated import. There is no whole-import rollback.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { stringify } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { slug as heading } from "github-slugger";
import { parseMarkdownDocument } from "./markdown-document.mjs";
import {
  collectionEntryUrl,
  normalizeCollectionRoute,
  normalizeCollectionSlug,
} from "../src/collections/definition.mjs";
import { CollectionRegistry } from "../src/collections/registry.mjs";

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);
const rasterImagePattern = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;

/**
 * Import from vaultPath into projectRoot using the supplied collection registry.
 * preview includes notes with effective preview: true in addition to published
 * notes; folder defaults participate in both decisions. Return counts of selected
 * entries and unique generated image assets after both output directories sync.
 * Errors reject the call so the CLI can report them or retain its current preview.
 */
export async function importVault({
  vaultPath,
  projectRoot = process.cwd(),
  preview = false,
  registry = CollectionRegistry,
}) {
  if (!vaultPath) {
    throw new Error(
      "Set VAULT_PATH in .env to an accessible Obsidian vault directory.",
    );
  }

  const root = path.resolve(vaultPath);
  let discovery;
  try {
    discovery = await discoverVault(root, registry);
  } catch (error) {
    if (!error.code) throw error;
    throw new Error(`Cannot read VAULT_PATH (${root}): ${error.message}`);
  }

  const activeCollections = resolveActiveCollections(discovery.boundaries);
  const notes = await readSelectedNotes(
    root,
    discovery.ownedMarkdown,
    activeCollections,
    preview,
  );
  await validateUrlOwnership(notes, activeCollections, projectRoot);
  validateUniqueIdentities(notes);

  // Resolution needs every discovered file to distinguish an unpublished target
  // from a missing one. Only selected notes receive a public URL in this lookup.
  const vault = {
    root,
    files: new Set(discovery.files),
    publishedUrlsByFile: new Map(
      notes.map((note) => [
        note.file,
        collectionEntryUrl(note.route, note.identity.slug),
      ]),
    ),
  };
  const output = new Map();
  const assets = new Map();

  // Keep generated Markdown and image bytes in memory until every note converts.
  // Asset filenames encode their contents, so repeated map keys share one output
  // file even when several notes embed the same image.
  for (const note of notes) {
    const prepared = await prepareNote(note, vault);
    output.set(generatedEntryPath(note.identity), prepared.contents);

    for (const [name, bytes] of prepared.assets) {
      assets.set(name, bytes);
    }
  }

  const collections = Array.from(
    activeCollections.values(),
    ({ definition, route }) => ({ id: definition.id, route }),
  );
  output.set(
    "collections.json",
    `${JSON.stringify({ collections }, null, 2)}\n`,
  );

  await syncGeneratedFiles(path.join(projectRoot, "public/_vault"), assets);
  await syncGeneratedFiles(path.join(projectRoot, ".generated"), output, {
    directories: registry.keys(),
  });

  return { entries: notes.length, assets: assets.size };
}

/**
 * Walk the vault, recording relative file paths, registered collection boundaries,
 * and each Markdown file's nearest owning boundary. Hidden entries and symlinks
 * are excluded. The result object is a traversal accumulator shared by recursive
 * calls; inheritedOwner applies only until a child declares another collection.
 * Markers are parsed before their folder's children, independent of entry order.
 */
async function discoverVault(
  root,
  registry,
  dir = "",
  inheritedOwner,
  result = { files: [], boundaries: [], ownedMarkdown: new Map() },
) {
  const entries = await fs.readdir(path.join(root, dir), {
    withFileTypes: true,
  });
  const marker = entries.find(
    (entry) =>
      entry.name === "_website.md" && entry.isFile() && !entry.isSymbolicLink(),
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

    // A marker without a collection declaration leaves ownership and defaults
    // unchanged. An unknown collection still replaces the inherited owner: its
    // notes must be skipped, not accidentally published under a parent collection.
    if (Object.hasOwn(document.metadata, "collection")) {
      const collectionId = document.metadata.collection;
      if (typeof collectionId !== "string" || !collectionId.trim()) {
        throw new Error(`${markerPath}: collection must be a nonempty string`);
      }

      const definition = registry.get(collectionId);
      owner = definition
        ? resolveCollectionBoundary(document.metadata, markerPath, definition)
        : { markerPath, collectionId, registered: false };
      if (owner.registered) {
        result.boundaries.push(owner);
      } else {
        console.warn(
          `Vault: unknown collection ${collectionId} at ${markerPath}; skipping its entries.`,
        );
      }
    }
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) {
      continue;
    }
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      await discoverVault(root, registry, relative, owner, result);
    } else if (entry.isFile()) {
      result.files.push(relative);
      if (entry.name !== "_website.md" && relative.endsWith(".md") && owner) {
        result.ownedMarkdown.set(relative, owner);
      }
    }
  }

  return result;
}

/**
 * Validate a registered marker and build the defaults inherited by its notes.
 * The marker schema validates the whole declaration; the folder-defaults schema
 * selects the fields that may flow into entry metadata. An omitted route remains
 * undefined until all boundaries for this collection have been considered.
 */
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
  const declaredRoute = Object.hasOwn(markerMetadata, "route")
    ? normalizeCollectionRoute(markerMetadata.route, {
      label: `${markerPath}: route`,
    })
    : undefined;

  return {
    markerPath,
    collectionId: definition.id,
    registered: true,
    definition,
    declaredRoute,
    // Collection normalization is lowest precedence; author-declared marker
    // values replace it, including arrays such as tags.
    effectiveFolderDefaults: {
      ...definition.metadataDefaults,
      ...declaredDefaults,
    },
  };
}

/**
 * Return a map from collection ID to its definition, effective route, and source
 * boundaries without mutating those boundaries. Several folders may declare the
 * same collection: one explicit route applies to all of them, matching overrides
 * are allowed, and different overrides fail. With none, use the registry default.
 * A collection is active even if its boundaries contain no selected notes.
 */
function resolveActiveCollections(collectionBoundaries) {
  const boundariesByCollection = new Map();

  for (const boundary of collectionBoundaries) {
    const boundaries = boundariesByCollection.get(boundary.collectionId) ?? [];
    boundaries.push(boundary);
    boundariesByCollection.set(boundary.collectionId, boundaries);
  }

  const activeCollections = new Map();
  for (const [collectionId, boundaries] of boundariesByCollection) {
    const definition = boundaries[0].definition;
    const explicitRoutes = boundaries.filter(
      ({ declaredRoute }) => declaredRoute !== undefined,
    );
    const routes = new Set(
      explicitRoutes.map(({ declaredRoute }) => declaredRoute),
    );
    if (routes.size > 1) {
      const declarations = explicitRoutes
        .map(
          ({ markerPath, declaredRoute }) =>
            `${markerPath} declares ${declaredRoute}`,
        )
        .join("; ");

      throw new Error(
        `Conflicting route overrides for collection ${collectionId}: ${declarations}`,
      );
    }

    const route =
      explicitRoutes[0]?.declaredRoute ?? definition.defaultRoute;
    activeCollections.set(collectionId, {
      definition,
      route,
      boundaries,
    });
  }

  return activeCollections;
}

/**
 * Read notes owned by registered collections and return only selected entries.
 * Pass the collection's resolved route explicitly alongside the folder owner;
 * the owner carries local defaults, while the route belongs to the collection.
 * Notes under unknown collections are skipped before their contents are read.
 */
async function readSelectedNotes(root, ownedMarkdown, activeCollections, preview) {
  const notes = [];

  for (const [file, owner] of ownedMarkdown) {
    if (!owner.registered) continue;

    const { route } = activeCollections.get(owner.collectionId);
    const text = await fs.readFile(path.join(root, file), "utf8");
    const note = parseSelectedNote(text, file, owner, route, preview);
    if (note) {
      notes.push(note);
    }
  }

  return notes;
}

/**
 * Turn one registered collection's note into an import entry, or return null when
 * its effective publishing flags exclude it. Metadata precedence is collection
 * defaults, then marker defaults, then note values; arrays replace earlier arrays.
 * Selected notes must satisfy the entry schema. projectEntry chooses the metadata
 * written to generated frontmatter, separate from the source body and identity.
 */
function parseSelectedNote(text, file, owner, route, preview) {
  // Parse YAML and reject a note-level collection declaration before selection,
  // so those mistakes also surface in unpublished notes. Absent or non-mapping
  // frontmatter contributes no note overrides; inherited defaults still apply.
  const document = parseMarkdownDocument(text, { file });
  let rawMetadata = {};
  if (
    document.hasFrontmatter &&
    document.metadata &&
    typeof document.metadata === "object" &&
    !Array.isArray(document.metadata)
  ) {
    rawMetadata = document.metadata;
  }

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

  // Full entry requirements apply only after selection. An unpublished draft may
  // therefore omit required entry fields without blocking other notes' imports.
  const validatedMetadata = parseSchema(
    owner.definition.entrySchema,
    effectiveMetadata,
    file,
  );

  return {
    file,
    body: document.body,
    route,
    identity: {
      collectionId: owner.collectionId,
      slug: validatedMetadata.slug,
    },
    metadata: owner.definition.projectEntry(validatedMetadata),
  };
}

/**
 * Return schema-parsed metadata, including schema defaults and transformations.
 * Combine validation issues into one file-qualified error; report unknown marker
 * properties individually so the author can identify all misspelled fields.
 */
function parseSchema(schema, value, file, { unknownKeyLabel = "property" } = {}) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const messages = result.error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => `${file}: unknown ${unknownKeyLabel} ${key}`);
    }

    const property = issue.path.join(".") || "frontmatter";
    return `${file}: ${property} ${issue.message}`;
  });
  throw new Error(messages.join("; "));
}

// Slugs may repeat across collections, but two selected notes in one collection
// would write the same generated file. Report both sources before writing output.
function validateUniqueIdentities(notes) {
  const sourcesByCollection = new Map();

  for (const note of notes) {
    let sourcesBySlug = sourcesByCollection.get(note.identity.collectionId);
    if (!sourcesBySlug) {
      sourcesBySlug = new Map();
      sourcesByCollection.set(note.identity.collectionId, sourcesBySlug);
    }

    const existingSource = sourcesBySlug.get(note.identity.slug);
    if (existingSource) {
      throw new Error(
        `${note.file}: duplicate slug ${note.identity.slug} in collection ${note.identity.collectionId}; also declared by ${existingSource}`,
      );
    }
    sourcesBySlug.set(note.identity.slug, note.file);
  }
}

// Storage follows identity rather than the public route: collection "blog" and
// slug "guides/setup" produce "blog/guides/setup.md" relative to .generated.
// Revalidate the slug and ensure the destination stays inside that collection.
function generatedEntryPath({ collectionId, slug }) {
  const normalizedSlug = normalizeCollectionSlug(slug, {
    label: `slug for collection ${collectionId}`,
  });
  const relative = path.posix.join(collectionId, `${normalizedSlug}.md`);
  const collectionRoot = path.posix.resolve("/", collectionId);
  const destination = path.posix.resolve("/", relative);

  if (!destination.startsWith(`${collectionRoot}/`)) {
    throw new Error(
      `Refusing to write entry ${collectionId}/${slug} outside its collection directory`,
    );
  }

  return relative;
}

/**
 * Reject duplicate generated URLs and collisions with existing website routes.
 * Collection index URLs are reserved only when an index renderer exists; entry
 * URLs are reserved for selected notes. Ownership descriptions retain source
 * paths so a collision identifies the declarations the author needs to change.
 */
async function validateUrlOwnership(notes, activeCollections, projectRoot) {
  const generatedOwners = [];

  for (const collection of activeCollections.values()) {
    if (collection.definition.indexRenderer) {
      generatedOwners.push({
        url: collection.route,
        owner: `collection ${collection.definition.id} index from ${collection.boundaries
          .map(({ markerPath }) => markerPath)
          .join(", ")}`,
      });
    }
  }

  for (const note of notes) {
    generatedOwners.push({
      url: collectionEntryUrl(note.route, note.identity.slug),
      owner: `entry ${note.identity.collectionId}/${note.identity.slug} from ${note.file}`,
    });
  }

  const ownerByUrl = new Map();
  for (const candidate of generatedOwners) {
    const existing = ownerByUrl.get(candidate.url);
    if (existing) {
      throw new Error(
        `URL collision at ${candidate.url}: ${existing} conflicts with ${candidate.owner}`,
      );
    }
    ownerByUrl.set(candidate.url, candidate.owner);
  }

  const handwrittenOwners = await readHandwrittenRouteOwners(projectRoot);
  const handwrittenOwnerByUrl = new Map(
    handwrittenOwners.map(({ url, owner }) => [url, owner]),
  );
  for (const candidate of generatedOwners) {
    const handwrittenOwner = handwrittenOwnerByUrl.get(candidate.url);
    if (handwrittenOwner) {
      throw new Error(
        `URL collision at ${candidate.url}: ${candidate.owner} conflicts with ${handwrittenOwner}`,
      );
    }
  }
}

/**
 * Inventory concrete URLs from src/pages and public without executing Astro.
 * For example, src/pages/about/index.astro reserves /about; public/logo.png
 * reserves /logo.png. Dynamic page segments are skipped because their concrete
 * URLs cannot be inferred from filenames. Generated _vault assets are excluded.
 * This inventory is limited to these filesystem rules, not a full routing model.
 */
async function readHandwrittenRouteOwners(projectRoot) {
  const owners = [];
  const pagesRoot = path.join(projectRoot, "src/pages");

  for (const file of await listFiles(pagesRoot)) {
    const relative = path.relative(pagesRoot, file).split(path.sep).join("/");
    if (!/[.](?:astro|html|md|mdx|js|ts)$/.test(relative)) continue;

    const withoutExtension = relative.replace(/\.[^.]+$/, "");
    const segments = withoutExtension.split("/");
    if (segments.some((segment) => segment.startsWith("["))) continue;
    if (segments.at(-1) === "index") segments.pop();

    owners.push({
      url: segments.length ? `/${segments.join("/")}` : "/",
      owner: `handwritten route from src/pages/${relative}`,
    });
  }

  const publicRoot = path.join(projectRoot, "public");
  for (const file of await listFiles(publicRoot, {
    skip: new Set(["_vault"]),
  })) {
    const relative = path.relative(publicRoot, file).split(path.sep).join("/");
    owners.push({
      url: relative === "index.html" ? "/" : `/${relative}`,
      owner: `static file from public/${relative}`,
    });
  }

  return owners;
}

// Return filesystem paths beneath directory without following symlinks. skip
// filters names at this starting level only; recursive calls use an empty skip
// set. This lets the public scan exclude its generated _vault subtree specifically.
async function listFiles(directory, { skip = new Set() } = {}) {
  const files = [];

  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (skip.has(entry.name) || entry.isSymbolicLink()) continue;

    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }

  return files;
}

/**
 * Prepare one note's generated Markdown and a map of image filenames to bytes.
 * Parse into a Markdown syntax tree so links and images can be rewritten without
 * interpreting wiki syntax inside code. Collect reference definitions before
 * transforming nodes, since a definition may appear after a link that uses it.
 * Image reads happen here; output writes happen later in importVault.
 */
async function prepareNote(note, vault) {
  const tree = markdown.parse(note.body);
  const definitions = collectDefinitions(tree);
  const assets = new Map();

  tree.children = await transformChildren(
    tree.children,
    note.file,
    definitions,
    vault,
    assets,
  );

  return {
    contents: `---\n${stringify(note.metadata)}---\n\n${markdown.stringify(tree)}`,
    assets,
  };
}

/**
 * Transform siblings in document order and return their replacement children.
 * Each transformation returns an array: a definition becomes zero nodes, an
 * ordinary node stays one node, and wiki text or a private link can become several.
 * file supplies the source path for references and errors; definitions belongs to
 * this document; vault provides shared lookups. Only assets is an output accumulator,
 * populated with local image bytes for this note as traversal reaches images.
 */
async function transformChildren(children, file, definitions, vault, assets) {
  const transformed = [];

  for (const node of children) {
    const replacement = await transformNode(
      node,
      file,
      definitions,
      vault,
      assets,
    );
    transformed.push(...replacement);
  }

  return transformed;
}

/**
 * Validate and rewrite a syntax-tree node into zero or more replacement nodes.
 * Expand reference-style links first so they follow the same rules as inline
 * links. Transform a link's children before its destination: if the target is
 * private, the returned label still contains its transformed formatting or images.
 * Definitions can be removed because their destinations were already collected.
 */
async function transformNode(node, file, definitions, vault, assets) {
  if (node.type === "definition") {
    return [];
  }

  validateStaticContent(node, file);
  node = expandReference(node, definitions, file);

  if (node.type === "text") {
    return transformWikiText(node.value, file, vault, assets);
  }

  if (node.type === "image") {
    const image = await prepareImage(node.url, node.alt, file, vault, assets);
    return [image];
  }

  if (node.children) {
    node = {
      ...node,
      children: await transformChildren(
        node.children,
        file,
        definitions,
        vault,
        assets,
      ),
    };
  }

  if (node.type === "link") {
    return transformNoteLink(node.url, node.children, file, vault);
  }

  return [node];
}

// Build a document-wide lookup for reference syntax such as [label][source] with
// a separate [source]: destination declaration. Recursive calls populate the same
// map; expandReference uses the parser's identifiers to retrieve destinations.
function collectDefinitions(node, definitions = new Map()) {
  if (node.type === "definition") {
    definitions.set(node.identifier, node);
  }
  node.children?.forEach((child) => collectDefinitions(child, definitions));
  return definitions;
}

/**
 * Reject recognized Obsidian plugin expressions that need its runtime to render.
 * Ordinary code examples are allowed, with specific checks for dynamic fenced
 * blocks and inline Dataview expressions. Raw HTML resource attributes are rejected
 * because they bypass Markdown link resolution and local-image collection.
 * These checks enforce supported content conventions; they are not an HTML sanitizer.
 */
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

// Replace a reference node's indirect destination with the matching definition's
// URL and title, retaining its label or alt text for subsequent transformations.
// Nodes that do not use reference syntax pass through unchanged.
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

// Split a plain text node around [[note]] and ![[image]] occurrences, preserving
// the text before, between, and after them. Each occurrence can expand to several
// nodes; start tracks the first character not yet consumed from the source text.
async function transformWikiText(value, file, vault, assets) {
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

    const replacement = await transformWikiMatch(match, file, vault, assets);
    children.push(...replacement);
    start = match.index + match[0].length;
  }

  children.push({ type: "text", value: value.slice(start) });
  return children;
}

/**
 * Interpret one wiki match as a note link or raster-image embed. For a link,
 * [[folder/note|Label]] uses Label, otherwise the filename supplies the label.
 * For an embed, ![[photo.png|320x200]] supplies dimensions; a nonnumeric alias
 * becomes alt text instead. Embedding another note's content is unsupported.
 */
async function transformWikiMatch(match, file, vault, assets) {
  const [, embedMarker, destination] = match;
  const [target, ...aliases] = destination.split("|");
  const alias = aliases.join("|");

  if (embedMarker) {
    const fileTarget = target.split("#")[0];
    if (!rasterImagePattern.test(fileTarget)) {
      throw new Error(`${file}: note transclusions are unsupported; use a link`);
    }

    const dimensions = /^\d+(?:x\d+)?$/.test(alias) ? alias : undefined;
    const alt = dimensions ? "" : alias;
    const image = await prepareImage(target, alt, file, vault, assets, dimensions);
    return [image];
  }

  const label = alias || path.posix.basename(target).replace(/\.md(?=#|$)/, "");
  return transformNoteLink(
    target,
    [{ type: "text", value: label }],
    file,
    vault,
    { wiki: true },
  );
}

/**
 * Resolve a vault reference to a discovered path, not a public website URL.
 * Decode URL escapes, then try the source note's folder, the vault root, and
 * finally a unique matching filename anywhere in the vault. A leading slash
 * skips the source-folder attempt. For example, a reference to "Plan" from
 * "work/Today.md" tries work/Plan(.md), then Plan(.md), before filename lookup.
 * Note references may omit .md; image references require their exact extension.
 * Missing or ambiguous matches throw rather than silently choosing a destination.
 */
function resolveReference(target, from, vault, { image = false } = {}) {
  const { files } = vault;

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
  const candidates = [];
  if (!decoded.startsWith("/")) {
    candidates.push(
      path.posix.normalize(path.posix.join(path.posix.dirname(from), decoded)),
    );
  }
  candidates.push(path.posix.normalize(decoded.replace(/^\//, "")));

  for (const candidate of candidates) {
    for (const variant of variants(candidate)) {
      if (files.has(variant)) {
        return variant;
      }
    }
  }

  const names = variants(path.posix.basename(decoded));
  const matches = [...files].filter((file) =>
    names.includes(path.posix.basename(file)),
  );
  if (matches.length !== 1) {
    throw new Error(
      `${from}: ${matches.length ? "ambiguous" : "missing"} reference ${target}`,
    );
  }

  return matches[0];
}

/**
 * Prepare an image node, reading local raster files into the supplied assets map.
 * HTTPS images pass through without downloading or collecting them; other URL
 * schemes are rejected. Local output names combine a hash of the bytes with the
 * normalized extension, so matching contents and extensions share an asset and
 * changed contents receive a new URL. This function does not write output files.
 * For local images, dimensions such as "320" or "320x200" produce an HTML img
 * node because ordinary Markdown image syntax cannot carry those dimensions.
 */
async function prepareImage(url, alt, from, vault, assets, dimensions) {
  if (url.startsWith("https://")) {
    return { type: "image", url, alt: alt ?? "" };
  }

  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) {
    throw new Error(`${from}: images must be local raster files or HTTPS URLs`);
  }

  const file = resolveReference(url, from, vault, { image: true });
  if (!rasterImagePattern.test(file)) {
    throw new Error(`${from}: only local raster images are supported: ${url}`);
  }

  // Content-based names let notes share an asset and invalidate changed images.
  const bytes = await fs.readFile(path.join(vault.root, file));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = `${hash}${path.extname(file).toLowerCase()}`;
  assets.set(name, bytes);

  const src = `/_vault/${name}`;
  if (dimensions) {
    const [width, height] = dimensions.split("x");
    const heightAttribute = height ? ` height="${height}"` : "";

    return {
      type: "html",
      value: `<img src="${src}" alt="${escapeHtml(alt ?? "")}" width="${width}"${heightAttribute}>`,
    };
  }

  return { type: "image", url: src, alt: alt ?? "" };
}

// Escape author-supplied alt text before inserting it into the generated HTML
// image attribute, so quotes or markup characters remain literal text.
function escapeHtml(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

/**
 * Return a link node array for a public destination, or just the label's children
 * when the referenced vault note exists but was not selected for this import.
 * Scheme-based and protocol-relative URLs pass through. Vault destinations must
 * resolve to Markdown notes; other attachments cannot be linked through this path.
 * wiki converts heading text such as "Getting Started" into "getting-started";
 * ordinary Markdown fragments are treated as authored anchors and kept unchanged.
 */
function transformNoteLink(url, children, from, vault, { wiki = false } = {}) {
  const { files, publishedUrlsByFile } = vault;

  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) {
    return [{ type: "link", url, children }];
  }

  const [target, ...fragmentParts] = url.split("#");
  const fragment = fragmentParts.join("#");
  if (fragment.startsWith("^")) {
    throw new Error(
      `${from}: block references are unsupported; use a heading link`,
    );
  }

  if (!target) {
    const anchor = wiki ? heading(fragment) : fragment;
    return [{ type: "link", url: `#${anchor}`, children }];
  }

  // An ordinary Markdown link such as [About](/about) may address a website
  // route rather than a vault file. Preserve it when neither /about nor /about.md
  // exists at the vault root. Wiki links always go through vault resolution.
  if (
    !wiki &&
    target.startsWith("/") &&
    !files.has(target.slice(1)) &&
    !files.has(`${target.slice(1)}.md`)
  ) {
    return [{ type: "link", url, children }];
  }

  const file = resolveReference(target, from, vault);
  if (!file.endsWith(".md")) {
    throw new Error(
      `${from}: attachment links are unsupported; embed a raster image instead`,
    );
  }

  // Unselected notes keep their link label without exposing a private destination.
  const publishedUrl = publishedUrlsByFile.get(file);
  if (!publishedUrl) return children;

  let destination = publishedUrl;
  if (fragment) {
    const anchor = wiki ? heading(fragment) : fragment;
    destination += `#${anchor}`;
  }

  return [{ type: "link", url: destination, children }];
}

/**
 * Make an importer-owned output directory match entries, a map of relative paths
 * to strings or bytes. Keep explicitly requested directories even when empty, and
 * preserve all ancestors needed by nested entries such as blog/guides/setup.md.
 * Remove stale output first, then write only changed files. Each replacement uses
 * a neighboring temporary file and rename; the full synchronization is not atomic.
 * Unexpected read or write failures propagate, possibly after earlier changes.
 */
async function syncGeneratedFiles(directory, entries, { directories = [] } = {}) {
  await fs.mkdir(directory, { recursive: true });
  const expectedDirectories = new Set(directories);

  for (const name of entries.keys()) {
    let parent = path.posix.dirname(name);
    while (parent !== ".") {
      expectedDirectories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }

  await removeStaleGeneratedFiles(directory, "", entries, expectedDirectories);

  for (const expectedDirectory of expectedDirectories) {
    await fs.mkdir(path.join(directory, expectedDirectory), { recursive: true });
  }

  for (const [name, contents] of entries) {
    const destination = path.join(directory, name);
    await fs.mkdir(path.dirname(destination), { recursive: true });

    let current;
    try {
      current = await fs.readFile(destination);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    // Leave identical files untouched so repeated imports do not trigger needless
    // downstream file-change events. A missing destination is an expected first write.
    if (current?.equals(Buffer.from(contents))) continue;

    const temporary = `${destination}.tmp`;
    await fs.writeFile(temporary, contents);
    await fs.rename(temporary, destination);
  }
}

/**
 * Prune the importer-owned tree using paths relative to its output root.
 * Descend into expected directories to find stale children; delete unexpected
 * directories wholesale and files absent from entries. Both lookup collections
 * use the same relative paths, so nested files are compared against full names.
 * This assumes exclusive ownership of directory: unrelated files there are removed.
 */
async function removeStaleGeneratedFiles(
  directory,
  relativeDirectory,
  entries,
  expectedDirectories,
) {
  const absoluteDirectory = path.join(directory, relativeDirectory);

  for (const entry of await fs.readdir(absoluteDirectory, {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(relativeDirectory, entry.name);

    if (entry.isDirectory() && expectedDirectories.has(relative)) {
      await removeStaleGeneratedFiles(
        directory,
        relative,
        entries,
        expectedDirectories,
      );
    } else if (entry.isDirectory() || !entries.has(relative)) {
      await fs.rm(path.join(directory, relative), {
        recursive: true,
        force: true,
      });
    }
  }
}

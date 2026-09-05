import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse, stringify } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { slug as heading } from "github-slugger";

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);
const raster = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

async function inventory(root, dir = "") {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, dir), {
    withFileTypes: true,
  })) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await inventory(root, relative)));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}

function readNote(text, file, preview) {
  const match = text
    .replace(/^\uFEFF/, "")
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  let data;
  try {
    data = parse(match[1]);
  } catch (error) {
    if (/^(?:publish|preview):\s*true\s*$/m.test(match[1]))
      throw new Error(`${file}: invalid YAML: ${error.message}`);
    return null;
  }
  if (!data || (data.publish !== true && !(preview && data.preview === true)))
    return null;
  for (const key of ["title", "description", "slug", "publishDate"]) {
    if (typeof data[key] !== "string" || !data[key].trim())
      throw new Error(`${file}: ${key} must be a nonempty string`);
  }
  if (!slugPattern.test(data.slug))
    throw new Error(
      `${file}: slug must contain lowercase letters, digits, and single hyphens`,
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.publishDate) ||
    !Number.isFinite(Date.parse(data.publishDate)) ||
    new Date(data.publishDate).toISOString().slice(0, 10) !== data.publishDate
  )
    throw new Error(`${file}: publishDate must be a valid YYYY-MM-DD date`);
  if (
    data.tags !== undefined &&
    (!Array.isArray(data.tags) ||
      data.tags.some((tag) => typeof tag !== "string"))
  )
    throw new Error(`${file}: tags must be a list of strings`);
  return {
    file,
    body: text.replace(/^\uFEFF/, "").slice(match[0].length),
    data: {
      title: data.title,
      description: data.description,
      slug: data.slug,
      publishDate: data.publishDate,
      tags: data.tags ?? [],
    },
  };
}

/** Prepare all selected content before touching generated output. The vault is read-only. */
export async function importVault({
  vaultPath,
  projectRoot = process.cwd(),
  preview = false,
}) {
  if (!vaultPath)
    throw new Error(
      "Set VAULT_PATH in .env to an accessible Obsidian vault directory.",
    );
  const root = path.resolve(vaultPath);
  let files;
  try {
    files = await inventory(root);
  } catch (error) {
    throw new Error(`Cannot read VAULT_PATH (${root}): ${error.message}`);
  }
  const fileSet = new Set(files);
  const notes = [];
  for (const file of files.filter((file) => file.endsWith(".md"))) {
    const note = readNote(
      await fs.readFile(path.join(root, file), "utf8"),
      file,
      preview,
    );
    if (note) notes.push(note);
  }
  const byFile = new Map(notes.map((note) => [note.file, note]));
  const slugs = new Set();
  for (const note of notes) {
    if (slugs.has(note.data.slug))
      throw new Error(`${note.file}: duplicate slug ${note.data.slug}`);
    slugs.add(note.data.slug);
  }
  const assets = new Map();
  function resolve(target, from, image = false) {
    let decoded;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      throw new Error(`${from}: invalid encoded reference ${target}`);
    }
    const variants = (p) => (image || p.endsWith(".md") ? [p] : [p, `${p}.md`]);
    const candidates = [
      path.posix.normalize(path.posix.join(path.posix.dirname(from), decoded)),
      path.posix.normalize(decoded.replace(/^\//, "")),
    ];
    if (decoded.startsWith("/")) candidates.shift();
    for (const candidate of candidates)
      for (const variant of variants(candidate))
        if (fileSet.has(variant)) return variant;
    const names = variants(path.posix.basename(decoded));
    const matches = files.filter((file) =>
      names.includes(path.posix.basename(file)),
    );
    if (matches.length !== 1)
      throw new Error(
        `${from}: ${matches.length ? "ambiguous" : "missing"} reference ${target}`,
      );
    return matches[0];
  }
  async function imageNode(url, alt, from, dimensions) {
    if (url.startsWith("https://"))
      return { type: "image", url, alt: alt ?? "" };
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url))
      throw new Error(
        `${from}: images must be local raster files or HTTPS URLs`,
      );
    const file = resolve(url, from, true);
    if (!raster.test(file))
      throw new Error(
        `${from}: only local raster images are supported: ${url}`,
      );
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
  function noteLink(url, children, from, wiki = false) {
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url))
      return { type: "link", url, children };
    const [target, ...fragmentParts] = url.split("#");
    const fragment = fragmentParts.join("#");
    if (fragment.startsWith("^"))
      throw new Error(
        `${from}: block references are unsupported; use a heading link`,
      );
    if (!target)
      return {
        type: "link",
        url: `#${wiki ? heading(fragment) : fragment}`,
        children,
      };
    if (
      !wiki &&
      target.startsWith("/") &&
      !fileSet.has(target.slice(1)) &&
      !fileSet.has(`${target.slice(1)}.md`)
    )
      return { type: "link", url, children };
    const file = resolve(target, from);
    if (!file.endsWith(".md"))
      throw new Error(
        `${from}: attachment links are unsupported; embed a raster image instead`,
      );
    const selected = byFile.get(file);
    return selected
      ? {
          type: "link",
          url: `/blog/${selected.data.slug}${fragment ? `#${wiki ? heading(fragment) : fragment}` : ""}`,
          children,
        }
      : children;
  }
  const output = new Map();
  for (const note of notes) {
    const tree = markdown.parse(note.body);
    const definitions = new Map();
    function collect(node) {
      if (node.type === "definition") definitions.set(node.identifier, node);
      node.children?.forEach(collect);
    }
    collect(tree);
    async function transform(parent) {
      const children = [];
      for (let node of parent.children ?? []) {
        if (node.type === "definition") continue;
        if (
          node.type === "code" &&
          /^(dataview|dataviewjs|templater)$/i.test(node.lang ?? "")
        )
          throw new Error(
            `${note.file}: dynamic plugin blocks are unsupported`,
          );
        if (
          !["code", "inlineCode"].includes(node.type) &&
          typeof node.value === "string" &&
          /<%|\$=|`=/.test(node.value)
        )
          throw new Error(
            `${note.file}: dynamic plugin content is unsupported`,
          );
        if (node.type === "inlineCode" && /^\$?=/.test(node.value))
          throw new Error(`${note.file}: inline Dataview is unsupported`);
        if (node.type === "html" && /(?:src|href)\s*=|<%/i.test(node.value))
          throw new Error(
            `${note.file}: use Markdown links and images instead of HTML resource attributes`,
          );
        if (node.type === "linkReference" || node.type === "imageReference") {
          const definition = definitions.get(node.identifier);
          if (!definition)
            throw new Error(
              `${note.file}: missing link definition ${node.identifier}`,
            );
          node = {
            ...node,
            type: node.type === "linkReference" ? "link" : "image",
            url: definition.url,
            title: definition.title,
          };
        }
        if (node.type === "text") {
          if (/(?:^|\s)\^[\w-]+\s*$/m.test(node.value))
            throw new Error(`${note.file}: block references are unsupported`);
          let start = 0;
          const re = /(!?)\[\[([^\]\n]+)\]\]/g;
          for (const match of node.value.matchAll(re)) {
            if (match.index > start)
              children.push({
                type: "text",
                value: node.value.slice(start, match.index),
              });
            const [target, ...aliases] = match[2].split("|");
            const alias = aliases.join("|");
            if (match[1]) {
              const fileTarget = target.split("#")[0];
              if (!raster.test(fileTarget))
                throw new Error(
                  `${note.file}: note transclusions are unsupported; use a link`,
                );
              const dimensions = /^\d+(?:x\d+)?$/.test(alias)
                ? alias
                : undefined;
              children.push(
                await imageNode(
                  target,
                  dimensions ? "" : alias,
                  note.file,
                  dimensions,
                ),
              );
            } else {
              children.push(
                ...[
                  noteLink(
                    target,
                    [
                      {
                        type: "text",
                        value:
                          alias ||
                          path.posix
                            .basename(target)
                            .replace(/\.md(?=#|$)/, ""),
                      },
                    ],
                    note.file,
                    true,
                  ),
                ].flat(),
              );
            }
            start = match.index + match[0].length;
          }
          children.push({ type: "text", value: node.value.slice(start) });
          continue;
        }
        if (node.type === "image")
          node = await imageNode(node.url, node.alt, note.file);
        else if (node.type === "link") {
          await transform(node);
          node = noteLink(node.url, node.children, note.file);
        } else if (node.children) await transform(node);
        children.push(...[node].flat());
      }
      parent.children = children;
    }
    await transform(tree);
    output.set(
      `${note.data.slug}.md`,
      `---\n${stringify(note.data)}---\n\n${markdown.stringify(tree)}`,
    );
  }
  async function reconcile(directory, entries) {
    await fs.mkdir(directory, { recursive: true });
    for (const file of await fs.readdir(directory))
      if (!entries.has(file))
        await fs.rm(path.join(directory, file), {
          recursive: true,
          force: true,
        });
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
  await reconcile(path.join(projectRoot, "public/_vault"), assets);
  await reconcile(path.join(projectRoot, ".generated/blog"), output);
  return { posts: notes.length, assets: assets.size };
}

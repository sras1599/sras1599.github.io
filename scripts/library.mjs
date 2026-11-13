/** Read Library records without writing to the vault. Discovery counts H2 sections;
 * selected records validate their YAML before their notes enter the vault pipeline.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { parseMarkdownDocument } from "./markdown-document.mjs";
import { libraryDefaultItemSourceSchema, libraryItemSourceSchemas } from "../src/collections/library/schema.mjs";

function headingText(node) {
  if (typeof node.value === "string") return node.value;
  if (node.type === "image") return node.alt ?? "";
  return (node.children ?? []).map(headingText).join("");
}

export async function readLibraryRecords(root, dir, entries, markdown) {
  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !/^_collection(?:\.[^.]+)*\.md$/.test(entry.name)) continue;
    const file = path.posix.join(dir, entry.name);
    const source = await fs.readFile(path.join(root, file), "utf8");
    const { body } = parseMarkdownDocument(source, { file });
    const tree = markdown.parse(body);
    const headings = tree.children.filter((node) => node.type === "heading" && node.depth === 2);
    const definitions = tree.children.filter((node) => node.type === "definition");
    const fileId = createHash("sha256").update(file).digest("hex").slice(0, 16);

    for (const [index, heading] of headings.entries()) {
      const end = headings[index + 1]?.position.start.offset ?? body.length;
      const children = tree.children.filter((node) => node.position.start.offset >= heading.position.end.offset && node.position.start.offset < end);
      const metadata = children[0];
      const hasMetadata = metadata?.type === "code" && /^(yaml|yml)$/i.test(metadata.lang ?? "");
      const noteStart = hasMetadata ? metadata.position.end.offset : heading.position.end.offset;
      // Reference definitions outside this record remain available to its notes.
      const otherDefinitions = definitions.filter((node) => node.position.start.offset < heading.position.start.offset || node.position.start.offset >= end)
        .map((node) => body.slice(node.position.start.offset, node.position.end.offset));
      records.push({
        file,
        id: `${fileId}-${index + 1}`,
        title: headingText(heading).trim(),
        line: heading.position.start.line,
        yaml: hasMetadata ? metadata.value : undefined,
        body: [body.slice(noteStart, end).trim(), ...otherDefinitions].filter(Boolean).join("\n\n"),
      });
    }
  }
  return records;
}

export function prepareLibraryRecord(record, category) {
  const location = `${record.file}:${record.line} (${record.title})`;
  if (!record.title) throw new Error(`${location}: Library item requires a title`);
  if (record.yaml === undefined) throw new Error(`${location}: each item must start with a fenced yaml metadata block after its H2 title`);

  let metadata;
  try {
    metadata = parse(record.yaml);
  } catch (cause) {
    throw new Error(`${location}: invalid YAML: ${cause.message}`, { cause });
  }
  const schema = Object.hasOwn(libraryItemSourceSchemas, category)
    ? libraryItemSourceSchemas[category]
    : libraryDefaultItemSourceSchema;
  const result = schema.safeParse(metadata);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => `${location}: ${issue.path.join(".") || "metadata"} ${issue.message}`).join("; "));
  }

  const data = result.data;
  let creator = data.creator;
  if (category === "books") creator = data.author;
  if (category === "film-and-tv") creator = data.director;
  if (category === "music") creator = data.artist;

  // Only these metadata fields leave the vault. Notes publish in full.
  return {
    id: `${category}/${record.id}`,
    file: record.file,
    body: record.body,
    metadata: {
      category,
      title: record.title,
      ...(creator === undefined ? {} : { creator }),
      ...(data.year === undefined ? {} : { year: data.year }),
      ...(data.rating === undefined ? {} : { rating: data.rating }),
      ...(data.link === undefined ? {} : { link: data.link }),
      reads: data.reads,
    },
  };
}

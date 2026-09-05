# Local development and writing

Use Node.js 22.12 or newer and `npm ci`. Copy `.env.example` to `.env` and set
`VAULT_PATH` to an accessible local vault; on this computer it is
`/home/raspreet/obsidian`. No GitHub credentials or network access are needed to
read local writing. The importer never edits the vault.

## Commands

- `npm run dev`: import published notes, watch the vault, and start Astro.
- `npm run dev:writing`: also include notes marked `preview: true` for local review.
- `npm run build`: import published notes only, run Astro checks, and build `dist`.
- `npm run preview`: serve the existing production build; it does not import or rebuild.
- `npm test`: importer tests plus a local dev/build integration test with synthetic notes.

Development commands accept `--port`, `--host`, `--open`, and `--mode`, such as `npm run dev -- --port 4323`.
The integration test uses localhost port 4389 and the project's disposable build
output; stop your development server before running it. Afterwards, run the normal
build to replace the synthetic output with your selected content.

## Selecting notes

Any ordinary `.md` note anywhere in the vault can be published. Hidden files,
hidden directories, and symlinks are excluded. Only the YAML boolean `true` selects
a note: the string `"true"` does not. The entire selected note becomes the article,
so keep planning text in separate notes.

```yaml
---
publish: true
title: "An example article"
description: "A short introduction"
publishDate: 2026-09-05
slug: an-example-article
tags:
  - writing
---
```

For unpublished work, use `preview: true` without `publish: true` and run
`npm run dev:writing`. Preview posts require the same metadata. Production builds
always exclude preview-only notes, even after a writing-preview session.

Titles and descriptions must be nonempty strings; dates use valid `YYYY-MM-DD`
calendar dates. Slugs must be unique lowercase letters/digits separated by single
hyphens. Tags are optional strings. Other properties are discarded from generated
frontmatter. The former `draft` property is not used.

The slug determines `/blog/an-example-article`, independent of the vault filename
or folder. Changing a slug changes the URL; no automatic redirect is created.
Removing `publish`, setting it to `false`, or deleting a note removes it at the next
successful import/build. A vault with no selected notes produces an empty blog.

## Supported content

Standard Markdown, footnotes, tables, and fenced code are preserved. Wikilinks
such as `[[Other note|label]]` become links when their target is selected. Links to
unselected notes become plain labels; their contents are never included. Ordinary
heading fragments and `[[Other note#Heading|label]]` are supported.

Local image references use standard Markdown or Obsidian syntax:

```markdown
![Description](../assets/photo.png)
![[photo.png|Description]]
![[photo.png|400]]
![[photo.png|400x300]]
```

Resolve references relative to the source note, then from the vault root, then by
unique filename. Ambiguous and missing references fail the import. Local images
support PNG, JPEG, GIF, WebP, AVIF, and BMP. HTTPS image URLs remain remote. Only
referenced local images are copied, under content-hashed filenames.

Note embeds/transclusions, block references, Dataview/Templater execution, local
non-raster attachments, and HTML resource attributes are unsupported. Replace them
with ordinary links, static Markdown, or raster image embeds. Code examples remain
literal; recognized executable plugin blocks are rejected.

## Generated files and errors

`.generated/blog` holds generated Markdown; `public/_vault` holds selected images.
Both are gitignored and disposable. Never edit them. Astro derives collection IDs
from the generated slug filenames, then `getStaticPaths()` creates article routes.

The importer validates and prepares content before updating those directories.
During development, invalid edits report an error in the terminal and retain the
last successful import until corrected. Production errors stop the build. Missing
or inaccessible `VAULT_PATH` is an error, not an empty blog.

The watcher handles saves, renames, additions, removals, and image changes. Keep
only one development/build process running per website checkout because generated
output is shared. Use `npm run build` before reviewing the final production output.

No posts are shipped in the website repository. The initial blog is intentionally
empty; real writing can be opted in later.

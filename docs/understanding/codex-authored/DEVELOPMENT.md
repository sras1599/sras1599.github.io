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

Development commands accept `--port`, `--host`, `--open`, and `--mode`, such as `npm run dev -- --port 4323`.

## Selecting notes

An exact, case-sensitive `_website.md` (we call this the *marker*) file opts its folder and unmarked
descendants into a website collection. Ordinary
notes outside a registered boundary are ignored. Hidden files, hidden directories,
and symlinks are excluded, and the marker itself is never imported as an entry.

The marker may provide folder defaults specific to the collection:

```yaml
---
collection: my-collection # required
title: lorem ipsum # required
metaDescription: SEO description # required
# folder defaults. These are applied to all documents imported within this collection.
# properties that the document defines takes precedence over these
publish: true
preview: false
displayInFeed: true
tags:
  - writing
---
```

The `notes` marker accepts only `collection`, `title`, `metaDescription`,
`publish`, and `preview`. Its `publish` and `preview` values are recursive folder
defaults; note-level values override them.

Marker properties are strict. `title` and `metaDescription`, together with the
marker body, author the collection index. Public routes are defined in the website
collection registry; declaring `route` or any other unsupported marker property is
an error.

Defaults apply recursively. An ordinary note's explicitly declared value replaces
the marker value, and the marker value replaces the website's collection default;
arrays such as `tags` replace rather than concatenate. `publish` and `preview`
default to `false`, `displayInFeed` defaults to `true`, and `tags` defaults to an
empty list. A note may opt out of an inherited default with `publish: false`.

Only the YAML boolean `true` selects a note: the string `"true"` does not.
Production imports effective `publish: true`; `npm run dev:writing` also imports
effective `preview: true`. The entire selected note becomes the article, so keep
planning text in separate notes. A `collection` property is invalid on an ordinary
note; move the note beneath the intended marker or edit that `_website.md`.

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
calendar dates. Slugs use lowercase letters, digits, and single hyphens in
slash-separated segments; each slug must be unique within its collection. Tags are
an optional list of strings. Other properties are discarded from generated
frontmatter. The former `draft` property is not used.

Notes use the same selection and identity rules. A selected note requires
`title`, `publishDate`, and `slug`; `description` and `tags` are optional:

```yaml
---
publish: true
title: "A short note"
publishDate: 2026-09-12
slug: a-short-note
tags:
  - learning
---
```

Its slug determines `/notes/a-short-note`. The marker's `title`,
`metaDescription`, and body render the `/notes` index, where notes appear newest
first.

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
![[photo.png|center|400]]
![[photo.png|Description|center|400x300]]
```

Wiki image options are pipe-delimited and may combine a description, the `center`
layout option, and one width or width-by-height value. The importer keeps the
description as alt text, emits centered images with a website-owned CSS class, and
sets numeric dimensions as HTML attributes. For example, `center|400` centers the
image at a preferred width of 400 pixels while still allowing it to shrink on
narrow screens.

Resolve references relative to the source note, then from the vault root, then by
unique filename. Ambiguous and missing references fail the import. Local images
support PNG, JPEG, GIF, WebP, AVIF, and BMP. HTTPS image URLs remain remote. Only
referenced local images are copied, under content-hashed filenames.

Note embeds/transclusions, block references, Dataview/Templater execution, local
non-raster attachments, and HTML resource attributes are unsupported. Replace them
with ordinary links, static Markdown, or raster image embeds. Code examples remain
literal; recognized executable plugin blocks are rejected.

## Generated files and errors

`.generated/{collection}` hold generated entries,
`.generated/_indexes` holds authored collection indexes, and `public/_vault` holds
selected images. They are gitignored and disposable. Never edit them. Astro derives
collection IDs from the generated slug filenames, then each collection's page
module creates its public routes.

The importer validates and prepares content before updating those directories.
During development, invalid edits report an error in the terminal and retain the
last successful import until corrected. Production errors stop the build. Missing
or inaccessible `VAULT_PATH` is an error, not an empty blog.

The watcher handles saves, renames, additions, removals, and image changes. Keep
only one development/build process running per website checkout because generated
output is shared. Use `npm run build` before reviewing the final production output.

No posts are shipped in the website repository. The initial blog is intentionally
empty; real writing can be opted in later.


## Game calendar absence explanations

Game results remain in their four existing JSON files. Shared explanations for
missing days belong only in `src/data/games/absences.json`; each range applies to
Connections, Mini, Bracket City, and Tagline. The production entry list starts
empty. Add only dates you intend to publish, for example:

```json
{
  "reasons": {
    "vacation": {
      "illustration": "/images/game-absence-vacation.svg",
      "message": "Away on vacation."
    }
  },
  "entries": [
    {
      "reason": "vacation",
      "startDate": "2026-09-20",
      "endDate": "2026-09-30",
      "message": "Away exploring Kerala."
    }
  ]
}
```

This is an authoring example, not a shipped absence. Dates must be real
`YYYY-MM-DD` dates. Both endpoints are inclusive; equal endpoints explain one
day. Ranges may cross weeks, months, or years. Omit an entry's `message` to use
its reason's default; messages must be nonempty plain text. Entries may override
messages but never illustrations, and must name an existing reason.

Ranges must not overlap, even at endpoints or in future portions. Loading errors
identify the entry positions, reasons, dates, and affected field; overlap errors
also identify the conflicting range and inclusive overlap dates. Adjacent ranges
(such as one ending September 30 and another starting October 1) are valid.

An upcoming range can be authored in full. Only dates through the showcase's
current Asia/Kolkata date show explanations. A begun range can extend the first
selectable month backward; future-only ranges do not affect month choices. Months
remain continuous through the current month. An unexpected actual result takes
precedence over an explanation; days without either keep their normal appearance.
Because this is a static site, "today" is calculated when the homepage is rendered;
rebuild to advance the published calendar date.

The illustration repeats in every affected cell with its proportions preserved
and its day number visible. Detailed artwork will look small in these cells.
All day cells show their description on hover or keyboard focus using the same
CSS tooltip styling as article abbreviations. Absence cells show the full absence
message and do not act as buttons. These CSS tooltips can be clipped by the mobile
carousel viewport, and long messages are not scrollable.

The vacation reason uses the existing supplied public SVG at
`public/images/game-absence-vacation.svg`. To swap the artwork everywhere, replace
that file, or place another asset under `public/images/` and change only the
reason's `illustration` path. Use an absolute public path beginning with `/`,
without traversal segments, whitespace, query strings, or fragments. These are
reused external image URLs, not inline SVGs or content-hashed assets; changing the
filename/path also changes the cache URL. No component changes or per-game copies
are needed.

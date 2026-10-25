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
- `npm run routes`: list current published routes grouped alphabetically by collection,
  with natural path ordering within each group and standalone pages last.
- `npm run routes -- --preview`: also include entries selected by `preview: true`,
  matching writing mode. Preview-only routes have a `(preview)` suffix; published
  routes remain unlabeled even if `preview: true` is also set. `--help` shows usage.

Route listing reads `VAULT_PATH` from the same environment as development. It shares
the importer's metadata selection, slug resolution, and collision validation, but
does not write generated content, process Markdown links/media, or run Astro. It
includes concrete pages from `src/pages` and HTML pages in `public`; assets and the
development-only admin page are excluded. Dynamic routes outside the registered
vault collections cannot be inferred. This describes current local sources, not
the last build or the deployed site.

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

The `notes` marker accepts `collection`, `title`, `metaDescription`,
`publish`, `preview`, and the shared `directory`/`slug` properties (plus `tags`
on directory markers) described
below. Its `publish` and `preview` values are recursive folder
defaults; note-level values override them.

Marker properties are strict. On ordinary markers, `title` and `metaDescription`,
together with the marker body, author the collection index. A marker with
`directory: true` instead uses its title, slug, and body for a directory card and
sidebar root; it never supplies the collection index. Public routes are defined in the website
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
`title`, `publishDate`, and `slug` outside sidebar folders; `description` and
`tags` are optional:

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

## Directories and sidebar navigation

Any registered collection (`blog`, `notes`, or `people`) can use directory markers.
They supply sidebar navigation, default descendant titles/URLs, and Markdown content
for directory cards. They do not create a collection or replace its entry metadata
requirements. Sidebars appear only inside their configured directory; unrelated
pages keep their existing layout.

For German, author `Learning/German/_website.md` in the vault:

```markdown
---
collection: notes
directory: true
title: German
slug: german
tags:
  - languages
  - learning
publish: true
---

Notes from my German-learning journey, including **Language Transfer lessons**
and general grammar concepts.
```

Set `directory` to a checkbox/boolean and `title` and `slug` to text properties in
Obsidian. Both title and slug are required when `directory: true`. Titles must be
nonempty; slugs use lowercase letters, digits, and single hyphens in slash-separated
segments. If the folder inherits a registered collection, omit `collection` and
keep the directory properties plus supported folder defaults. With `directory`
false or absent, no new navigation root is created and existing inherited navigation
is not disabled. Ordinary collection-index marker behavior remains unchanged.

Optional marker `tags` label the directory card only, across all collections.
Use an Obsidian tags property or a YAML list of strings; omitting tags or setting
`tags: []` displays no badges. Directory tags never become defaults for descendants
or replace `_index.md` page tags. Ordinary non-directory Blog markers retain their
existing tag-default behavior.

The marker body is the full Markdown displayed beneath its directory card title.
It supports the same links, formatting, paragraphs, lists, and supported media as
other imported Markdown, with references resolved relative to `_website.md`.
The whole body is public wherever that card appears; it is not automatically
truncated. An empty body adds no description area. Directory cards use this body
instead of an overview's frontmatter `description`; ordinary cards still use their
frontmatter description. An overview's description can still appear on its page.

Keep the existing collection index marker (such as the one authoring `/notes`). A
directory marker never supplies that index, and `metaDescription` is invalid on a
directory marker. Its `title` names the directory card/sidebar, not the collection.

Create `Learning/German/_index.md` with the separate landing-page content readers
see after clicking the card. It needs no frontmatter when publishing is inherited
and becomes `/notes/german`. Its title defaults to the directory title, but may be
overridden for that page; the card retains the marker's title. A nested
`General Concepts/_index.md` becomes `/notes/german/general-concepts`. Without a
selected `_index.md`, a folder heading only expands. `_index.md` is exact and
case-sensitive, and has special meaning only inside directory navigation. These
pages are collection entries, not collection index providers.

Only a selected root `_index.md` exports the marker body and creates its card;
an absent or unpublished overview exports neither. Writing mode includes
preview-only overviews normally. `publish: true` selects descendants unless an
individual document overrides it with `publish: false`; directory configuration
alone never publishes a document. Within a directory, markers without `collection`
can override supported folder defaults. Outside directory navigation, a marker
without `collection` retains its existing no-op behavior unless it declares a new
directory. Notes in directory navigation may omit dates; Blog still requires its
usual description, date, and tags, and People retains its contract.

For regular descendants, absent titles use filenames without `.md`; absent slugs
combine the directory slug, relative folders, and filename. For example,
`Language Transfer/Lessons/02 - Basic Vocabulary.md` becomes
`/notes/german/language-transfer/lessons/02-basic-vocabulary`. Segments use lowercase
ASCII, remove diacritics, and replace punctuation/whitespace runs with hyphens.
Empty segments and colliding URLs fail with source context. Renaming files or
folders changes derived URLs without redirects. Within directory navigation, an
explicit `slug` is relative to the containing folder URL. For example, a note in
`German/Language Transfer/` with `slug: "02"` uses
`/notes/german/language-transfer/02`, independent of its filename. Quote numeric
slugs so YAML preserves them as strings, including leading zeros. Slugs may also
contain multiple path segments, relative to the same containing folder.

A leading `/` overrides from the collection root: `slug: /german/lesson-02`
produces `/notes/german/lesson-02`, independent of the note's containing folder.
The collection route itself (`/notes` here) is never part of the authored slug.
Existing full slugs inside directory navigation must either gain a leading `/`
or be shortened to their folder-relative suffix to preserve their URLs. Directory
marker slugs remain collection-relative, and slugs outside directory navigation
keep their existing behavior. Explicit titles override filename defaults.
Folder overviews may override titles but must omit `slug` so their URL represents
the folder.

A nested directory marker establishes its own explorer. Its selected root overview
is a leaf link in the parent explorer; descendants appear only in its own explorer.
Directory slugs must be unique within a collection. Switching collections ends
inherited navigation. Only selected documents contribute to trees; unpublished
overviews are unlinked and empty branches disappear.

Folders sort before documents using English natural ordering. The current page is
highlighted and its ancestors open. Disclosure arrows expand branches; linked
titles navigate to overviews. Desktop uses a sticky, scrollable sidebar; mobile
starts with the directory root collapsed above the article. That root is the
explorer's sole heading and collapse control, without an extra Browse row.
Native disclosures and links
support keyboard navigation, and sidebar links do not open previews. Expansion
state is not saved.

`/notes` displays directory cards alphabetically before ordinary dated notes in
one list. Card titles have a blue `./` prefix, such as `./German`; dates come from
the overview, while tag badges come exclusively from the directory marker.
Directory descendants, including nested
folder overviews, stay out of the ordinary feed. Shared cards render marker Markdown
wherever they appear, including Blog's feed, whose inclusion still follows
`displayInFeed`. People receives no new directory route.

### Migrating older sidebar markers

Replace `sidebarTitle` with `title` and `sidebarSlug` with `slug`, and add
`directory: true`. If using the older nested `sidebar` object, move its `title` and
`slug` to those top-level properties and remove the object. Keep values unchanged
to preserve URLs. Legacy or mixed configuration fails with source-qualified
migration guidance. Keep `_index.md` for the landing page, and move any desired
card description into the `_website.md` body. The importer does not edit the vault.

Move existing directory-card tags from `_index.md` to `_website.md`. Leave tags
in both files only when they should appear on both the directory card and overview
page. Cards do not fall back to overview tags when marker tags are absent.

`directory` belongs only on markers. Individual documents cannot author
`navigation`, `directoryCard`, or legacy sidebar properties; these are reserved.
Generated nested `navigation` metadata remains website-owned and needs no Obsidian
migration.

## Supported content

Standard Markdown, footnotes, tables, and fenced code are preserved. Wikilinks
such as `[[Other note|label]]` become links when their target is selected. Links to
unselected notes become plain labels; their contents are never included. Ordinary
heading fragments and `[[Other note#Heading|label]]` are supported.

Wrap inline content in `==` to highlight it with a native HTML `<mark>` element:
`The ==-er== suffix` or `==some **bold** text and [a link](/notes)==`.
Multiple highlights can appear in the same paragraph, heading, list item, or
table cell. Highlights cannot span separate blocks. Unmatched markers, empty
pairs, and markers inside code remain literal. Escape a marker as `\==` to
display it literally. Highlights use the browser's default appearance and work
in articles, authored collection indexes, directory cards, and note previews.

Block anchors work in selected entry pages and authored Blog/Notes indexes.
Place a declaration at the end of a paragraph, heading, or list item, or put it
in its own paragraph immediately after a structured block:

```markdown
## Present Perfect ^present-perfect

The form uses have or has with a past participle. ^present-perfect-form

- An example sentence. ^example
  - A nested explanation.

> A quotation spanning the whole block.

^quotation

[[Forms#^present-perfect-form|Present Perfect]]
[[Forms#^present-perfect|The section]]
[[#^example|This example]]
[Quotation](Forms.md#%5Equotation)
```

Standalone declarations also work after lists, tables, headings, and fenced code.
The declaration must be outside the code fence. List-item declarations identify
the item, including its nested content. IDs are case-sensitive and accept Latin
letters, digits, hyphens, and underscores. Each ID must be unique within its source
document. The importer removes declarations and emits invisible native HTML
anchors without changing heading IDs, list formatting, or image captions.
For example, `## Present Perfect ^present-perfect` retains the normal
`#present-perfect` heading link and also supports the `#^present-perfect` block
link. The declaration is removed before the normal heading ID is generated.

Wiki links and inline or reference-style Markdown links support same-note and
cross-note blocks, including encoded `#%5Eid` carets. Published destinations use
the exact ID rather than a heading slug. Duplicate IDs, standalone declarations
without a preceding Markdown block, and links to missing IDs on selected public
targets fail preparation with source/target context, preserving previous output.
Block references to unavailable notes become formatted labels; private bodies are
not indexed. Missing or ambiguous note targets still fail the import.

Directory-card marker bodies and the unrendered People collection index retain
the previous behavior: their declarations are stripped, their outgoing block
links become labels, and links to their blocks also become labels. Escaped carets,
code contents, raw HTML, and external URLs are left literal in supported documents.
Block transclusion (`![[Note#^block]]`) remains unsupported.

Hovering or keyboard-focusing an eligible cross-note link previews the whole note.
For heading or block fragments, the panel initially scrolls to that target while
the main page stays still; readers can scroll above and below it. Links without
fragments, malformed encoded fragments, and targets absent from the fetched
article open at the top. Different fragments share one cached copy of a note but
each opening selects its own target. Preview copies remove actual IDs to avoid
collisions with the current page. Clicking still follows the original link.
Same-page links and collection roots retain normal navigation without previews.

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

Standalone images with nonblank alt text display that text as a caption beneath
the image, including linked images and wiki images with dimensions or centering.
Captions use plain text, not Markdown formatting, and retain the image's alt text
for accessibility. Image-only paragraphs containing several images, optionally
separated by line breaks, display a caption for each image with nonblank alt text.
Images within sentences and images inside authored figures do not receive
automatic captions. The same
caption rendering applies to entry pages, note previews, and authored collection
indexes.

Resolve references relative to the source note, then from the vault root, then by
unique filename. Ambiguous and missing references fail the import. Local images
support PNG, JPEG, GIF, WebP, AVIF, and BMP. HTTPS image URLs remain remote. Only
referenced local images are copied, under content-hashed filenames.

Local M4A audio embeds use `![[recording.m4a]]` or
`![[recording.m4a|Spoken example]]`. They resolve like images and are copied under
content-hashed filenames, rendering native playback controls with `preload="none"`,
an accessible label (alias or filename), and a fallback link. This support does not
include remote audio, other audio formats, or note transclusion.

Note embeds/transclusions, Dataview/Templater execution, local attachments other
than supported raster images and M4A embeds, and HTML resource attributes are unsupported. Replace them
with ordinary links, static Markdown, or raster image embeds. Code examples remain
literal; recognized executable plugin blocks are rejected.

## Generated files and errors

`.generated/{collection}` hold generated entries,
`.generated/_indexes` holds collection indexes, `.generated/_directories` holds
selected directory marker bodies keyed by collection and slug, and `public/_vault`
holds referenced images and audio. Root overviews reference their generated card
body with importer-owned `directoryCard` metadata. Astro registers `directoryCards`
separately, using the same Markdown loader and renderer without creating routes. They are gitignored and disposable. Never edit them. Astro derives
collection IDs from the generated slug filenames, then each collection's page
module creates its public routes.

The importer validates and prepares content before updating those directories.
During development, invalid edits report an error in the terminal and retain the
last successful import until corrected. Astro's generated-content loader also
prepares changed documents before updating its store, preserving the previous
store if preparation fails. It debounces generated Markdown events for 100 ms,
reuses unchanged documents within a development session, and renders every
entry again when development restarts. Production errors stop the build. Missing
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
message and do not act as buttons. Mobile tooltips stay within the calendar
width; long messages are not scrollable.

At widths of 820px and below, game icons between the month controls and calendar
select one full-content-width card. Connections is selected initially; changing
months preserves the selected game. Selection does not change the URL. Desktop
shows all four cards in a two-column grid. Without JavaScript, mobile stacks all
four cards and hides the game selector.

The vacation reason uses the existing supplied public SVG at
`public/images/game-absence-vacation.svg`. To swap the artwork everywhere, replace
that file, or place another asset under `public/images/` and change only the
reason's `illustration` path. Use an absolute public path beginning with `/`,
without traversal segments, whitespace, query strings, or fragments. These are
reused external image URLs, not inline SVGs or content-hashed assets; changing the
filename/path also changes the cache URL. No component changes or per-game copies
are needed.


## Game result ingestion

With `npm run dev`, open `/admin/ingest-game-data` to paste a native share or
enter one result manually. Both modes use the same editable normalized preview.
Editing immediately disables Save and hides replacement controls until the current
draft has a successful server preview. Saving disables editing and mode/game
switching until the request completes; failures leave the editor usable. Existing
same-date records require the explicit replacement action.

Static loading and admin ingestion share normalized
validation in `src/data/games/validation.ts`. Persisted arrays must contain valid
records with unique dates already in strictly ascending order. Fixed file paths,
persisted reads, and atomic JSON replacement belong to the Node-only
`src/data/games/persistence.ts`.


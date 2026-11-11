# Add the Obsidian-backed Library

## Summary

Add `/library` and category pages for finished books and movies. The entrance combines authored Markdown with dynamically discovered category cards. Category pages show validated works with expandable notes.

Keep the current Astro/GitHub Pages deployment and read-only vault workflow. No new dependencies, ratings, completion histories, search, or sorting controls.

## Authoring contract

Use this structure anywhere in the vault:

```text
Library/
  _website.md
  _index.md
  categories/
    01 Books/
      _index.md
      illustration.svg
    02 Movies/
      _index.md
      illustration.png
```

- `_website.md` declares `collection: library` and optional `publish`/`preview` defaults. Its body remains empty; Library does not use directory-navigation configuration.
- The root `_index.md` supplies the entrance content. Support `title` (default “Library”), optional `metaDescription`, and publication overrides.
- Each immediate category folder supplies an `_index.md` with required `title`, single-segment `slug`, and `type: books | movies`, plus optional publication overrides.
- Sort category folders naturally by filename, ascending, with a deterministic filename tie-breaker. Folder names never determine visible titles or URLs.
- Root and categories use existing publication precedence: defaults → marker → note. A selected entrance is required before any category can appear. Without a selected entrance, emit no Library routes or header link.
- Allow one Library root. Reject duplicate roots, duplicate selected category slugs, and unsupported selected category types with source-specific errors.

Category source example:

```markdown
---
title: Books
slug: books
type: books
publish: true
---

Books I’ve finished, with occasional thoughts.

## Piranesi

- Author: Susanna Clarke
- Year: 2020

A strange, beautiful world.

[[Books/Piranesi]]
```

- Markdown before the first top-level H2 introduces the category.
- Each top-level H2 starts a work. H3–H6 headings belong to its summary.
- The first block after each work heading must be an unordered metadata list.
- Books require a nonempty title, at least one `Author`, and one `Year`. Repeat `Author` for coauthors.
- Movies require a nonempty title and one `Year`.
- `Year` is a positive integer of at most four digits. Reject missing, malformed, duplicate scalar, and unsupported metadata fields.
- Everything after the metadata list is optional public Markdown summary content. Ordinary links need no special designation.
- An empty category is valid and displays “0 entries.”

## Importing and content loading

- Register `library` at `/library` in the collection registry, with collection-specific Zod schemas. Keep Library discovery and work parsing in a focused helper called by `scripts/vault.mjs`.
- Reuse vault discovery, publication selection, route collision checks, Markdown/link/media preparation, and output synchronization. Library’s entrance comes from its root `_index.md`; existing collections retain their marker-authored index behavior.
- Treat only immediate `categories/<folder>/_index.md` files as category sources. Other Markdown files do not become Library entries automatically; separate commentary notes must belong to their own published collection.
- Parse work boundaries and metadata through the existing Markdown AST tools. Prepare links, reference definitions, images, highlights, and block anchors with the original category source path before emitting separate introduction and summary documents.
- Keep title/heading anchors consistent with the authored document despite year-based display sorting. Ordinary links to unavailable notes retain existing label-only behavior; referencing a note never publishes it.
- Generate entrance content in the existing index output, category introductions under `.generated/library/`, and route-free work-summary documents under `.generated/_library-works/`.
- Category metadata contains its type, ordered work-document references, display order, and optional public illustration URL. Derive counts from those references.
- Reuse the generated-Markdown loader for categories and a separate internal `libraryWorks` collection. Validate generated work metadata with the corresponding Books or Movies schema; render summaries through the existing Astro Markdown processor.
- Sort works by descending year, preserving source order for ties. Work-document IDs remain internal and create no individual URLs.
- Discover optional exact sibling filenames `illustration.svg` and `illustration.png`, preferring SVG. Copy selected artwork through the existing content-hashed asset mechanism; render SVG as an external image.
- Add SVG to vault watcher events without broadening ordinary Markdown image-embed support.
- Include Library routes in route listings and collision checks, reserve its namespace against root-relative Pages, and remove stale Library documents/artwork through existing synchronization. Preparation failures preserve previous output.

## Website presentation and navigation

- Generate the entrance and category URLs through a Library rest-parameter page template, including the entrance only when selected. This avoids emitting an empty `/library` before vault setup.
- Use the shared page shell, fonts, spacing, colors, footer, and article typography.
- Entrance: render its heading and authored introduction above a two-column card grid, collapsing to one column at the existing mobile breakpoint.
- Cards: use the white card background, subtle ink border, rounded corners, and restrained theme-consistent hover/focus treatment. Reserve equal illustration areas and equal card heights, including on mobile.
- Render artwork with contained proportions and a downward CSS transparency gradient that finishes before the title. Keep image and text on one continuous background without an internal frame or divider.
- Missing artwork leaves the reserved area blank. Show the category title and calculated “1 entry”/“N entries.” Make the whole card one accessible link; treat artwork as decorative.
- Category pages: show the category title and introduction, followed by a vertical list with subtle separators. Keep title, author(s) for books, and year visible.
- Render nonempty summaries in native, initially collapsed `<details>` elements labeled “Notes.” Omit the disclosure for empty summaries. Use ordinary Markdown styling and navigation for their contents.
- In `src/components/SiteHeader.astro`, retain Work, Blog, and Notes and add a themed “…” disclosure containing Library. Hide that disclosure when Library is unavailable.
- Give the control an accessible “More links” name. Support click/tap, keyboard operation, Escape, and outside-click dismissal; use ordinary navigation links rather than application-menu roles.
- Explicitly exclude Library destinations from note-preview eligibility so registering the collection does not make existing preview controllers fetch incompatible category pages.

## Documentation and acceptance

Update the repository responsibility map and authoring documentation with the folder layout, schemas, metadata syntax, publication rules, artwork convention, sorting, and generated-output ownership. Include copyable Books and Movies examples. Do not modify the private vault or generate placeholder artwork.

Per repository instructions, the implementing agent must not run tests, builds, checks, servers, previews, or manual verification. The handoff must state that no verification was performed and provide these user-run checks:

1. Start the normal development workflow without a Library marker: existing pages load, with no Library route or menu item.
2. Add the documented Library structure: confirm introduction text, category order, titles, URLs, counts, and SVG-over-PNG selection.
3. Check desktop and mobile cards for equal sizing, blank artwork reservations, seamless fading, and keyboard focus.
4. Confirm Books and Movies sort newest year first, preserve ties, display required metadata, and expand Markdown notes correctly.
5. Compare production and writing-mode selection, including an unpublished entrance and preview-only categories.
6. Edit, rename, remove, and replace category sources and artwork; confirm refreshes and stale-output removal.
7. Introduce invalid work metadata or a duplicate category slug; confirm a useful import error and preservation of the previous output.
8. Exercise the header disclosure with keyboard, touch, Escape, and outside clicks, then run the normal build workflow.

# Phase 5: Vault-authored collection indexes

## Objective

Use the explicit root `_website.md` as the authored content source for a
collection index while keeping index existence, rendering, listing, and sorting in
website code.

## Prerequisites

- Phases 0 through 4 are complete.
- Read their handoffs and `tasks/multiple-collections/README.md`.
- The user will prepare the real vault before code requiring this contract is run.
  Never create or edit the vault marker yourself.

## Final marker example

```md
---
collection: blog
route: /blog
publish: false
preview: false
displayInFeed: true
tags:
  - writing
title: Blog
metaDescription: Writing by Raspreet Singh.
---

I wish I had a story to tell... I don't. Why write, then?

Umm, why not?
```

All properties except `collection` are conditional or optional according to the
registered collection definition. The example is intentionally verbose.

## In scope

### Capability ownership

- Website code decides whether a registered collection has an index component.
- An active collection with an index component requires one explicit root marker
  to supply `title` and `metaDescription`.
- The marker body is optional and supplies authored index content.
- A collection with an index can render an empty entry list.
- A registered collection without an index component must reject `title`,
  `metaDescription`, or non-whitespace marker body content with a targeted error.
- At most one explicit root per collection may supply index content. Fail with all
  candidate paths rather than using traversal order.

### Index document behavior

- Treat index content as a special document, not a collection entry.
- It has no entry slug, `publish`, `preview`, or note-level `collection` semantics.
  The same flat names may still exist on the marker as folder defaults where the
  collection permits them; keep those roles explicit in the parser.
- It is implicitly available whenever its collection index is active.
- It does not appear in entry lists and does not use the ordinary entry schema.
- It is a first-class public wikilink target with a canonical identity distinct
  from `(collection, slug)` entry identities, for example
  `{ kind: "collection-index", collection: "blog" }`.
- A wikilink whose source reference resolves to the active index-owning
  `_website.md` generates the collection's effective root URL. For example,
  `[[Blog/_website|Blog]]` becomes `[Blog](/blog)` when `/blog` is the effective
  route.
- Preserve the existing reference-resolution rules. Because `_website.md` exists
  in multiple folders, a bare `[[_website]]` reference fails when ambiguous;
  authors disambiguate it with the vault path. Do not add alias-based resolution.
- A marker for an inactive, unknown, skipped, or no-index collection is not a
  public target; links to it degrade to their plain label under the existing
  privacy rule.
- Transform its Markdown through the same safe Markdown pipeline as entries.
- Support headings, ordinary Markdown, local images, external HTTPS images, and
  outgoing wikilinks.
- Links to content unavailable in the current build become plain text.
- Only referenced local index images are copied.

### Blog index migration

- Keep the blog index component and its visual styling in website code.
- Replace the hardcoded visible heading/introduction with rendered marker metadata
  and body.
- Pass `title` and `metaDescription` to `BaseLayout` for document and Open Graph
  metadata.
- Keep the existing blog entry query, `displayInFeed` filtering, descending
  `publishDate` ordering, empty-state text, card markup, and styles unless a small
  adapter is required by the generic route structure.
- Do not copy the current prose into this repository as new fallback content. The
  user owns that content in the vault.

### Future collection behavior

- Default index ordering is normalized `title` ascending with canonical `slug` as
  a deterministic tie-breaker.
- Blog explicitly overrides ordering with descending `publishDate`.
- Query configuration stays in website code for now. Do not add marker-configured
  sorting yet.
- Adding an index to a future collection should require an index component/schema
  registration, not importer-specific branching.

## Suggested implementation shape

Keep index-document storage separate from ordinary entries so an index cannot be
accidentally validated by an entry schema or returned in entry queries. This may be
a dedicated generated directory/content collection or a loader-level side channel;
choose the smallest Astro-compatible option with an explicit schema.

Reuse the existing Markdown transformation primitives. Do not fork a second link
and asset implementation for index content.

## User verification scenarios

The implementing agent must not perform these checks. Include them as concrete
steps for the user in the phase handoff:

- An indexed active collection requiring `title` and `metaDescription`.
- An optional empty body rendering the list normally.
- Visible body content appearing above the blog list.
- Page title and meta/OG description coming from marker properties.
- Markdown, image, heading, and cross-collection wikilink transformation in index
  content.
- Private or skipped wikilink targets becoming plain text.
- Index content not appearing as an entry while its qualified marker wikilink
  resolves to the effective collection root.
- A bare `[[_website]]` target resolving only when unique and failing under the
  existing ambiguity rule when multiple marker filenames match.
- Links to inactive, unknown, skipped, and no-index markers becoming plain text.
- Index heading fragments resolving against the collection root URL.
- Duplicate index providers failing with both marker paths.
- Index content for a no-index collection failing.
- Blog ordering, feed filtering, empty state, and current visual selectors staying
  intact.
- Marker-content changes refreshing the dev page.

## Non-goals

- Editing the real vault
- A generic user-configurable index template
- Marker-configured sorting
- RSS generation
- Navigation generation
- Backlinks or hover previews
- Production registration of `people`

## User verification commands

Ask the user to run:

```sh
npm run build
git diff --check
```

Tell the user to use a temporary sample vault when their vault is unavailable or
not prepared. If the user performs a final visual check against the real prepared
vault, it must remain strictly read-only.

## Acceptance criteria

- The blog index's authored header and page metadata come exclusively from its
  root `_website.md`.
- Website code still owns layout, list selection, and ordering.
- Index content uses the safe shared Markdown/link/asset pipeline and is a public
  link target without becoming an entry.
- Invalid or ambiguous index ownership fails clearly.

## Stop condition

Stop after implementing the acceptance criteria. Show the division between index
content and index rendering, list changed files, state that verification was not
performed and that the vault was not modified, and give the user verification
steps. Do not begin Phase 6.

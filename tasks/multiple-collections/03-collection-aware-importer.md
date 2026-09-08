# Phase 3: Collection-aware importer

## Objective

Generalize importer identity, validation, output, and wikilink generation around a
collection registry, while keeping `blog` as the only production collection.

## Prerequisites

- Phases 0 through 2 are complete.
- Read their handoffs and `tasks/multiple-collections/README.md`.

## In scope

### Registry seam

Evolve the minimal known-collection seam into a registry whose definitions can
provide, directly or through cohesive website-side adapters:

- Collection ID
- Entry metadata validation and public projection
- Optional marker-default validation
- Default route
- Astro content schema/loader registration
- Entry renderer selection
- Optional index capability and ordering (wired in later phases)

There must be one authoritative set of production collection IDs. Avoid parallel
registries that can silently disagree. It is acceptable to separate Node-safe
import configuration from Astro component imports when runtime constraints require
it, but add an explicit parity check or derive both views from one definition.

Register only `blog` in production. A temporary local registry configuration may
add a minimal second definition, such as `people`, for the user's verification of
the generic path; do not commit it as a production collection.

### Canonical identity

- Represent every selected entry by `(collectionId, slug)`.
- Enforce slug uniqueness within a collection.
- Permit the same slug in two different registered collections.
- Keep Phase 3 slugs single-segment; nested segments arrive in Phase 4.
- Error messages for duplicates must identify the collection and both source
  notes when practical.

### Generated output

- Write selected entries below `.generated/<collectionId>/<slug>.md`.
- Treat the importer-managed generated root as a complete snapshot: collection
  directories and files absent from the new import must not survive as stale
  output.
- Preserve content-hashed shared images under `public/_vault`.
- Return collection-neutral statistics while retaining compatibility only where
  it materially simplifies the transition.

### Astro content loading

- Replace the blog-specific loader implementation with a reusable collection
  loader or factory.
- Keep production `src/content.config.ts` statically registering `blog`, as Astro
  requires build-time-known collections.
- The loader must not assume that all collections share the blog schema.
- Adding a future registered collection must not require modifying generic loader
  traversal.

### Wikilinks

- Keep current Obsidian source-reference resolution: source-relative, then
  vault-root-relative, then globally unique filename.
- After a target source note resolves, obtain its canonical collection identity.
- Use the target collection's default route when generating its URL.
- A target that is private, preview-only in production, unknown, or skipped becomes
  plain label text.
- Do not leak skipped metadata or paths.
- Preserve heading-fragment behavior.

## Suggested implementation shape

Build a selected-note lookup keyed by source file and store canonical identity on
each note. Route construction should be a dedicated function accepting collection
and slug rather than string interpolation scattered through Markdown transforms.

Keep the link resolver's result capable of representing different public target
kinds instead of equating every public target with an entry. This phase needs only
the entry variant; Phase 5 will add collection-index targets backed by
`_website.md` without adding them to entry schemas or lists.

Make `importVault` accept a registry or registry view so temporary local
configurations do not require globally registering additional collections.
Production callers should use the website's default registry without extra
ceremony.

## User verification scenarios

The implementing agent must not perform these checks. Include them as concrete
steps for the user in the phase handoff.

The user can temporarily configure a second collection with a deliberately
different minimal schema and verify:

- Both registered collections import in one pass.
- They write to distinct generated directories.
- The same slug can exist in both.
- A duplicate within either one fails.
- A note is validated and projected by its own collection definition.
- A wikilink from one collection to another uses the target collection's default
  route.
- Production/private/unknown target links become plain text.
- Removing a marker or registry definition removes stale collection output.
- The real production content configuration still exports only `blog`.
- Existing blog, image, series, and privacy behavior remains unchanged.

## Non-goals

- Production registration or UI for `people`
- Route overrides
- Nested slug segments
- Generic catch-all page routing
- Collection index content

## User verification commands

Ask the user to run:

```sh
npm run build
git diff --check
```

## Acceptance criteria

- Generic importer code handles at least two injected collection definitions.
- Identity, uniqueness, output, validation, and wikilinks are collection-aware.
- Production remains blog-only without duplicated registry IDs.
- Existing blog behavior remains visually and functionally unchanged.

## Stop condition

Stop after implementing the acceptance criteria. Show how a future collection
definition enters the registry and flows through import/output/link generation,
list changed files, state that verification was not performed, and give the user
verification steps. Do not begin Phase 4.

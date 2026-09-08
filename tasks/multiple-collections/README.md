# Multiple collections implementation plan

## Goal

Replace the vault-wide, blog-only import with explicit, Obsidian-native collection
boundaries while preserving the current privacy and last-known-good behavior.

This directory is the implementation contract produced from the collection design
discussion. The work is split into seven ordered phases so that each change can be
reviewed and understood independently.

## How to run the work

Implement everything:

```text
/goal Implement tasks/multiple-collections/README.md in phase order. Complete every phase without running tests, builds, linters, previews, development servers, or manual verification. Do not modify the Obsidian vault. For each phase, report that verification was not performed and give me its concrete verification steps. Stop only when every phase and the final implementation criteria are addressed.
```

Implement one phase:

```text
/goal Implement tasks/multiple-collections/00-importer-foundations.md. Read tasks/multiple-collections/README.md first, respect its invariants, and do not run tests, builds, linters, previews, development servers, or manual verification. Report that verification was not performed and give me the phase's concrete verification steps. Do not begin a later phase.
```

Replace the filename for later phases. When phases are run separately, keep each
phase's changes distinct before beginning the next one, but do not create commits
unless the user explicitly asks. Do not run multiple phase goals concurrently
because they intentionally touch the same importer and routing code.

## Required reading

Before changing code, read:

- `README.md`
- `docs/understanding/codex-authored/DEVELOPMENT.md`
- `scripts/vault.mjs`
- `scripts/site.mjs`
- `scripts/blog-loader.ts`
- `src/content.config.ts`
- `src/pages/blog/index.astro`
- `src/pages/blog/[slug].astro`
- Every earlier phase document when implementing a later phase

Treat the current code and documented behavior as evidence. If a suggested
internal API in these
documents conflicts with Astro or repository constraints, choose the smallest
design that preserves the stated behavior and record the deviation in the phase
handoff. Product invariants and acceptance criteria are authoritative; illustrative
filenames and function names are not.

## Phase order

0. [Importer foundations](00-importer-foundations.md)
1. [Collection boundaries](01-collection-boundaries.md)
2. [Folder defaults](02-folder-defaults.md)
3. [Collection-aware importer](03-collection-aware-importer.md)
4. [Routes and nested slugs](04-routes-and-nested-slugs.md)
5. [Vault-authored collection indexes](05-collection-indexes.md)
6. [Hardening, integration, and documentation](06-hardening-and-documentation.md)

## Final domain model

### Marker and ownership

- The exact, case-sensitive filename `_website.md` marks an import boundary.
- The marker is a Markdown note because it must be visible and editable in
  Obsidian. It is never imported as a normal entry.
- A marker with `collection` starts a collection boundary. Collection boundaries
  are not nested, and descendant `_website.md` files do not need to be supported.
- A marker owns ordinary notes in its directory and unmarked descendants
  recursively. Notes with no owning marker are ignored.
- Hidden path components and symlinks remain excluded.
- Marker properties are flat because Obsidian's normal property editor does not
  support nested properties.

### Registry and unknown collections

- Website code owns a static collection registry. The first production registry
  contains only `blog`.
- A collection definition owns its entry schema, optional folder-default schema,
  default route, entry renderer, optional index renderer, and sorting behavior.
- Adding a future collection must not require changes to vault traversal, output
  synchronization, wikilink resolution, or generic routing.
- An unregistered collection emits one warning identifying the collection and
  marker, then skips the notes and index content it owns.
- A wikilink to skipped or unselected content becomes plain text. Do not emit an
  additional warning for each such link.

### Metadata and privacy

- Every selected entry explicitly supplies `title` and `slug`.
- `publish` and `preview` default to `false` after folder inheritance.
- The blog keeps its existing collection-specific requirements, including
  `description` and `publishDate`.
- Blog folder defaults initially permit only `publish`, `preview`,
  `displayInFeed`, and `tags`. Other collection definitions may expose a
  different allowlist or no folder defaults at all.
- A boundary marker replaces a collection metadata default. A note replaces a
  marker value. Arrays replace arrays; they are not concatenated.
- `collection` is structural. A `collection` property on an ordinary note is an
  error, even though unrelated private note properties remain excluded from
  generated frontmatter as they are today.
- Production links and output must not expose private, preview-only, skipped, or
  otherwise unavailable notes.

### Identity, output, and URLs

- An entry's canonical identity is `(collection, slug)`.
- Slugs are unique within a collection, not globally.
- Slugs may contain multiple lowercase kebab-case segments, for example
  `scientists/ada-lovelace`.
- Source folder paths never determine public URLs.
- Generated entries live below `.generated/<collection>/`.
- Website code defines a collection's default route. An explicit collection
  marker may override it for the entire collection.
- Multiple overrides for one collection must agree.
- Prefix-sharing routes are allowed. Exact final URL collisions are not. Validate
  generated entries and collection indexes against each other and handwritten
  site routes at build time.
- Changing a route or slug does not create automatic redirects.

### Index content

- Website code decides whether a collection has an index and how it is rendered,
  listed, and sorted.
- A root `_website.md` for a collection with an index supplies `title`,
  `metaDescription`, and optional Markdown body content for that index.
- Index Markdown uses the same safe Markdown, wikilink, and local-image pipeline
  as entries.
- An active, registered collection index is a first-class public wikilink target
  with an identity distinct from ordinary entries. Linking to its source
  `_website.md` produces the collection's effective root URL.
- Because every marker has the same filename, authors must use the existing
  path-qualified Obsidian syntax when a bare `[[_website]]` reference is
  ambiguous, for example `[[Blog/_website|Blog]]`.
- An index remains outside the collection entry schema and entry list. Making it
  linkable must not turn it into an ordinary entry or require an entry slug.
- At most one explicit root supplies index content for a collection.
- Index metadata or body content for a registered collection without an index
  renderer is an error.
- A collection with an index can render an empty entry list. A registered
  collection produces no collection content routes until a vault marker activates
  it.
- Default list order is normalized title ascending, then canonical slug. Blog
  overrides this with descending publication date.

### Failure and lifecycle behavior

- No markers is a successful empty import and removes stale importer-managed
  content and assets.
- Malformed YAML inside an owned registered tree fails the refresh, even for an
  unselected note. Full entry-schema validation applies only to selected notes.
- Invalid registered marker keys, invalid defaults, conflicting routes, duplicate
  identities, and exact route collisions fail with paths and actionable details.
- All validation and rendering happens before replacing the last successful
  generated output. Development failures retain that output; production failures
  stop the build.
- The importer never writes to the Obsidian vault.

## Final implementation criteria

These are the intended observable outcomes. The implementing agent must not run
commands or perform manual checks to verify them; the user performs verification
from the concrete steps supplied in each handoff.

- A temporary local vault and registry configuration can activate two registered
  collections without changing generic importer code or production registration.
- Each collection uses its own schema, output directory, default route, and
  renderer selection.
- Same-slug entries in different collections work; duplicate slugs within one
  collection fail.
- Cross-collection wikilinks use the target collection's effective route.
- Wikilinks to an active collection's `_website.md` resolve to that collection's
  effective root URL, while normal ambiguity rules still apply.
- Nested slugs produce nested public URLs without deriving them from source paths.
- Unknown collections warn once and are skipped.
- Folder defaults and note overrides follow the defined precedence.
- Blog index text and page metadata come from `_website.md`; website code retains
  layout, list rendering, and ordering.
- Empty imports remove stale generated content.
- Failed refreshes retain the prior successful generated state.
- The user can run `npm run build` successfully against an appropriate temporary
  sample or user-prepared vault.
- Documentation explains the final vault contract and the steps required to add a
  future collection.
- No file in the external Obsidian vault was created, edited, renamed, or deleted.

## Global constraints

- Do not modify the user's Obsidian vault. The user will create and edit
  `_website.md` themselves.
- Preserve existing note-body rendering, image hashing, series behavior, preview
  isolation, and private-metadata filtering unless a phase explicitly changes the
  relevant contract.
- Do not register a production `people` collection. Use a temporary local
  definition while verifying multi-collection behavior.
- Give the user concrete commands and manual steps for verifying each behavior
  change in the same phase. Clearly state that verification was not performed.
- Keep every phase reviewable. Avoid unrelated style or architecture refactors.
- Do not claim that checks passed or report observed verification results.

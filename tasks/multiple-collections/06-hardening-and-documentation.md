# Phase 6: Hardening, integration, and documentation

## Objective

Harden the complete multi-collection path against the agreed invariants, close
failure/lifecycle gaps found through code inspection, and document the author and
developer workflows.

## Prerequisites

- Phases 0 through 5 are complete.
- Read every earlier phase handoff and `tasks/multiple-collections/README.md`.

## In scope

### Atomic refresh behavior

- Validate and render every registered collection, index document, link, and asset
  before replacing importer-managed output.
- A failed development refresh retains the complete prior successful snapshot.
- Avoid a mixed generation where assets update but collection content remains old,
  or one collection updates while another remains stale.
- Production errors stop before Astro builds invalid or partial content.
- Keep temporary files/directories bounded to the project or OS temporary
  directory and clean them after success or failure.

### Stale-output ownership

- Define exactly which generated roots the importer owns.
- A successful empty import removes all old collection entries, index documents,
  and unreferenced vault assets.
- Removing a collection marker, entry, index body image, or nested slug removes the
  corresponding stale artifacts.
- Do not delete unrelated project files.

### Diagnostics

Audit errors and warnings for actionable source context:

- Malformed marker or note YAML
- Unknown marker keys
- Unsupported folder defaults
- Note-level `collection`
- Unknown collection warnings
- Conflicting route overrides
- Duplicate `(collection, slug)` identities
- Unsafe nested slugs
- Exact route collisions with both owners
- Duplicate/misplaced index content
- Broken or ambiguous links and assets

Unknown collections warn once per boundary. Links to their skipped content do not
produce warning floods.

### Watcher and mode behavior

- Provide user verification steps for marker creation, edits, renames, moves, and
  deletion.
- Include steps for note movement across collection boundaries.
- Include steps for route, default, title, meta-description, and index-body edits.
- Include steps for nested slug changes and image changes.
- Include steps confirming production never serves preview-only content after a
  writing-preview session.
- Include steps confirming the dev process retains last-known-good output after a
  failed change and recovers after correction.

### Documentation

Update `README.md` and
`docs/understanding/codex-authored/DEVELOPMENT.md` to describe the final behavior,
including:

- Exact `_website.md` naming and recursive ownership
- Explicit collection boundaries and the assumption that markers are not nested
- The final blog marker example
- Flat, collection-specific folder defaults and precedence
- Required entry metadata and nested slug rules
- Unknown collection warning/skip behavior
- Route defaults and overrides
- Index metadata/body ownership
- Path-qualified wikilinks to collection indexes and `_website.md` ambiguity
- Production versus writing-preview selection
- Wikilink privacy across collections
- Generated directory ownership and recovery behavior
- The fact that the importer never writes to the vault

Add a developer-facing guide, either in `docs/` or as a clearly named section, for
registering a future collection. It must identify every required extension point:

- ID and default route
- Entry schema and public metadata projection
- Optional folder-default schema
- Entry renderer
- Optional index schema/component and sort behavior
- Astro content registration constraints
- A manual procedure for verifying same-slug isolation and cross-collection links

Do not document `people` as already supported.

### Design record

Populate `docs/Design.md` or another intentional design document with the durable
decisions and their rationale: Obsidian-visible Markdown marker, structural
collection ownership, code-owned rendering, vault-owned editorial index content,
canonical identity, route ownership, privacy, and unknown-collection behavior.
Avoid copying transient implementation notes into the durable design record.

## User verification checklist

The implementing agent must not perform these checks. Include concrete steps for
the user to exercise and inspect at least:

- No markers and stale cleanup
- Registered and unknown collection boundaries
- Collection-specific defaults and note overrides
- Production/preview selection
- Per-collection schema validation and same-slug isolation
- Cross-collection wikilinks and private/skipped targets
- Default and overridden routes
- Nested slugs and route collisions
- Collection index metadata, Markdown, images, and ordering
- Qualified collection-index wikilinks, ambiguous bare marker links, and links to
  unavailable indexes
- Series pages and return links
- Hidden paths and symlinks
- Unsupported Obsidian syntax
- Atomic recovery from failed refreshes
- Dev watcher recovery and production build privacy scan

Describe the representative vault states and commands in the handoff. State that
verification was not performed; do not report observed results.

## Non-goals

- Modifying the vault
- Registering `people` or any second production collection
- RSS generation
- Automatic navigation
- Backlinks
- Hover previews
- Automatic redirects
- Filename-derived titles or slugs
- Marker-configured sorting

## User verification commands

Ask the user to run all of the following:

```sh
npm run build
git diff --check
```

Also ask the user to inspect `git status --short` and ensure no generated output,
vault content, or unrelated files are accidentally staged or modified. If a
real-vault build is not possible, provide steps using a representative temporary
sample vault.

## Acceptance criteria

- Every final implementation criterion in
  `tasks/multiple-collections/README.md` is addressed.
- The handoff contains the complete user verification checklist.
- Documentation matches actual commands, paths, schemas, and failure behavior.
- The implementation has one clear extension path for future collections.
- No external vault file was modified.

## Stop condition

Stop after implementing the acceptance criteria and final plan criteria. Provide
a compact final report containing:

- Behavior delivered
- Architecture/extension seam
- A statement that verification was not performed, followed by concrete build and
  manual verification steps for the user
- Vault changes the user must make themselves
- Any intentional limitations from the non-goals
- Changed-file summary

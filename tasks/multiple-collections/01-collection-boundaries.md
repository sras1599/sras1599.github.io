# Phase 1: Collection boundaries

## Objective

Make `_website.md` the explicit, recursive opt-in boundary for vault imports while
keeping the current blog schema, flat blog slugs, generated output location, and
Astro pages intact.

This phase answers one question visibly: **which vault notes are eligible for the
website importer to inspect?** It does not yet generalize schemas, output, or
routing.

## Prerequisites

- Phase 0 is complete.
- Read `tasks/multiple-collections/README.md` and the required repository files it
  lists.
- The user is responsible for adding `_website.md` to the real vault. Do not edit
  the vault.
- The user may use a temporary sample vault for verification when the real vault
  has not been prepared. Never edit the user's vault.

## In scope

### Marker discovery

- Recognize only the exact, case-sensitive filename `_website.md`.
- Continue traversing recursively while excluding hidden path components and
  symlinks.
- Parse marker frontmatter as YAML. A marker without valid leading frontmatter is
  invalid.
- For this phase, use `collection: blog` to establish an explicit boundary and
  create enough internal structure to add registered collection IDs without
  rewriting the traversal algorithm.
- A user-prepared marker may already contain final-contract properties or Markdown
  body content. Preserve and reserve those values without applying them yet so a
  phase-by-phase build remains forward-compatible. Only `collection` changes
  behavior in this phase; later phases activate defaults, routes, and index
  content. Truly unknown property names become strict errors in Phase 2.
- Reserve the marker file: it must not enter normal note selection or the ordinary
  entry-target lookup. Phase 5 deliberately adds a separate collection-index link
  target for active index markers.

### Ownership

- An explicit marker owns ordinary Markdown notes in its directory and unmarked
  descendants.
- A nested explicit marker starts an independent boundary and owns its subtree.
- Notes outside every marker are ignored, even if they contain `publish: true`.
- Discovery must not stop at an unknown boundary. A nested `blog` marker remains
  discoverable.

### Unknown collections

- The production known-collection set contains only `blog`.
- For every explicit unknown boundary, emit one warning that contains its
  collection ID and marker path.
- Skip ordinary notes owned by that boundary.
- Do not emit per-note or per-wikilink warnings.

### Empty imports and refreshes

- No markers is a successful import with zero selected entries.
- Removing the last marker or changing `blog` to an unknown collection removes
  stale generated blog entries and now-unreferenced assets.
- Preserve prepare-before-sync behavior so parse/render failures do not erase the
  prior successful content.
- Update import summaries to use neutral wording where practical; avoid baking
  more `posts`/`blog` assumptions into new interfaces.

### Development watching

- A `_website.md` save, creation, rename, or deletion already matches the Markdown
  watcher extension. Include steps for the user to confirm that each change
  triggers refresh and changes eligibility.

## Suggested implementation shape

Represent discovery separately from selection. A useful intermediate result is a
list or map of Markdown files with their nearest explicit owner:

```text
file -> { markerPath, collectionId, registered }
```

Do not implement ownership by repeatedly rescanning ancestors for every note if a
single ordered traversal can carry current boundary state. Preserve POSIX-style
relative vault paths in importer data regardless of host platform.

The registry in this phase can be minimal, but it must be an explicit seam rather
than another scattered `collectionId === "blog"` condition. Later phases will add
schemas, routes, and renderers to that seam.

## User verification scenarios

The implementing agent must not perform these checks. Include them as concrete
steps for the user in the phase handoff:

- A published note under `Blog/_website.md` imports.
- An otherwise valid published note outside all markers does not import.
- The marker itself never becomes an ordinary entry. Collection-index wikilink
  targeting is deferred to Phase 5.
- Matching is exact and case-sensitive.
- Unmarked descendants inherit eligibility recursively.
- A nested explicit marker owns its subtree independently.
- An unknown collection warns once and imports none of its owned notes.
- A registered marker nested inside an unknown tree still imports.
- No markers succeeds and clears prior generated entries/assets.
- A malformed marker fails without replacing the last successful output.
- Adding or removing a marker while the development server runs changes route
  availability for its entries. The physical `/blog` index is still a handwritten
  page in this phase and may continue to exist when no marker is active;
  collection-index activation is completed in Phases 4 and 5.

## Non-goals

- Folder defaults or refinement markers without `collection`
- Multiple generated collection directories
- Per-collection schemas or Astro content collections
- Route overrides, nested slugs, or route collision validation
- Vault-authored index content
- Registering `people`

## User verification commands

Ask the user to run:

```sh
npm run build
git diff --check
```

If the real `VAULT_PATH` has not yet been prepared, tell the user how to use a
temporary sample vault for the build. Do not modify the real vault to make the
check pass.

## Acceptance criteria

- Only notes owned by a registered explicit marker can be selected.
- Unknown boundaries warn once, skip their content, and do not hide nested known
  boundaries.
- Empty eligibility removes stale importer-managed output.
- Existing blog entry rendering, series behavior, images, and preview isolation
  remain intact for marked content.

## Stop condition

Stop after implementing the acceptance criteria. Summarize the ownership
algorithm, list changed files, state that verification was not performed, give
the marker setup and commands the user can use, and call out the intentional
temporary limitation around the handwritten `/blog` index. Do not start Phase 2.

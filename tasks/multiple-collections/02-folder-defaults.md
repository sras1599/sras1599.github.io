# Phase 2: Folder defaults

## Objective

Add strict, collection-specific folder defaults to each collection boundary's
`_website.md`, with ordinary note metadata taking precedence.

## Prerequisites

- Phases 0 and 1 are complete.
- Read `tasks/multiple-collections/README.md` and the Phase 1 handoff.
- The user may use a temporary sample vault for verification when needed. Never
  edit the user's vault.

## In scope

### Blog marker schema

Marker properties remain flat. The initial registered `blog` definition permits:

```yaml
collection: blog       # required structural boundary identifier
publish: false         # optional inherited default
preview: false         # optional inherited default
displayInFeed: true    # optional inherited default
tags:                  # optional inherited default
  - writing
```

At this phase, `route`, `title`, `metaDescription`, and marker body content remain
recognized, reserved final-contract values. Preserve them so a user-prepared final
marker works during phased implementation, but do not interpret them as note
defaults. Route behavior begins in Phase 4 and index behavior in Phase 5.

The schema for allowed defaults belongs to the collection definition. A future
collection may expose different defaults or no defaults at all.

### Default and override rules

- Assume a collection boundary has no descendant `_website.md` files. Nested
  markers and nested collection boundaries do not need to be supported.
- A boundary marker's declared default values replace the collection definition's
  metadata defaults.
- An ordinary note's declared values replace effective marker defaults.
- Arrays replace rather than concatenate.
- A marker for a collection with no folder-default schema must reject default
  properties.

The precedence chain is:

```text
collection's metadata defaults < boundary marker < note
```

Do not confuse schema defaults used to normalize public output (for example,
`displayInFeed: true`) with author-controlled folder inheritance. Keep the order
explicit in code and documentation.

### Selection and validation

- Determine selection from effective `publish` and `preview` values.
- `publish` and `preview` default to `false` when absent everywhere.
- Production selects effective `publish: true` only.
- Writing preview selects effective `publish: true` or `preview: true`.
- The literal YAML boolean `true` is required; strings do not select.
- Parse every ordinary Markdown note owned by a registered boundary. Malformed
  frontmatter YAML fails even when the note would not be selected.
- Apply the full blog entry schema only after a note is selected.
- A selected note still explicitly requires `title`, `slug`, `description`, and
  `publishDate` in this phase. Structural identity fields cannot be inherited.
- If an ordinary note declares `collection`, fail with a message directing the
  author to move the note or edit `_website.md`.
- Continue whitelisting public metadata so unrelated private properties do not
  leave the vault.

### Strict marker validation

- Reject unknown keys for registered collection markers and name the marker path
  and key. The known reserved keys `route`, `title`, and `metaDescription` are not
  unknown even though later phases activate their behavior.
- Validate every default at the marker where it is declared.
- Unknown collection boundaries keep Phase 1 behavior: warn and skip. Because no
  collection schema exists, do not pretend to validate their collection-specific
  defaults.

## Suggested implementation shape

Keep these concepts distinct in data structures and functions:

- Raw parsed marker
- Resolved collection boundary
- Effective folder defaults
- Raw note metadata
- Effective note metadata used for selection and validation
- Whitelisted public metadata written to generated content

This separation makes precedence observable and prevents structural marker keys from
accidentally flowing into generated entry metadata.

## User verification scenarios

The implementing agent must not perform these checks. Include them as concrete
steps for the user in the phase handoff:

- Root defaults selecting notes without note-level `publish`.
- Explicit `publish: false` on a note overriding inherited `true`.
- Preview inheritance and production isolation.
- Boundary defaults overriding collection metadata defaults.
- Note arrays replacing inherited arrays.
- Invalid default types and unknown marker keys failing with paths.
- Ordinary note `collection` failing, including on an otherwise unselected note.
- Malformed YAML in an owned unselected note failing without replacing prior
  output.
- Notes outside a registered boundary remaining completely ignored.
- One effective default and one note-level opt-out updating correctly through the
  development watcher.

## Non-goals

- Generated output for more than one collection
- Route configuration or nested slugs
- Index metadata and Markdown body
- Generic Astro route dispatch
- Registering `people`

## User verification commands

Ask the user to run:

```sh
npm run build
git diff --check
```

## Acceptance criteria

- Blog folder defaults are validated and overridden exactly as
  specified.
- Boundary marker defaults apply recursively to the ordinary notes they own.
- Full note validation only applies to selected entries, while malformed owned
  YAML and structural misuse still fail early.
- Private metadata filtering and last-known-good behavior remain intact.

## Stop condition

Stop after implementing the acceptance criteria. Explain the effective-metadata
pipeline with one concrete inheritance example, list changed files, state that
verification was not performed, and give the user verification steps. Do not
start Phase 3.

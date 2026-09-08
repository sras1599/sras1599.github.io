# Phase 0: Importer foundations

## Objective

Create the small, reusable Markdown/frontmatter parsing foundation needed by
every collection phase.

This phase is primarily a behavior-preserving refactor. It must not introduce
collection selection, change which current notes publish, or edit the user's
vault.

## Prerequisites

- Read `tasks/multiple-collections/README.md` and the repository files it lists.
- Inspect current error strings before extracting interfaces.

## In scope

### Markdown/frontmatter parsing

Extract one module responsible for turning Markdown source into a parsed document
with source context. Its small interface should resemble:

```js
parseMarkdownDocument(text, { file })
// { metadata, body, hasFrontmatter }
```

The module owns BOM handling, LF/CRLF frontmatter delimiters, YAML parsing, and
path-aware parse diagnostics. Selection rules and collection schemas remain
outside it.

Preserve the current selection/error behavior while adopting the module in this
phase. Phase 2 deliberately tightens malformed-YAML behavior for owned notes; do
not pull that product change into this foundation refactor.

### Schema validation decision

Do not create a homegrown generic schema-validation framework in this phase.
Phase 2 should use collection-owned schemas (preferably a proven schema library)
and, if needed, one contextual issue formatter. If code imports a package directly,
declare it as a direct dependency rather than relying on Astro's transitive
dependencies.

### Deferred modules

Do not create URL, route-collision, collection-registry, or atomic-snapshot
abstractions before their first real consumers. The relevant later phase owns each
module.

## User verification scenarios

The implementing agent must not perform these checks. Include them as concrete
steps for the user in the phase handoff:

- Inspect representative parser inputs for each format listed above without
  changing current import selection.

## Non-goals

- Activating `_website.md` collection selection
- Folder defaults or collection schemas
- Route and URL helpers
- Multi-collection generated output
- Changing production rendering

## User verification commands

Ask the user to run:

```sh
npm run build
git diff --check
```

The user should use a temporary sample vault for the build if the configured real
vault is unavailable. Never edit the real vault to make the build pass.

## Acceptance criteria

- Markdown/frontmatter parsing has one adopted, source-aware interface.
- Existing publishing, preview, image, link, series, and error behavior remains
  unchanged.

## Stop condition

Stop after implementing the acceptance criteria. Show the parser interface and
changed files, state that verification was not performed, and provide the user
verification steps. Do not begin Phase 1.

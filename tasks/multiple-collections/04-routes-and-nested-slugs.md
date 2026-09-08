# Phase 4: Routes and nested slugs

## Objective

Make collection routes registry-driven, support validated vault overrides and
nested entry slugs, and route generated pages without blog-specific URL files.

## Prerequisites

- Phases 0 through 3 are complete.
- Read their handoffs and `tasks/multiple-collections/README.md`.

## In scope

### Route definitions and overrides

- Each registered collection has a website-defined default route such as `/blog`.
- An explicit `_website.md` marker may declare a flat `route` property.
- A refinement marker without `collection` cannot declare `route`.
- A route override applies to the entire collection, not only its source root.
- Multiple explicit roots feeding one collection may omit the override or declare
  the same normalized override. Conflicting explicit values fail with all relevant
  marker paths.
- Validate routes as normalized absolute URL paths. Reject query strings,
  fragments, repeated separators, dot segments, root `/`, and trailing separators
  other than the root form (which is itself forbidden here).
- Route-prefix sharing remains legal.

### Nested slugs

- Accept slugs such as `scientists/ada-lovelace`.
- Every segment must satisfy the existing lowercase letters/digits/single-hyphen
  rule.
- Reject leading or trailing slashes, empty segments, repeated slashes, `.` and
  `..`, query strings, fragments, encoded traversal, and platform-specific path
  separators.
- Treat a slug as a canonical URL-relative identifier, not as an unchecked
  filesystem path.
- Keep source folders independent from slugs. Moving a source note does not change
  its URL if its explicit slug is unchanged.
- Generated nested output must be written safely below its collection directory
  and stale nested directories must be cleaned.

### Generic page routing

- Replace hardcoded URL generation in `src/pages/blog/*` with a generic static
  route dispatcher capable of emitting each active collection's effective index
  and nested entry paths.
- Website code still selects a collection-specific entry component. Generic
  routing must not imply generic rendering.
- Move or adapt the current blog entry page into the registry-driven component
  structure without changing its output, series navigation, reading time, or back
  behavior.
- Preserve the current hardcoded blog index content until Phase 5, but route it
  through the generic collection-index path so Phase 5 only changes its content
  source.
- A registered collection is available capability; a vault marker activates its
  generated routes.

### URL ownership and collision validation

- Build the exact canonical URL for every selected entry and active collection
  index.
- Fail when any two generated owners claim the same exact URL.
- Also fail when a generated URL exactly matches a handwritten/static site route.
- Prefix overlap is allowed: `/people` and `/people/scientists/ada` may coexist
  when their exact owners differ.
- Include both owners and the URL in diagnostics.
- Do not create redirects when a route or slug changes.

### Links

- Make wikilinks use the target's effective collection route, including vault
  overrides and nested slugs.
- Keep preview/production privacy behavior unchanged.
- Update all blog-specific internal URL generation, including index links, series
  links, and back links, to use the route/identity helpers where appropriate.

## Suggested implementation shape

Use one canonical URL builder and one route-ownership validator shared by generated
link production and Astro path generation. Do not maintain separate string rules
that can drift.

A rest/catch-all Astro route may be the simplest way to support arbitrary static
overrides and nested slugs. Account for precedence with `src/pages/index.astro`
and other handwritten pages. Keep renderer component imports static and
registry-controlled.

When mapping a nested slug to generated filesystem output, validate first and then
join segments. Assert that the resolved destination remains under the intended
collection directory.

## User verification scenarios

The implementing agent must not perform these checks. Include them as concrete
steps for the user in the phase handoff:

- Default blog route behavior remaining `/blog`.
- One route override changing index, entry, wikilink, series, and back-link URLs.
- Equal overrides across multiple roots succeeding.
- Conflicting overrides failing with marker paths.
- A refinement route override failing.
- Valid two- and three-segment slugs.
- Every invalid nested-slug form listed above.
- Same nested slug in different collections succeeding.
- Exact entry/entry, entry/index, index/index, and generated/static collisions
  failing.
- Legal route-prefix sharing succeeding.
- A nested slug being served in both dev and production builds.
- Renaming/moving a source note preserving an explicit nested slug.
- Removing nested entries cleaning generated output and built routes.

## Non-goals

- Automatic aliases or redirects
- Deriving slugs from filenames or folders
- Vault-authored index content
- Backlink graph generation
- Production registration of another collection

## User verification commands

Ask the user to run:

```sh
npm run build
git diff --check
```

Ask the user to inspect representative generated HTML for the default blog route,
an overridden temporary route, and a nested entry route.

## Acceptance criteria

- One registry-driven route system serves active collection indexes and entries.
- Nested slugs and route overrides work end to end.
- All internal generated links use the same effective route calculation.
- Exact URL conflicts fail; prefix overlap succeeds.
- Blog rendering retains parity.

## Stop condition

Stop after implementing the acceptance criteria. Explain the URL ownership model
and route dispatcher, list changed files, state that verification was not
performed, and give the user verification steps. Do not begin Phase 5.

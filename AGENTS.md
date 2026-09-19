# Repository Guidelines

## Project context and subsystem map

This repository builds `rasmalai.dev`, a static Astro website deployed to GitHub
Pages. It owns presentation and publishing code; authored notes live in a separate
private Obsidian vault selected by `VAULT_PATH`. There is no application server or
database at request time. Browser interactivity lives in Astro component scripts.

Use the six responsibility areas below to choose where to start reading. They are
navigation boundaries, not a requirement to split modules or introduce abstractions.
Read the relevant implementation and its direct dependencies before changing it;
expand outward when the task crosses a boundary. Update this map alongside changes
to ownership, entry points, or the rules described here.

### 1. Collection contracts and metadata

- Start with [registry.mjs](src/collections/registry.mjs), the authoritative set of
  production collection IDs: `blog`, `notes`, and `people`. These are content types
  within the publishing system, not independent publishing pipelines.
- [definition.mjs](src/collections/definition.mjs) owns collection definitions,
  canonical routes, slug validation, and `collectionEntryUrl`.
- Shared schemas live in [schema.mjs](src/collections/schema.mjs); each collection's
  `definition.mjs` and `schema.mjs` under `src/collections/blog/`,
  `src/collections/notes/`, or `src/collections/people/` own its defaults, source
  metadata validation, public metadata projection (`projectEntry`), and
  generated-content schema.
- Routes are website-owned (`/blog`, `/notes`, `/people`), not configurable in vault markers.
  Source entry schemas and generated-content schemas have different roles: only
  explicitly projected frontmatter leaves the vault, but the selected body is
  published in full.
- Adding a collection also requires Astro registration and page templates; changing
  the registry alone does not create a rendered route.

### 2. Vault selection, transformation, and generated output

- Start with `importVault` in [vault.mjs](scripts/vault.mjs). Its stages are discovery,
  selection and validation, Markdown/link/image preparation, then output synchronization.
  [markdown-document.mjs](scripts/markdown-document.mjs) parses YAML frontmatter and
  body without applying publishing rules; the Astro loader also uses it.
- A **marker** is an exact `_website.md` file. A marker declaring `collection`
  establishes a **boundary** that owns descendant notes until another declaration.
  Unknown collections stop inherited ownership and their entries are skipped.
  Hidden files/directories and symlinks are excluded.
- Metadata precedence is collection defaults → owning marker defaults → note
  values. Arrays replace rather than merge. Production selects effective
  `publish: true`; writing mode additionally selects effective `preview: true`.
  These flags default to false. `publishDate` does not schedule publication.
- Entry identity is collection ID plus authored slug, independent of source path.
  Slash-separated slugs produce nested URLs. Index documents are separate from
  entries. Both current definitions require one index provider per active collection,
  supplying `title` and `metaDescription` through a marker.
- For link/image changes, start at `prepareMarkdownDocument`, `transformNode`,
  `transformWikiMatch`, and `resolveReference`. Reference lookup tries the source
  folder, vault root, then unique filename. Existing unavailable note links become
  labels; missing or ambiguous references fail. Local raster images are copied
  under content-hashed names; note transclusion and plugin execution are unsupported.
- The vault is read-only. `.generated/{collection}/`, `.generated/_indexes/`, and
  `public/_vault/` are disposable importer-owned outputs; never edit them directly.
  Preparation failures preserve previous output. Synchronization removes stale files
  but has no whole-import rollback if filesystem writes fail.

### 3. Astro content loading and Markdown rendering

- Start with [content.config.ts](src/content.config.ts) and
  [loader.ts](src/collections/loader.ts). Astro registers `blog`, `notes`, `people`,
  and the separate `collectionIndexes` collection explicitly.
- The loader reads generated Markdown recursively, derives entry IDs from relative
  filenames without `.md`, validates public metadata, renders Markdown, and removes
  stale content-store entries. Its watcher serializes generated-file refreshes.
- [astro.config.mjs](astro.config.mjs) owns static output, canonical origin,
  trailing-slash policy, and the Satteri Markdown processor configuration, including
  removal of footnote backlinks. Vault syntax rewriting belongs to the importer;
  final Markdown-to-HTML rendering belongs to Astro.

### 4. Pages, navigation, and visual presentation

- [index.astro](src/pages/index.astro) owns homepage content and sections.
  [HomepageGameShowcase.astro](src/components/HomepageGameShowcase.astro) owns
  the homepage showcase's repository-data integration, Kolkata calendar range,
  pre-rendered Month choices, browser navigation lifecycle, and public URL state.
  [BaseLayout.astro](src/layouts/BaseLayout.astro) owns the document shell, SEO
  metadata, navigation, Google Fonts, and Umami analytics. Shared design tokens,
  responsive layouts, and article styles live in [global.css](src/styles/global.css).
- [GameShowcaseFrame.astro](src/components/GameShowcaseFrame.astro) owns the game
  showcase's shared typography, controls, responsive card grid, and card chrome.
  [GameShowcaseMonth.astro](src/components/GameShowcaseMonth.astro) is the
  presentation-only composition interface for normalized game results;
  [GameShowcaseMonthCard.astro](src/components/GameShowcaseMonthCard.astro) owns
  the repeated calendar structure and explicit game illustrations. They perform
  no data loading and own no navigation or URL state.
- [blog/index.astro](src/pages/blog/index.astro) requires the generated blog index,
  sorts entries newest first with ID tie-breaking, and filters `displayInFeed`.
  Hiding an entry from the feed does not unpublish its individual page.
- `src/pages/blog/[...slug].astro`, `src/pages/notes/[...slug].astro`, and
  `src/pages/people/[...slug].astro` generate individual pages and preserve nested
  slugs. [notes/index.astro](src/pages/notes/index.astro) renders the dated notes
  feed from its authored collection index. Blog reading time and series links come
  from [readingTime.ts](src/utils/readingTime.ts) and [series.ts](src/data/series.ts);
  unknown series fail during page rendering.
- People currently have individual pages but no `/people` index template, even
  though their collection definition requires an imported index document. Keep
  this implementation distinction visible when working on indexes or marker links.

### 5. Browser note previews

- Start with [NotePreview.astro](src/components/NotePreview.astro), included by the
  blog, notes, and people entry templates. It owns link highlighting, hover/focus behavior,
  fetching and caching target page HTML, panel positioning, and keyboard dismissal.
- Eligible routes come from the collection registry. External links, collection
  roots, same-page links, touch taps, and links bearing `data-no-preview` use normal
  navigation. Preview content does not recursively open further previews.
- Fetched pages must expose `.article > .article-header` and
  `.article > .article-body`. This markup is a contract with page presentation;
  coordinate selector changes across both. Failed fetches provide a normal link.

### 6. Development lifecycle and deployment

- [package.json](package.json) delegates `dev`, `dev:writing`, and `build` to
  [site.mjs](scripts/site.mjs). It owns environment loading, initial vault import,
  the vault watcher, serialized reimports, development lock, and Astro shutdown.
  The loader's separate watcher observes generated Markdown, not the source vault.
- `build` imports published content, runs Astro check, then builds `dist/` only if
  checking succeeds. `preview` serves existing output without importing or rebuilding.
  These describe the user's workflows; the verification prohibition below still applies.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) checks out website
  code and private vault `main`, builds with `VAULT_PATH`, and deploys the static
  artifact to Pages. Website pushes to `main` and manual dispatch trigger it.
- [rebuild-website.yml](docs/workflows/rebuild-website.yml) is a copy of the trigger
  workflow intended for the separate vault repository, not an active workflow here.
  Deployment setup and credential roles are documented in
  [Deployment.md](docs/understanding/codex-authored/Deployment.md).
- [integration.mjs](src/dev-admin/integration.mjs) injects `/admin`, the single-result
  game ingestion page, and its same-origin preview/save endpoint only for Astro's
  development command. These sources stay outside `src/pages` so production builds
  emit no admin route. Browser parsing and schema feedback reuse `src/data/games/`;
  filesystem preview and writes remain behind the Node-only persistence boundary.

### Supporting documentation

[DEVELOPMENT.md](docs/understanding/codex-authored/DEVELOPMENT.md) explains authoring
and local workflows; [Design.md](docs/Design.md) records visual design context.

## Core principle

Implement the simplest complete solution to the user's stated requirement.
Optimize for clarity and ease of change, not for hypothetical future needs.

## Scope

- Treat the user's current request as the source of truth.
- Make the smallest coherent change that satisfies it.
- Do not add adjacent features, generalized frameworks, or speculative extension points.
- Do not refactor unrelated code while completing a focused task.
- If a broader design would materially increase scope or complexity, ask before pursuing it.

## Design

- Prefer direct code and existing platform features over new abstractions.
- Prefer established, library-owned solutions for standard problems such as schema
  validation, parsing, and serialization, especially when the library is already
  available in the project. Write a custom solution only when the library's cost
  or constraints clearly outweigh its reliability and maintenance benefits.
- Add a focused dependency when it provides a clearer, more reliable, or more
  maintainable solution than implementing the same capability locally; consider
  its security, runtime, and bundle-size costs before adding it.
- Avoid interfaces, adapters, factories, registries, and configuration layers with only one real use case.
- Keep logic close to its consumer until there is demonstrated reuse or the extraction clearly improves readability.
- Prefer a small function or a few explicit statements over a generic subsystem.
- Do not implement requirements that exist only in anticipated future work.

## Working with existing code

- Follow the repository's established conventions unless the user asks to change them.
- Preserve existing behavior outside the requested change.
- Respect user-authored and in-progress changes; do not overwrite or clean them up without permission.
- When documentation or an old task plan conflicts with the user's current direction, surface the conflict instead of silently expanding the work.

## Testing and verification

- Never run tests, even when a test suite exists.
- Do not introduce a test suite unless the user explicitly asks for one.
- Never verify changes yourself. Do not run builds, linters, type checks, previews,
  development servers, manual checks, or other verification commands.
- Do not tell the user merely to "test the changes." After making code changes,
  end the response with concise, concrete steps the user can follow to verify the
  affected behavior.
- Clearly state when no verification was performed, in accordance with these
  instructions.

## Code readability

Optimize for a reader understanding the behavior in one continuous read,
with minimal jumping between definitions.

### Flow and expressions

- Write operations in the order you would explain the task: establish inputs,
  handle exceptional cases, perform the main work, produce the result.
- Prefer early returns when they reduce nesting and clarify the normal path.
- Give distinct decisions their own statements. Avoid nested ternaries and
  expressions that combine several business rules.
- Use intermediate variables when they name a meaningful concept or explain
  an expression; avoid aliases that add no meaning.
- Separate distinct logical steps with blank lines.
- Follow the repository's established formatting style.

### Functions and boundaries

- Keep related logic together. Extract a helper when it names a meaningful
  operation, hides substantial detail, or removes meaningful duplication.
- Do not split cohesive functions merely to make them shorter. Avoid helpers
  that force navigation without making the caller easier to understand.
- Make each file responsible for a coherent part of the behavior. Do not use
  arbitrary function-length or file-length limits.
- Use names that describe domain meaning and actual behavior. Make filesystem
  access, persistence, and significant mutation apparent through names and
  explicit inputs or outputs.

### Data flow

- Prefer explicit inputs and returned results over mutations that silently
  prepare shared objects for later functions.
- Local mutation is fine. When shared mutation is necessary, make ownership
  and the mutation contract clear.
- Avoid generic context objects that mix lookup data, mutable working state,
  and accumulated outputs. Group values by a clear shared purpose.
- Keep return shapes predictable. For example, a transformation that can
  produce multiple nodes should consistently return an array of nodes.
- Store only data used by the current implementation. Do not add unused
  fields, discriminator tags, or intermediate representations for future work.

### Errors and explanations

- Catch only failures the code can handle meaningfully. Do not turn unexpected
  errors into success-shaped defaults.
- Include the affected input and useful context in error messages.

### Comments and documentation

- Default to descriptive comments when generating or changing code. Favor enough
  explanation for the user's first read; the user can shorten comments later.
  Concise communication does not mean sparse code comments.
- Every code module must begin with a descriptive module-level comment. Explain
  why the module exists, its main inputs and outputs, the main stages of its
  workflow, and important boundaries or side effects. Define domain terms that
  a reader needs to understand the file. Update this comment when changing the
  module's responsibilities or behavior.
- Introduce nontrivial functions with comments explaining their role, meaningful
  inputs and return values, and relevant mutations, assumptions, or failure
  behavior. A reader should not have to trace callers to discover the contract.
- Within complex functions, explain the purpose of each meaningful phase and
  the rules behind non-obvious branches. Describe ordering dependencies,
  precedence, fallback behavior, and exceptional cases where they matter.
- Use small examples when they clarify a transformation, path convention,
  data shape, or domain rule more effectively than an abstract description.
- Comments may explain what an algorithm does as well as why it exists. Avoid
  mechanical narration of obvious syntax, but do not omit useful explanation
  just because a reader could eventually infer it from the implementation.
- Keep comments accurate and specific to the implemented behavior, including
  its limitations. Do not use comments to compensate for misleading names or
  unnecessarily complicated code, or remove useful detail solely for brevity.

## Communication

- Be concise and concrete.
- Explain tradeoffs before introducing meaningful complexity.
- Ask for clarification only when different interpretations would materially change the result.
- If a simpler solution meets the requirement, prefer it and mention any limitation briefly.

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
- [sidebar.mjs](src/collections/sidebar.mjs) owns shared `directory` marker
  validation, directory-card content, and generated `navigation` schemas for all
  collections. `directory: true` requires `title` and `slug`; its Markdown body
  supplies card content while `_index.md` remains the separate landing page. The importer derives titles
  and slugs in sidebar folders and projects navigation independently of collection
  metadata. Notes in sidebar folders may omit dates; Blog requirements stay intact.
  Optional directory-marker tags are validated as lists of strings and projected
  into `directoryCards`; omitted tags become an empty list.
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
  Hidden files/directories and symlinks are excluded. A marker may declare
  `directory: true`, `title`, and `slug` with an inherited registered collection.
  Directory markers establish the internal `{ title, slug }` sidebar root and own
  card Markdown, never collection index metadata/body; `metaDescription` is invalid
  on them. Legacy `sidebar`, `sidebarTitle`, and `sidebarSlug` are rejected with
  migration guidance. False/absent `directory` preserves ordinary marker behavior
  and does not disable inherited navigation. Within sidebar
  folders, markers without `collection` may override folder defaults. Changing
  collections ends inherited navigation. Nested sidebar roots own their explorer;
  their selected root overview is also linked in the parent tree.
- Metadata precedence is collection defaults → owning marker defaults → note
  values. Arrays replace rather than merge. Production selects effective
  `publish: true`; writing mode additionally selects effective `preview: true`.
  These flags default to false. `publishDate` does not schedule publication.
  Directory-marker tags label only the card and are excluded from folder defaults
  in every collection. Ordinary Blog markers retain their existing tag defaults.
- Entry identity is collection ID plus slug. Outside sidebar folders, slugs are
  authored independently of source paths; inside, absent titles/slugs derive from
  filenames and topic-relative paths. Explicit note slugs inside sidebar folders
  are relative to the containing folder URL; a leading `/` overrides from the
  collection root. Directory-marker slugs remain collection-relative. Exact `_index.md` files inside sidebar folders
  are ordinary entries at folder URLs and make folder headings clickable. Collection
  index documents remain separate from entries. All definitions require one index provider per active collection,
  supplying `title` and `metaDescription` through a marker.
- For link/image changes, start at `prepareMarkdownDocument`, `transformNode`,
  `transformWikiMatch`, and `resolveReference`. Reference lookup tries the source
  folder, vault root, then unique filename. Existing unavailable note links become
  labels; missing or ambiguous references fail. Local raster images and `.m4a`
  wiki embeds are copied under content-hashed names; audio uses native controls.
  [block-anchors.mjs](scripts/block-anchors.mjs) indexes declarations and inserts
  native HTML anchors into selected entries and rendered Blog/Notes indexes before
  links are rewritten. Paragraph, heading, and list-item suffixes and standalone
  declarations following Markdown blocks are supported. Heading suffixes are
  removed before rendering, preserving normal heading IDs alongside block anchors.
  IDs are case-sensitive; duplicates,
  orphan declarations, and missing IDs on public block targets fail preparation.
  Literal `#^id` and encoded `#%5Eid` links share resolution without heading
  slugification. Directory-card bodies and the unrendered People index retain
  declaration stripping and label-only block references; links to their blocks
  also become labels. Escaped carets, code examples, and external URLs stay literal
  in addressable documents. Private bodies are never indexed for block validation.
  Note transclusion and plugin execution are unsupported.
- The vault is read-only. `.generated/{collection}/`, `.generated/_indexes/`,
  `.generated/_directories/`, and `public/_vault/` are disposable importer-owned
  outputs; never edit them directly. Directory card bodies are keyed by collection
  and slug and exported only for selected root overviews, which receive the
  importer-owned `directoryCard` reference. Marker-relative references reuse the
  normal Markdown/media pipeline; the entire selected marker body is public.
  Preparation failures preserve previous output. Synchronization removes stale files
  but has no whole-import rollback if filesystem writes fail.

- `listVaultRoutes` in [vault.mjs](scripts/vault.mjs) shares discovery, metadata
  selection, slug resolution, and collision validation with `importVault`, without
  transforming Markdown or writing output. [routes.mjs](scripts/routes.mjs) exposes
  `npm run routes` and `--preview`, grouping routes by collection and listing
  standalone pages last. Preview-only entries carry a `(preview)` suffix;
  published entries remain unlabeled. Concrete page files and public HTML supplement vault
  entries; index schemas alone do not imply rendered index routes. Other dynamic
  routes cannot be inferred.

### 3. Astro content loading and Markdown rendering

- Start with [content.config.ts](src/content.config.ts) and
  [loader.ts](src/collections/loader.ts). Astro registers `blog`, `notes`, `people`,
  and the separate `collectionIndexes` and `directoryCards` collections explicitly.
  Both use the shared generated-Markdown loader and renderer; card documents
  create no routes and do not enter normal entry queries.
- The loader reads generated Markdown recursively, derives entry IDs from relative
  filenames without `.md`, validates public metadata, renders Markdown, and removes
  stale content-store entries. Each load session renders every entry initially,
  then reuses unchanged source digests. Its watcher debounces bursts for 100 ms
  and serializes refreshes; preparation failures preserve the previous store.
- [astro.config.mjs](astro.config.mjs) owns static output, canonical origin,
  trailing-slash policy, and the Satteri Markdown processor configuration, including
  removal of footnote backlinks and standalone image captions from nonblank alt
  text. Raw HTML is parsed so dimensioned/centered importer images share the
  caption transform. Image-only paragraphs, including multiple images separated
  by line breaks, become captioned blocks; inline images and authored figures
  are left unchanged. Inline block anchors in list items are preserved without
  preventing image captions.
  [markdown-highlights.mjs](scripts/markdown-highlights.mjs) renders paired `==`
  delimiters as native `mark` elements within inline content, preserving emphasis
  and links. Unmatched/empty pairs, escaped markers, and code remain literal;
  highlights cannot cross blocks. The importer uses the same source-aware text
  handling to preserve delimiter intent through Markdown serialization.
  Caption presentation lives in `global.css` for entry bodies and authored indexes.
  Vault syntax rewriting belongs to the importer; final Markdown-to-HTML rendering
  belongs to Astro.

### 4. Pages, navigation, and visual presentation

- [index.astro](src/pages/index.astro) owns homepage content and sections.
  [HomepageGameShowcase.astro](src/components/HomepageGameShowcase.astro) owns
  the homepage showcase's repository-data integration, Kolkata calendar range,
  pre-rendered Month choices, mobile game selection, reduced-motion handling,
  browser navigation lifecycle, and public URL state. Embla owns mobile dragging,
  looping, and sliding; the controller synchronizes icons and accessible slide
  state, and recreates the carousel after month or responsive layout changes.
  [absences.json](src/data/games/absences.json) owns shared reason artwork/default
  messages and inclusive dated ranges independently of actual game results.
  [absences.ts](src/data/games/absences.ts) validates dates, reasons, messages,
  paths, and nonoverlap (including future endpoints), then prepares compact ranges
  visible through the showcase's Kolkata date. Begun absences can extend the first
  selectable month; future-only ranges cannot. Actual results take precedence.
  [BaseLayout.astro](src/layouts/BaseLayout.astro) owns the document shell, SEO
  metadata, navigation, and Google Fonts. Analytics are provided through Cloudflare;
  the site does not include an Umami tracker. Shared design tokens,
  responsive layouts, and article styles live in [global.css](src/styles/global.css).
- [FolderNavigationLayout.astro](src/layouts/FolderNavigationLayout.astro) wraps
  all Blog, Notes, and People articles at the site's full content width. At
  viewport widths of 1680px and above, matching flexible rails fill the space
  outside that width with 24px article gaps and 16px viewport margins;
  missing rails leave the article centered. Both rails
  are sticky and independently scrollable. Below that breakpoint, navigation
  becomes separate, initially collapsed disclosures above the article.
  Directory metadata alone enables the left folder explorer.
  [TableOfContents.astro](src/components/TableOfContents.astro) owns the right
  “On this page” navigation, using Astro's rendered H1–H6 heading metadata and
  existing anchor IDs, excluding the generated footnote heading. Its links are
  rendered statically; a browser controller marks the current section accessibly at
  a 96px reading offset, selecting the final heading at the document bottom.
  TOC links share the folder explorer's purple underline on hover and keyboard focus,
  preserving their normal text color and weight.
  Entries without headings have no TOC. Heading links respect reduced motion.
  [folderNavigation.ts](src/components/folderNavigation.ts) builds the tree from
  selected public entries; [FolderNavigationNode.astro](src/components/FolderNavigationNode.astro)
  renders recursive disclosures with caret colors cycling blue, orange, green,
  and purple by nesting depth, overview links, and current-page state.
  `FolderNavigationLayout.astro` animates folder expansion and collapse while
  respecting reduced motion; `global.css` owns vertical child guides and row hover styling. Tree
  membership follows folder metadata independently of authored entry URL overrides.
  The directory root is the explorer's sole heading and mobile disclosure; there
  is no additional Browse heading.
  Unrelated pages keep their existing layout; no site-wide explorer is created.
- [ImageZoom.astro](src/components/ImageZoom.astro), included by `BaseLayout`,
  enhances images in entry bodies and authored blog/notes indexes in the browser.
  Clicking or keyboard-activating an image, including a linked image, opens a
  viewport-constrained native modal lightbox with its existing caption. It owns
  dismissal, scroll locking, and focus restoration. Note-preview images are
  excluded; generated Markdown and fetched preview HTML remain unchanged.
- [GameShowcaseFrame.astro](src/components/GameShowcaseFrame.astro) owns the game
  showcase's shared typography, controls, mobile icon selector and carousel
  viewport/track, responsive card grid, and card chrome.
  [gamePresentation.ts](src/components/gamePresentation.ts)
  shares game labels, icons, and card presentation metadata with the selector.
  [GameShowcaseMonth.astro](src/components/GameShowcaseMonth.astro) is the
  presentation-only composition interface for normalized game results and shared
  absence ranges;
  [GameShowcaseMonthCard.astro](src/components/GameShowcaseMonthCard.astro) owns
  the repeated calendar structure, explicit game illustrations, and focusable
  day cells using the shared abbreviation tooltip styling in `global.css`.
  Absence cells reference cacheable public artwork. They perform
  no data loading and own no navigation or URL state.
- [blog/index.astro](src/pages/blog/index.astro) requires the generated blog index,
  sorts entries newest first with ID tie-breaking, and filters `displayInFeed`.
  Hiding an entry from the feed does not unpublish its individual page.
  [FeedCard.astro](src/components/FeedCard.astro) owns blog/notes card markup,
  optional dates, the blue `./` directory prefix, and rendered directory marker
  bodies resolved through the `directoryCards` collection. Marker Markdown replaces
  directory descriptions; ordinary cards keep their frontmatter descriptions;
  directory badges use marker tags exclusively, while overview pages and ordinary
  cards retain their own tags. There is no fallback to overview tags;
  [publication.ts](src/utils/publication.ts) owns their newest-first ordering with
  English ID tie-breaking and date labels, also used by dated entry headers.
- `src/pages/blog/[...slug].astro`, `src/pages/notes/[...slug].astro`, and
  `src/pages/people/[...slug].astro` generate individual pages and preserve nested
  slugs. [notes/index.astro](src/pages/notes/index.astro) renders the dated notes
  feed from its authored collection index. Published sidebar root overviews appear
  as directory cards, alphabetically before ordinary dated notes in the same list;
  other sidebar descendants are excluded. `directory: true` enables directory
  navigation; selected root overviews carry the `directoryCard` reference. Blog
  cards render the same content while retaining `displayInFeed`. Blog reading time and series links come
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
- Preview HTML is cached once per note URL, independently of fragments. Before
  IDs are removed, their values are retained in preview-only data attributes.
  Each opening scrolls only the panel to the linked heading or block, keeping the
  whole note available. Missing, malformed, or absent fragments open at the top.

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
  [validation.ts](src/data/games/validation.ts) owns normalized candidate and
  persisted-array validation for static loading and admin ingestion.
  [persistence.ts](src/data/games/persistence.ts) is the Node-only owner of fixed
  game paths, persisted reads, and atomic replacement for admin ingestion.
  The admin browser invalidates previews immediately on edits and disables draft
  controls during saves; saving requires a successful preview of the current draft.

### Supporting documentation

[DEVELOPMENT.md](docs/understanding/codex-authored/DEVELOPMENT.md) explains authoring
and local workflows; [Design.md](docs/Design.md) records visual design context.

## Core principle

Implement the simplest complete solution to the user's stated requirement.
Minimize implementation surface and independent change points. Prefer reuse when
it makes the codebase easier to understand and change as a whole. Treat line count
as supporting evidence, not a target: do not compress code at the expense of
clarity, correctness, or useful structure.
Optimize for clarity and ease of change, not for hypothetical future needs.

## Scope

- Treat the user's current request as the source of truth.
- Make the smallest coherent change that satisfies it.
- Before adding code, inspect the relevant implementation for existing components,
  utilities, styles, dependencies, and platform features that can satisfy the
  requirement.
- Judge scope by the resulting implementation, not only by the size of the diff.
  Consolidate duplication when it is directly exercised by the requested change;
  propose broader cleanup separately.
- Do not add adjacent features, generalized frameworks, or speculative extension points.
- Do not refactor unrelated code while completing a focused task.
- If a broader design would materially increase scope or complexity, ask before pursuing it.

## Design

- Prefer, in order, an existing project implementation, a platform feature, an
  established library, and finally custom code.
- Before writing a substantial custom implementation, check whether an existing
  dependency or a focused, well-maintained library already solves the problem.
  Prefer the library when it removes meaningful custom code and its security,
  runtime, bundle-size, and maintenance costs are reasonable. Do not add a
  dependency for behavior that is clearer and comparably small using the language
  or platform directly.
- Add a focused dependency when it provides a clearer, more reliable, or more
  maintainable solution than implementing the same capability locally; consider
  its security, runtime, and bundle-size costs before adding it.
- Avoid interfaces, adapters, factories, registries, and configuration layers with only one real use case.
- Treat two implementations of the same user-facing concept or workflow as a
  prompt to evaluate reuse. Share them when they represent the same concept, are
  expected to change together, and their differences can be expressed without
  obscuring behavior. Do not use proximity to each consumer as a reason to retain
  meaningful duplication.
- Prefer a small function or a few explicit statements over a generic subsystem.
- Prefer deleting, consolidating, or reusing code over adding a parallel
  implementation. Avoid abstractions that introduce as much code or indirection as
  they remove, including universal components controlled by many mode flags.
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
with minimal jumping between definitions. This does not justify duplicating a
shared concept across consumers. Prefer a well-named shared component or function
when it creates one authoritative place to understand and change behavior.

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

- Keep related logic together. Extract a shared component or helper when it removes
  meaningful duplication, establishes one authoritative implementation of a
  concept, names a meaningful operation, or hides substantial detail.
- When several files repeat the same structure with small data differences,
  consider one shared implementation with explicit inputs. Keep separate
  implementations when they have different reasons to change or sharing would
  require numerous mode flags or obscure important differences.
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

- Prefer clear names and straightforward structure over explanatory comments.
- Add comments when they preserve information that is not apparent from the code,
  such as a domain rule, architectural boundary, ordering dependency,
  compatibility constraint, non-obvious fallback, or intentional limitation.
- Require a module-level comment only when a module's purpose, workflow, side
  effects, or boundaries are not evident from its name and public structure.
  Always document important filesystem mutations, publishing rules, generated
  output ownership, public contracts, and unusual lifecycle behavior. Small route
  templates, components, configuration files, and simple utilities do not need
  boilerplate module comments.
- Introduce a function with a comment only when its contract, mutation,
  assumptions, or failure behavior cannot be communicated clearly by its name and
  signature.
- Within complex functions, explain rules behind non-obvious phases and branches,
  including ordering, precedence, fallback behavior, and exceptional cases.
- Use a small example when it explains a transformation, path convention, or data
  shape more clearly than an abstract description.
- Do not narrate syntax, restate types, or document facts immediately visible in
  the implementation. Keep necessary comments accurate and concise. If ordinary
  behavior requires extensive comments, first look for a simpler implementation.

## Communication

- Be concise and concrete.
- Explain tradeoffs before introducing meaningful complexity.
- Ask for clarification only when different interpretations would materially change the result.
- If a simpler solution meets the requirement, prefer it and mention any limitation briefly.

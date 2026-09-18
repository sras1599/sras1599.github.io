# Phase 1 — Data contracts and repository storage

## Objective

Create the authoritative normalized data contracts and repository-owned storage
for Connections, Mini, Bracket City, and Tagline. This phase does not build
parsers, commands, admin pages, or public visualizations.

## Repository context

The site is a static Astro project deployed to GitHub Pages. Game data is public
website content and belongs in this repository, not in the private Obsidian vault
or importer-owned `.generated` directories. Zod is already a direct dependency.
Read the root `AGENTS.md` before changing files, including its prohibition on
agent-run verification and its module-comment requirements.

## Required storage

Create one JSON file per game under a clearly website-owned data directory such
as `src/data/games/`:

- `connections.json`
- `mini.json`
- `bracket-city.json`
- `tagline.json`

Each file is a top-level array sorted in ascending ISO date order. A game/date
pair is unique. Commit a small amount of clearly labelled synthetic seed data
only if the public component would otherwise be impossible to develop; do not
invent personal history and do not copy the prototype's large sample dataset.

## Authoritative schemas

Create a focused TypeScript module containing Zod schemas, inferred types, and
the shared game identifier type. Use the simplest explicit representation that
satisfies these contracts.

### Connections

- `date`: local calendar date in `YYYY-MM-DD` form
- `mistakes`: integer from `0` through `4`. 4 mistakes indicates failure
- `solveOrder`: completed category colors in their actual order; allowed values
  are `yellow`, `green`, `blue`, and `purple`

A solved result has all four colors exactly once. A failed result may have a
partial solve order. The public trend calculation treats a failure as four
mistakes regardless of any other representation.

### Mini

- `date`: local calendar date in `YYYY-MM-DD` form
- `durationSeconds`: positive integer

### Bracket City

- `date`: local calendar date in `YYYY-MM-DD` form
- `difficulty`: normalized non-empty difficulty label from the share result (might not be available)
- `score`: finite number from `0` through `100`
- `rank`: normalized non-empty rank label
- `wrongGuesses`: non-negative integer
- `peeks`: non-negative integer
- `answersRevealed`: non-negative integer

### Tagline

- `date`: local calendar date in `YYYY-MM-DD` form
- `letters`: uppercase ASCII letters
- `hintsUsed`: non-negative integer
- `stars`: integer from `1` through `3`

## Shared read contract

Provide one small website-facing loader that imports the four JSON files,
validates them, rejects duplicate dates, rejects non-ascending input, and returns
a predictable object keyed by game identifier. Validation failures must identify
the game, date or array position, and invalid field. Do not silently drop or
repair invalid persisted records.

Keep filesystem mutation out of this website-facing module. Later ingestion
phases may share schemas and normalized types but must own persistence in a
Node-only module so browser code cannot acquire filesystem capabilities.

## Boundaries

- Store only fields used by the agreed feature.
- Do not store raw share text, parser intermediates, display colors, computed
  averages, formatted durations, month cells, or trend coordinates.
- Do not introduce a registry or adapter framework for four fixed games.
- Do not touch the vault importer, generated Markdown, or deployment workflow.
- Do not add automated tests unless the user separately requests them.

## Acceptance criteria

- Four chronological JSON files exist in website-owned source data.
- One Zod contract is authoritative for storage, ingestion, and rendering.
- Invalid dates, values, duplicates, or ordering fail with useful context.
- Public loaders perform no writes and expose normalized typed results.
- No raw pasted result text is persisted.

## User verification

The implementing agent must not run verification commands. It should tell the
user which data files to inspect and ask the user to run the repository's normal
`npm run build` workflow after reviewing the schemas and sample records.

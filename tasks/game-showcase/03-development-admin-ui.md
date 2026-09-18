# Phase 3 — Development-only admin UI

## Objective

Build the sole per-result ingestion experience at `/admin/ingest-game-data` plus
a plain `/admin` index. Both routes and every write endpoint must exist only
during Astro development and must be absent from production output.

## Prerequisite contract

Phase 2 should expose browser-safe parsing/validation operations and Node-only
preview/save operations backed by the Phase 1 Zod schemas. Reuse them. Do not
create separate parsing rules, schemas, duplicate handling, or JSON writing in
the page component. There is no CLI fallback for ingesting an individual result.

This is a static Astro site. An ordinary file in `src/pages/admin/` would still
be emitted during a production build even if its content were visually hidden.
Use an Astro-supported development-only route, integration, or middleware
boundary registered only for the development command. Production requests to
`/admin` and descendants must receive the site's normal 404.

## `/admin`

Create a deliberately plain development-tools index containing:

- A clear “Development tools” heading.
- A link to `/admin/ingest-game-data`.
- No speculative dashboard, authentication, navigation redesign, or empty cards
  for imagined future tools.

The route is entered manually and does not need a homepage or main-navigation
link.

## `/admin/ingest-game-data`

Use a side-by-side segmented control with two modes.

### Paste result

- Selected by default.
- Provides a multiline textarea and Parse action.
- Auto-detects the game using the shared parser.
- Shows the parsed game, date, and game-specific fields in an editable preview
  before Save is enabled.
- On failure, preserve the pasted text, explain the error, and offer a direct
  switch to manual entry.

### Enter manually

- Starts with a game dropdown.
- Renders only the fields required by that game's authoritative schema.
- Uses appropriate native controls for dates and numeric bounds.
- Shows field-level schema errors rather than a generic failure.

Both modes converge on the same normalized preview and save operation.

## Save behavior

- Saving requires an explicit action and revalidation in the local server
  boundary; never trust browser-submitted paths or normalized values.
- A duplicate shows existing and proposed records side by side. Normal Save
  remains unavailable until the user deliberately chooses `Replace existing
  result`.
- After success, show the normalized record and repository-relative JSON file,
  then reset for another result.
- State clearly that the result is local and unpublished until the data file is
  reviewed, committed, and pushed.
- Never commit, push, deploy, or write outside the fixed game-data directory.

## Development security boundary

The write handler is installed only in development, accepts only known game IDs
and schema fields, derives its target path internally, and rejects arbitrary
filesystem paths. Keep mutation behind same-origin development requests. Do not
implement production authentication for a route that must not exist in production.

## Boundaries

- Do not build a production admin page or API.
- Do not add a CLI or automation path for per-result ingestion.
- Do not add bulk upload, CSV, history tables, editing dashboards, or deletion.
- Do not store pasted raw text after parsing.
- Do not link admin tools from public navigation.
- Do not add automated tests unless separately requested.

## Acceptance criteria

- `/admin` lists the ingestion tool during local development.
- Paste and manual modes create the same normalized preview.
- Parsed fields remain editable before save.
- Duplicate replacement is explicit and displays both records.
- Successful saves update only the correct chronological JSON file.
- Production builds emit neither admin HTML nor mutation endpoints.
- The UI explains local save versus publication.

## User verification

The implementing agent must not start the dev server or build. It should ask the
user to run `npm run dev`, visit both routes, exercise parse/manual/duplicate
flows, then run the normal production build and confirm `/admin` paths are absent
from `dist`.

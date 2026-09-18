# Phase 6 — Integration, accessibility, and prototype cleanup

## Objective

Integrate the completed data, ingestion, Month, and Trends phases into one
coherent feature; resolve cross-phase edges; document workflows; and remove the
disposable design prototypes from the production branch.

This phase is not permission to redesign accepted visualizations or add adjacent
features. It is a focused completion and cleanup pass.

## Expected inputs

- Phase 1: authoritative schemas, JSON files, and validated read contract.
- Phase 2: shared parser/persistence engine and `npm run games:add`.
- Phase 3: development-only `/admin` routes using that engine.
- Phase 4: responsive Month view on the homepage.
- Phase 5: lazy-loaded Trends view and range summaries.

If an input is absent, report the unmet phase rather than silently implementing
its full scope inside cleanup.

## Integration requirements

- The homepage contains exactly one showcase after the hero and before Work.
- A fresh visit opens current Month. Explicit URL state opens the requested month
  or trend range.
- Switching views preserves each view's selection during the visit.
- All cards consume the same validated static data contract in both views.
- Shared controls, headings, legends, focus behavior, and responsive breakpoints
  feel like one feature.
- Empty datasets and partial game histories do not prevent other cards or views
  from rendering.

## Ingestion-to-public workflow

Document the actual local workflow in existing development documentation or a
focused nearby document:

1. Run the normal development command.
2. Open `/admin/ingest-game-data` or use `npm run games:add`.
3. Parse or enter one result, review it, and save.
4. Inspect the changed JSON file.
5. Commit and push through the user's normal Git workflow.
6. Let the existing GitHub Pages deployment rebuild the static site.

Make clear that admin routes do not exist in production, saving is local, and raw
share text is discarded.

## Cleanup

- Remove `GameShowcasePrototype.astro`,
  `GameShowcaseTrendPrototype.astro`, their development-only homepage mount, and
  prototype-only styles/scripts after production components implement the chosen
  designs.
- Remove abandoned variation CSS, synthetic prototype histories, variant URL
  switches, and design-review copy.
- Remove unused imports and dependencies from iteration, preserving Observable
  Plot when the production Trends view uses it.
- Preserve unrelated user-authored work in the dirty worktree.

## Final accessibility review

- Controls have visible focus, descriptive names, correct pressed/disabled
  states, and usable touch targets.
- Month hover information is keyboard-accessible; Tagline has no unnecessary
  tooltip.
- Exact Mini and Bracket values remain legible over their illustrations.
- Charts expose useful accessible names and summaries without serializing every
  plotted coordinate.
- Meaning is not conveyed by color alone.

## Final scope guard

Confirm the feature has not introduced:

- A backend, database, production admin route, or authentication system.
- Vault-owned game data or vault importer changes.
- Streaks, records, social comparison, a combined score, CSV import, zooming, or
  a separate public games page.
- Automatic commits, pushes, or deployments.
- Retained native share text.
- Automated tests unless separately requested.

## Acceptance criteria

- Production contains finished components and real repository data, not
  prototypes or synthetic histories.
- Month and Trends behave consistently across URLs, viewport sizes, empty data,
  and partial histories.
- Local ingestion and static publication are accurately documented.
- Development admin routes are absent from production output.
- No accepted requirement remains represented only in prototype code.

## User verification

The implementing agent must not run verification commands. It should provide a
concrete walkthrough covering local ingestion, duplicate replacement, homepage
Month/Trends behavior, URLs, sparse ranges, responsive and keyboard use, a
production build, and confirmation that admin routes and prototype assets are
absent from `dist`.

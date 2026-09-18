# Phase 4 — Showcase presentation modules

## Objective

Extract the accepted game-showcase visual language from the development
prototypes into production-owned presentation modules before integrating live
data or homepage state. The prototype is the authoritative visual reference;
this prose records behavior and ownership but does not replace visual comparison.

This phase does not mount the showcase on the public homepage, load repository
data, implement month navigation, manage URL state, or build production trend
charts.

## Prerequisite contract

Phase 1 supplies the normalized game identifiers and result types. The existing
`GameShowcasePrototype.astro` and `GameShowcaseTrendPrototype.astro` files supply
the accepted visual reference using synthetic data. Preserve the selected Month
design, including the Bracket City “poster blocks” treatment; rejected prototype
variations are not production requirements.

## Module seams

Create a small production-owned showcase frame shared by Month and Trends. It
owns the section's typography, controls, two-by-two desktop card grid, stacked
mobile layout, card chrome, and shared responsive behavior. Keep its interface
limited to the content and state needed to render those elements.

Create one cohesive Month presentation module. It accepts the selected calendar
month, the current local date, and normalized results for the four games. It owns
calendar alignment, day-state classification, card rendering, value formatting,
and the game-specific day illustrations described below.

Keep game-specific rendering inside that module unless an extraction hides
substantial visual logic. Do not create shallow wrappers for card shells, weekday
rows, or individual cells merely because their markup repeats.

The modules perform no data loading or filesystem access. They do not own URL
state or decide which month is selected. Those responsibilities belong to Phase
5, which consumes this interface.

## Authoritative Month presentation

- Render seven weekday columns and one fixed square for every date. Alignment
  cells are inert.
- Past dates without records use the prototype's quiet missing treatment.
- Future dates in the current month use the prototype's visually distinct future
  treatment and are not presented as missing results.
- Preserve the prototype's spacing, proportions, typography, borders, shadows,
  layering, responsive breakpoints, and selected color treatments unless a
  production data or accessibility requirement explicitly requires a change.

### Connections

- A played day contains horizontal category-color bands in actual solve order.
- Failed results may contain only completed bands and remain visibly failed.
- Repeated `×` marks above the bands encode mistakes.

### Mini

- Use a fixed 12-column by 10-row field with one particle per second, capped at
  120 particles.
- Color seconds 1–39 green, 40–79 yellow, and 80–120 red.
- Keep particles translucent and large enough to read as grains.
- Overlay the exact `m:ss` value prominently. Values above 120 seconds saturate
  the field without a `+` suffix.
- Preserve balanced space above and below the visualization despite the date
  label.

### Bracket City

- Render the accepted poster-block skyline: ten narrow buildings with varied
  heights and simple poster-like profiles.
- Each ten-point threshold illuminates another building.
- Keep buildings translucent enough that the large centered integer score stays
  readable.
- Use green for `85–100`, yellow for `60–84`, and red below `60`.
- Do not render rank icons.

### Tagline

- Render a fixed three-character field with filled stars for the earned result
  and outlined or quiet stars for the remainder.
- The star field contains all intended day-level information.

## Prototype comparison page

Keep the prototypes on the development-only
`/admin/game-showcase-prototypes` route. During this phase, update that page to
render the extracted production Month presentation and its synthetic prototype
fixture together so their visual output can be compared at the same viewport.
Neither rendering may appear on the public homepage during this phase.

The prototype fixture may import the production presentation modules, but it
retains ownership of synthetic data and design-review copy. Production modules
must not import prototype data, rejected variants, or prototype-only controls.

## Accessibility

- Informative cells have useful accessible names.
- Interactive controls supplied by the shared frame have visible keyboard focus
  and usable touch targets.
- Meaning remains available without color: Connections exposes order and
  mistakes, Mini and Bracket City show exact values, and Tagline exposes its star
  count.
- Avoid animation that interferes with scanning a month.

## Boundaries

- Do not integrate repository data or homepage URL behavior in this phase.
- Do not extract or implement production trend-chart rendering yet.
- Do not add a general design system, renderer registry, or one-line wrapper
  modules.
- Do not copy synthetic histories or rejected variant styles into production
  modules.
- Do not add charting dependencies or automated tests.

## Acceptance criteria

- Production-owned presentation modules expose a small interface for the shared
  showcase frame and complete Month rendering.
- The development-only comparison page renders the production Month
  presentation and the synthetic prototype fixture together.
- The accepted Month presentation matches the prototype across desktop and
  mobile layouts, including all four day encodings and missing/future states.
- Production presentation code contains no synthetic history, data loading,
  filesystem mutation, or URL-state ownership.
- The public homepage remains unchanged by this phase.

## User verification

The implementing agent must not run the site. It should ask the user to run
`npm run dev`, open `/admin/game-showcase-prototypes`, and compare the extracted
presentation with the prototype at desktop and mobile widths. The user should
inspect every game encoding, missing and future dates, a failed Connections
result, Mini above 120 seconds, Bracket thresholds, and all Tagline star values.

# Game showcase

Implement a homepage showcase for four daily word games: NYT Connections, NYT
Mini, The Atlantic's Bracket City, and Merriam-Webster Tagline. The showcase is
a personal, read-only presentation of repository-owned result data. It must be
visually distinctive while remaining honest about recorded and missing results.

This repository produces a static Astro site for GitHub Pages. There is no
runtime application server or database. Public game data is committed to this
repository, and a push triggers the existing static deployment workflow.

## Product outcome

- Place the showcase on the homepage immediately after the hero and before Work.
- Display the four games in a two-by-two desktop grid and a single column on mobile.
- Provide two views controlled by one shared switcher:
  - **Month**, the default, shows every date in one selected calendar month.
  - **Trends** shows performance over `3M`, `6M`, `1Y`, or all available history.
- Keep Month and Trends in the URL so a selected state can be shared. A fresh URL
  defaults to the current month; it does not remember a prior local preference.
- Preserve each view's selected month or range when switching during a visit.
- Treat a past date without a record as “no recorded result.” It is not zero, a
  failure, or a streak event. Future dates are visually distinct.

## Month visualizations

- **Connections:** a day cell contains horizontal yellow, green, blue, and
  purple bands in solve order. Repeated `×` marks above the bands encode mistakes.
  Failed games remain visibly distinct.
- **Mini:** one translucent particle represents one second, placed in a fixed
  12-by-10 field with a maximum of 120 particles. Particles 1–39 are green,
  40–79 yellow, and 80–120 red. The exact `m:ss` time is prominently overlaid;
  values above 120 saturate the field without a `+` suffix.
- **Bracket City:** “poster block” skylines use ten narrow buildings with varied
  heights. Each ten-point threshold illuminates another translucent building.
  The exact score is prominent over the skyline. Use green for `85–100`, yellow
  for `60–84`, and red below `60`. Do not show rank icons in the cell.
- **Tagline:** show a fixed-width three-star result in each played day. No hover
  detail is required.

## Trends visualization

- Use real calendar dates on the horizontal axis and only recorded results.
  Missing dates receive no mark, zero, inferred record, or special encoding.
- Draw a monotone spline through the recorded values. Do not use a rolling line,
  individual point dots, or granular tooltips.
- Fill the area under the spline with a translucent performance gradient that
  changes over time with the spline: green is good, yellow average, and red poor.
  Use narrow smooth transitions around each game's thresholds.
- Thresholds are:
  - Connections: green `0`, yellow `1–2`, red `3–4` and failures.
  - Mini: green below `40s`, yellow `40–79s`, red `80s+`.
  - Bracket City: green `85–100`, yellow `60–84`, red below `60`.
  - Tagline: green `3★`, yellow `2★`, red `1★`.
- Show one shared `good · average · poor` legend.
- Show a range summary on one line as `{value} in {count} games`, with the count
  subdued. Connections uses average mistakes with a failure valued as four;
  Mini uses median time; Bracket City uses average score; Tagline uses average
  stars. Round non-time summaries to one decimal and Mini to the nearest second.
- With no results, show `No games recorded in this range`. With one result, show
  one performance-colored dot and the normal one-game summary. Draw the spline
  and area with two or more results.

## Data and ingestion

- Store normalized public data in this repository, one chronological JSON file
  per game. Do not store it in the Obsidian vault.
- Validate the same schemas when parsing, manually entering, saving, and reading
  data. Zod is already a direct dependency.
- Raw pasted share text is discarded after parsing and never displayed publicly.
  Keep only small synthetic parser examples in source control.
- Reject duplicate game/date records unless replacement is explicitly requested.
- Provide a CLI fallback and automation surface, but make a development-only UI
  the normal ingestion workflow.
- `/admin` and `/admin/ingest-game-data` must exist only during local development
  and must not be emitted by production builds. The index is a plain list of
  available development tools.
- The ingestion page has side-by-side `Paste result` and `Enter manually` modes,
  editable parsed fields, an explicit preview/save step, intentional duplicate
  replacement, and a reminder that saving locally does not publish until commit
  and push.
- Neither interface commits, pushes, deploys, or writes to the vault.

## Explicit exclusions

- No backend, database, authentication system, or production admin route.
- No social comparison, combined cross-game score, records feature, or streaks.
- No CSV importer, zooming, or separate public games page.
- Do not retain native share text after parsing.

## Implementation phases

Each phase brief is self-contained enough to run as an individual `/goal`. Run
them in order when implementing the whole feature because later phases consume
contracts established by earlier ones.

1. [Data contracts and repository storage](01-data-contracts.md)
2. [Ingestion engine and CLI](02-ingestion-engine-and-cli.md)
3. [Development-only admin UI](03-development-admin-ui.md)
4. [Homepage Month view](04-month-view.md)
5. [Trends view](05-trends-view.md)
6. [Integration, accessibility, and prototype cleanup](06-integration-and-cleanup.md)

The existing `GameShowcasePrototype.astro` and
`GameShowcaseTrendPrototype.astro` files are disposable design references, not
production foundations. Phase 6 removes them after their validated decisions
have been implemented properly.

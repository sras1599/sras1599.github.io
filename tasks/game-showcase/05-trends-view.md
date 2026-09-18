# Phase 5 — Trends view

## Objective

Add the alternate Trends view to the homepage showcase. It presents recorded
performance over time with one semantic gradient-area spline per game and a
range-level summary. It deliberately does not repeat calendar-level detail.

## Prerequisite contract

Phase 4 should provide the homepage section, responsive card grid, view shell,
and URL-state ownership. Phase 1 supplies validated chronological records. If
those boundaries differ, adapt to the current focused implementation rather than
creating a parallel showcase.

Use a maintained library for standard axes, scales, and marks. Observable Plot is
the preferred choice agreed during design. Add it as a focused dependency and
lazy-load trend chart code on the first switch to Trends so the default Month
view does not eagerly pay its browser cost. Custom SVG definitions are acceptable
for semantic gradients when the library does not own that styling cleanly.

## Shared Trends controls

- Extend the view control to `Month | Trends` and preserve each view's state when
  switching during a visit.
- Provide `3M`, `6M`, `1Y`, and `All` ranges shared across all cards.
- Default to `6M` when six months of history exists. Before that, select `All`,
  display the actual starting date, and disable unavailable ranges.
- Encode state as `?games=trends&range=3m|6m|1y|all`.
- Use the same two-by-two desktop and stacked mobile card layout.

## Time-series rules

- The horizontal axis uses each record's real calendar date.
- Plot only recorded results. Missing dates produce no mark, zero, inferred
  record, dashed bridge, break, missing band, or missing-data lane.
- Connect recorded values with a monotone spline that passes through observations
  without overshooting adjacent values.
- Do not render individual-result dots with two or more results and do not add
  per-result annotations. Month owns exact daily inspection.
- Draw a translucent area below the spline. Its color changes along the time axis
  to match the spline's performance color, then fades downward. It must not use
  unrelated decorative colors.

## Axes and semantics

- Connections uses `0–4`; Mini uses zero through a rounded maximum visible in the
  range; Bracket City uses `0–100`; Tagline uses `1–3`.
- Lower values appear physically lower for Connections and Mini; label them
  `lower is better`. Higher values are better for Bracket and Tagline.
- Use one shared legend: green `good`, yellow `average`, red `poor`.
- Use narrow smooth transitions around:
  - Connections: green `0`, yellow `1–2`, red `3–4`/failure.
  - Mini: green below `40s`, yellow `40–79s`, red `80s+`.
  - Bracket City: green `85–100`, yellow `60–84`, red below `60`.
  - Tagline: green `3★`, yellow `2★`, red `1★`.

## Range summaries

Place value and subdued sample size on one line as `{value} in {count} games`.
The range is already visible in its control and is not repeated in the phrase.

- Connections: arithmetic mean of mistakes, treating failures as `4`.
- Mini: median duration, rounded to the nearest second and formatted `m:ss`.
- Bracket City: arithmetic mean score.
- Tagline: arithmetic mean stars.
- Format non-time summaries to one decimal.

With no records, show `No games recorded in this range`. With exactly one record,
show one performance-colored dot at its real date and the standard summary. Draw
the spline and area only with at least two records.

## Performance and accessibility

- First Trends selection should become usable quickly and should not fetch data;
  all records are statically available.
- At mobile widths reduce tick density, not calculations or direction labels.
- Color is supplementary: axis position, values, headings, and legend text must
  preserve meaning for users who cannot distinguish the gradient.
- Respect reduced motion; charts do not need animated drawing.

## Boundaries

- No rolling averages, secondary trend line, point cloud, missing-data encoding,
  zoom, records, or cross-game aggregation.
- Do not load data from a runtime service.
- Do not add automated tests unless separately requested.

## Acceptance criteria

- View/range controls restore from URL state and preserve Month state.
- Only the selected range's recorded results affect charts and summaries.
- Four monotone gradient-area splines use correct axes, directions, colors, and
  summary statistics.
- Sparse and empty ranges use the agreed fallbacks.
- Trend code is not eagerly loaded by default Month.
- Missing dates are neither displayed nor included in calculations.

## User verification

The implementing agent must not build or start the site. It may add the agreed
chart dependency with the repository's normal package-manager workflow, requesting
approval if the environment requires it. It should then ask the user to inspect
all ranges, URL restoration, threshold crossings, empty/one-result ranges, and
mobile axes.

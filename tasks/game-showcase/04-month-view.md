# Phase 4 — Homepage Month view

## Objective

Implement the public homepage's Month view using normalized repository data. It
is the default showcase view and displays an entire selected month for all four
games without scrolling inside an individual card.

## Prerequisite contract

Phase 1 should expose validated chronological arrays for Connections, Mini,
Bracket City, and Tagline. Consume that read-only contract. Do not import Node
filesystem mutation code into Astro components or browser scripts.

The homepage is `src/pages/index.astro`; place the section immediately after the
hero and before Work. Reuse the site's tokens and graphic language. The desktop
layout is two columns and mobile is one column.

## Shared Month shell

- Present this as a personal word-game snapshot, not an analytics dashboard.
- Provide one `Month | Trends` control. Month is selected on a fresh visit. If
  Trends is not implemented yet, do not ship a dead button; Phase 5 can add it.
- Provide one shared month/year selector plus previous/next buttons. It updates
  all cards together.
- Default to the current local month and disable future-month navigation.
- Encode non-default state as `?games=month&date=YYYY-MM`. A default URL stays clean.
- Render seven weekday columns and one fixed square for every date. Alignment
  cells are inert.
- Past dates without records show a quiet “no recorded result” treatment. Future
  dates in the current month are visually different, not missing.

## Connections card

- A played day contains horizontal category-color bands in actual solve order.
  Failed results may contain only completed bands and remain visibly failed.
- Place repeated `×` marks above the bands for mistakes.

## Mini card

- Use a fixed 12-column by 10-row field: one particle per second, capped at 120.
- Color seconds 1–39 green, 40–79 yellow, and 80–120 red. Keep particles
  translucent and large enough to read as grains.
- Overlay exact `m:ss` prominently. Above 120 seconds, retain the exact value but
  do not add a `+` indicator.
- Maintain balanced top and bottom space despite the date label.

## Bracket City card

- Use the accepted “poster blocks” skyline: ten narrow buildings with varied
  heights and simple poster-like profiles.
- Each ten-point threshold illuminates another building. Keep buildings
  translucent enough that the large centered score remains readable.
- Use green for `85–100`, yellow for `60–84`, and red below `60`.
- Do not render rank icons.

## Tagline card

- Render a fixed three-character star field: filled stars for earned stars and
  outlined or quiet stars for the remainder.
- Stars contain all intended day-level information.

## Accessibility and interaction

- Buttons and informative cells need useful names and visible keyboard focus.
- Do not rely on color alone: Connections has order/mistakes, Mini and Bracket
  show exact values, and Tagline exposes an accessible star count.
- Avoid animation that interferes with scanning a month.

## Boundaries

- No streaks, month aggregate, records, cross-game score, or public games page.
- Do not treat missing dates as failures or zeroes.
- Do not add charting dependencies for the calendar illustrations.
- Do not promote throwaway prototype code; re-create accepted behavior in focused
  production components.
- Do not add automated tests unless separately requested.

## Acceptance criteria

- The section occupies the agreed homepage position and responsive layout.
- One control navigates every card to the same full calendar month.
- All four day encodings match normalized records.
- Missing and future dates are distinct and honest.
- Current month is the default and future months cannot be selected.
- URL month state restores on reload and remains shareable.

## User verification

The implementing agent must not run the site. It should ask the user to inspect a
31-day month, a short month, edge weekday starts, missing and future dates, failed
Connections, Mini over 120 seconds, Bracket threshold edges, and all Tagline star
values at desktop and mobile widths.

# Phase 5 — Homepage Month view

## Objective

Integrate the production Month presentation from Phase 4 with normalized
repository data and public homepage state. It is the default showcase view and
displays an entire selected month for all four games without scrolling inside an
individual card.

## Prerequisite contract

Phase 1 should expose validated chronological arrays for Connections, Mini,
Bracket City, and Tagline. Phase 4 should provide the shared showcase frame and
Month presentation module. Consume both interfaces without duplicating their
validation or presentation rules. Do not import Node filesystem mutation code
into Astro modules or browser scripts.

The homepage is `src/pages/index.astro`; place the section immediately after the
hero and before Work.

## Shared Month shell

- Present this as a personal word-game snapshot, not an analytics dashboard.
- Provide one `Month | Trends` control. Month is selected on a fresh visit. If
  Trends is not implemented yet, do not ship a dead button; Phase 6 can add it.
- Provide one shared month/year selector plus previous/next buttons. It updates
  all cards together.
- Default to the current local month and disable future-month navigation.
- Encode non-default state as `?games=month&date=YYYY-MM`. A default URL stays clean.
- Past dates without records show a quiet “no recorded result” treatment. Future
  dates in the current month are visually different, not missing.

## Accessibility and interaction

- Month navigation has descriptive names, correct disabled states, visible
  keyboard focus, and usable touch targets.
- Preserve the accessible names and non-color cues owned by the Phase 4
  presentation modules.

## Boundaries

- No streaks, month aggregate, records, cross-game score, or public games page.
- Do not treat missing dates as failures or zeroes.
- Do not add charting dependencies for the calendar illustrations.
- Do not duplicate or reinterpret the Phase 4 presentation; supply it with live
  data and selected-month state through its interface.
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

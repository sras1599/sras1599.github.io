# Phase 2 — Ingestion engine

## Objective

Implement shared parsing, normalization, validation, and persistence for the
development admin UI in Phase 3. This phase does not create a user-facing entry
point, browser pages, a CLI, or public charts.

## Prerequisite contract

Phase 1 should provide one Zod schema per game, normalized result types, four
chronological JSON files, and a read-only loader. If those exact files do not yet
exist, inspect the current repository and establish the minimal equivalent before
building ingestion. Do not create a second competing schema system.

The project is ESM. Read `AGENTS.md` and the existing code before choosing module
boundaries. Browser-safe parsing and Node-only persistence must remain visibly
separate.

## Share formats to support

### Connections

Extract only the date, mistake count, and completed-category solve order.
An archived result prefixes its date line with `Archive`:

```text
Archive September 13, 2026
Connections Puzzle #1190
🟨🟦🟨🟨
🟪🟪🟪🟪
🟩🟦🟩🟦
🟩🟩🟩🟩
🟨🟨🟨🟦
🟨🟨🟨🟨
🟦🟦🟦🟦
```

The same day's shared result contains the same date line without that prefix,
for example `September 13, 2026`.

Derive the normalized fields from this visual representation:

- Parse `date` from the date line, accepting an optional leading `Archive` word.
  The parsed date remains editable in the Phase 3 preview before saving.
- Each row of four equal colors is a completed category. Append that color to
  `solveOrder` in the order the completed rows appear.
- Each mixed-color row is a mistake. Store the number of these rows as
  `mistakes`; four mistakes represents a failed result.

Ignore the puzzle number and do not store a separate solved/failed value. Success
or failure is fully represented by `mistakes`, while a failed result's
`solveOrder` may contain only the categories completed before the fourth mistake.

### Mini

Mini input is a duration such as `0:33` or `1:21`. It has no reliable embedded
date. Default to the laptop's local calendar date and allow an explicit date
override for history.

### Bracket City

Parse the date and score from the full shared result:

```text
[Bracket City]
September 16, 2026 🟢 (Easy)

Rank: 👮 (Chief of Police)
❌ Wrong guesses: 3
👀 Peeks: 2
🛟 Answers Revealed: 1

Total Score: 69.0
```

Ignore difficulty, rank, wrong guesses, peeks, answers revealed, the shared URL,
and decorative score blocks. They are not part of the normalized result. Truncate
the score to an integer while parsing.

### Tagline

Parse only the date and the number of explicit star glyphs from a shared result:

```text
TAGLINE: September 16, 2026
Today's Letters: ABDELMS
Hints Used: 0️⃣
⭐⭐⭐
```

Discard every other line, including letters and hints. Do not derive stars from
hints. Input without an explicit date and star result fails parsing and can be
entered manually through the Phase 3 UI instead.

## Shared ingestion engine

Expose focused operations for:

1. Auto-detecting a game from one pasted share result.
2. Parsing it into a normalized candidate without writing.
3. Validating a manually entered normalized candidate.
4. Previewing the exact record that would be saved.
5. Saving to the correct JSON file in chronological order.
6. Detecting a duplicate game/date and requiring explicit replacement.

Parsing failure writes nothing and returns a precise error. Saving revalidates
immediately before writing. Avoid partial JSON output with a safe local-file
replacement strategy. Raw text exists only in memory during parsing. Keep small
synthetic examples near the parser as documentation, but do not retain user input
or add a test suite.

## Boundaries

- Phase 3's development UI is the only supported workflow for ingesting an
  individual result. Do not add a CLI or automation entry point for this purpose.
- The engine never commits, pushes, deploys, or edits the vault.
- Do not add production HTTP endpoints or duplicate schema validation in UI
  controls.
- Parse one shared result at a time. Do not add bulk or CSV ingestion.
- Do not silently repair malformed records or replace duplicates.
- Do not add automated tests unless separately requested.

## Acceptance criteria

- All four native formats normalize into Phase 1 records.
- Preview and parse operations do not mutate files.
- Explicitly requested saves are chronological and schema-valid.
- Duplicate saves fail unless replacement is explicitly requested.
- Mini defaults to the local date, which remains editable before saving in the
  Phase 3 UI.
- Errors identify the invalid portion and leave persisted data intact.
- No CLI or other user-facing ingestion entry point is introduced.

## User verification

The implementing agent must not run verification commands. It should identify
the parser and persistence boundaries for review and provide concrete examples
for exercising parsing, cancellation, duplicate rejection, and replacement once
the Phase 3 UI is available.

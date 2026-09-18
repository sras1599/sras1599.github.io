# Phase 2 — Ingestion engine and CLI

## Objective

Implement shared parsing, normalization, validation, persistence, and a CLI for
adding game results. The engine must be reusable by the development admin UI in
Phase 3. This phase does not create browser pages or public charts.

## Prerequisite contract

Phase 1 should provide one Zod schema per game, normalized result types, four
chronological JSON files, and a read-only loader. If those exact files do not yet
exist, inspect the current repository and establish the minimal equivalent before
building ingestion. Do not create a second competing schema system.

The project is ESM and uses Node scripts under `scripts/`. Read `AGENTS.md` and
the existing scripts before choosing module boundaries. Browser-safe parsing and
Node-only persistence must remain visibly separate.

## Share formats to support

### Connections

Extract only the date, mistake count, and completed-category solve order.
Representative input:

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

Derive the normalized fields from this visual representation:

- Parse `date` from the archive date line.
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
and decorative score blocks. They are not part of the normalized result.

### Tagline

Parse only the date and the number of explicit star glyphs from a shared result:

```text
TAGLINE: September 16, 2026
Today's Letters: ABDELMS
Hints Used: 0️⃣
⭐⭐⭐
```

Discard every other line, including letters and hints. Do not derive stars from
hints. Input without an explicit star result fails parsing; the CLI's date
override may supply or replace the date as usual.

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

## CLI workflow

Add `npm run games:add`. Its default interactive flow is:

1. Prompt for one pasted result.
2. Accept `.done` on its own line to finish multiline input.
3. Auto-detect, parse, and show a normalized preview.
4. Ask for confirmation before saving.
5. Report the updated file and record.
6. Ask whether to add another result.

Support these correction and automation paths without creating a general import
framework:

- `--date YYYY-MM-DD` supplies or overrides the result date.
- `--replace` intentionally replaces the same game/date record.
- `--manual <game>` prompts for that game's known fields after parsing fails.
- `--file <path>` reads one result for a history script.
- `--yes` skips confirmation for deliberate automation.

Do not parse multiple concatenated results in one invocation. A history script
can invoke the command or engine once per result. Do not add CSV support.

## Boundaries

- The command never commits, pushes, deploys, or edits the vault.
- Do not add production HTTP endpoints or duplicate schema validation in prompts.
- Do not silently repair malformed records or replace duplicates.
- Do not add automated tests unless separately requested.

## Acceptance criteria

- All four native formats normalize into Phase 1 records.
- Preview and parse operations do not mutate files.
- Confirmed saves are chronological and schema-valid.
- Duplicate saves fail; `--replace` is explicit.
- Mini accepts date overrides and otherwise uses the local date.
- Errors identify the invalid portion and leave persisted data intact.

## User verification

The implementing agent must not run the command. It should give the user concrete
manual examples for parsing each game, rejecting and replacing a duplicate, and
checking that cancelled or failed parsing leaves JSON unchanged.

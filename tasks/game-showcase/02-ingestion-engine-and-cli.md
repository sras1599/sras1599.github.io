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

Parse the archive date, puzzle number, emoji rows, solved/failed state, mistake
count, and completed-category solve order. Representative shape:

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

A row of four equal colors is a completed category. Other emoji rows are
mistakes. A result that does not complete all four categories is failed.

### Mini

Mini input is a duration such as `0:33` or `1:21`. It has no reliable embedded
date. Default to the laptop's local calendar date and allow an explicit date
override for history.

### Bracket City

Parse date, difficulty, rank, wrong guesses, peeks, answers revealed, and score:

```text
[Bracket City]
September 16, 2026 🟢 (Easy)

Rank: 👮 (Chief of Police)
❌ Wrong guesses: 3
👀 Peeks: 2
🛟 Answers Revealed: 1

Total Score: 69.0
```

Ignore the shared URL and decorative score blocks. Store normalized labels, not
the rank emoji.

### Tagline

Support both a full dated format and a simple undated format:

```text
TAGLINE: September 16, 2026
Today's Letters: ABDELMS
Hints Used: 0️⃣
⭐⭐⭐
```

```text
Letters: ABDELMS
Hints: 0
```

For undated input, use an explicit date override when supplied; otherwise use the
local calendar date. Derive stars only when native text omits them, using the
game's three-star/hint rule, then validate.

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
- Mini and simple Tagline accept date overrides and otherwise use local dates.
- Errors identify the invalid portion and leave persisted data intact.

## User verification

The implementing agent must not run the command. It should give the user concrete
manual examples for parsing each game, rejecting and replacing a duplicate, and
checking that cancelled or failed parsing leaves JSON unchanged.

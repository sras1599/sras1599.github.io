/**
 * Convert historical game exports into the website's normalized game records.
 *
 * This deliberately small, one-time CLI reads one user-supplied export, adapts
 * its source-specific fields, validates every result with the same Zod schemas
 * used by the site, and merges the results into one fixed game data file. It is
 * dry-run-only unless `--write` is passed, and an existing game/date collision
 * additionally requires `--replace-existing`. Writes use an adjacent temporary
 * file followed by an atomic rename; source exports are never modified.
 *
 * Supported sources are the NYT Connections and Mini state API responses, a
 * complete Bracket City localStorage JSON export, and Tagline archive-card HTML.
 * Incomplete/unplayed source entries are reported and omitted because the site
 * contracts represent completed results only. Tagline archive labels omit the
 * year, so callers supply the year of the newest card with `--year`.
 */
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bracketCityResultSchema,
  connectionsResultSchema,
  gameIdSchema,
  miniResultSchema,
  taglineResultSchema,
  type GameData,
  type GameId,
} from "../src/data/games/contracts.ts";

type GameRecord = GameData[GameId][number];

type ParsedHistory = {
  records: GameRecord[];
  skipped: Record<string, number>;
};

type CliOptions = {
  game: GameId;
  inputPath: string;
  taglineYear?: number;
  write: boolean;
  replaceExisting: boolean;
};

const targetFiles: Record<GameId, { url: URL; repositoryPath: string }> = {
  connections: {
    url: new URL("../src/data/games/connections.json", import.meta.url),
    repositoryPath: "src/data/games/connections.json",
  },
  mini: {
    url: new URL("../src/data/games/mini.json", import.meta.url),
    repositoryPath: "src/data/games/mini.json",
  },
  "bracket-city": {
    url: new URL("../src/data/games/bracket-city.json", import.meta.url),
    repositoryPath: "src/data/games/bracket-city.json",
  },
  tagline: {
    url: new URL("../src/data/games/tagline.json", import.meta.url),
    repositoryPath: "src/data/games/tagline.json",
  },
};

const connectionsColors = ["yellow", "green", "blue", "purple"] as const;

const monthNumbers: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

/** Give malformed source exports a field-specific failure before normalization. */
function expectObject(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function expectArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array.`);
  return value;
}

function expectString(value: unknown, context: string): string {
  if (typeof value !== "string") throw new Error(`${context} must be a string.`);
  return value;
}

function expectNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number.`);
  }

  return value;
}

function parseJson(input: string, context: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} is not valid JSON: ${detail}`, { cause: error });
  }
}

/** Validate normalized output through the authoritative site schema for its game. */
function validateRecord(game: GameId, input: unknown): GameRecord {
  switch (game) {
    case "connections":
      return connectionsResultSchema.parse(input);
    case "mini":
      return miniResultSchema.parse(input);
    case "bracket-city":
      return bracketCityResultSchema.parse(input);
    case "tagline":
      return taglineResultSchema.parse(input);
  }
}

/** Sort records once and reject repeated dates within either source or target. */
function normalizeRecordSet(
  game: GameId,
  records: GameRecord[],
  context: string,
): GameRecord[] {
  const validated = records.map((record, index) => {
    try {
      return validateRecord(game, record);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${context} record ${index + 1} is invalid: ${detail}`, {
        cause: error,
      });
    }
  });
  validated.sort((left, right) => left.date.localeCompare(right.date));

  validated.forEach((record, index) => {
    if (index > 0 && validated[index - 1].date === record.date) {
      throw new Error(`${context} contains duplicate date ${record.date}.`);
    }
  });

  return validated;
}

/**
 * Convert NYT Connections state. Category levels are the API's difficulty
 * order: 0 yellow, 1 green, 2 blue, and 3 purple. `orderSolved` supplies the
 * authored solve sequence even when the player lost after four mistakes.
 */
function parseConnectionsHistory(input: string): ParsedHistory {
  const root = expectObject(parseJson(input, "Connections export"), "Connections export");
  const states = expectArray(root.states, "Connections export.states");
  const records: GameRecord[] = [];
  let incomplete = 0;

  states.forEach((value, index) => {
    const state = expectObject(value, `Connections state ${index + 1}`);
    if (state.game !== "connections") return;

    const gameData = expectObject(
      state.game_data,
      `Connections state ${index + 1}.game_data`,
    );
    if (gameData.puzzleComplete !== true) {
      incomplete += 1;
      return;
    }

    const solvedCategories = expectArray(
      gameData.solvedCategories,
      `Connections state ${index + 1}.game_data.solvedCategories`,
    )
      .map((category, categoryIndex) => {
        const parsed = expectObject(
          category,
          `Connections state ${index + 1} solved category ${categoryIndex + 1}`,
        );
        return {
          level: expectNumber(parsed.level, "Connections category level"),
          order: expectNumber(parsed.orderSolved, "Connections category solve order"),
        };
      })
      .sort((left, right) => left.order - right.order);

    records.push({
      date: expectString(state.print_date, `Connections state ${index + 1}.print_date`),
      mistakes: expectNumber(gameData.mistakes, "Connections mistakes"),
      solveOrder: solvedCategories.map(({ level }) => connectionsColors[level]),
    });
  });

  return { records, skipped: { incomplete } };
}

/** Convert completed NYT Mini states using their first recorded solve duration. */
function parseMiniHistory(input: string): ParsedHistory {
  const root = expectObject(parseJson(input, "Mini export"), "Mini export");
  const states = expectArray(root.states, "Mini export.states");
  const records: GameRecord[] = [];
  let incomplete = 0;

  states.forEach((value, index) => {
    const state = expectObject(value, `Mini state ${index + 1}`);
    if (state.game !== "crossword_mini") return;

    const gameData = expectObject(state.game_data, `Mini state ${index + 1}.game_data`);
    if (gameData.completionFraction !== 1) {
      incomplete += 1;
      return;
    }

    records.push({
      date: expectString(state.print_date, `Mini state ${index + 1}.print_date`),
      durationSeconds: expectNumber(
        gameData.firstSolve,
        `Mini state ${index + 1}.game_data.firstSolve`,
      ),
    });
  });

  return { records, skipped: { incomplete } };
}

/**
 * Convert completed Bracket City localStorage entries. The export does not keep
 * the displayed total, but it retains the three penalty inputs: two points per
 * wrong guess, five per peek, and fifteen more per revealed answer. Reveals are
 * also present in `peekedClues`, so they cost twenty points in total. The game
 * floors totals at zero.
 */
function parseBracketCityHistory(input: string): ParsedHistory {
  const root = expectObject(
    parseJson(input, "Bracket City localStorage export"),
    "Bracket City localStorage export",
  );
  const records: GameRecord[] = [];
  let incomplete = 0;

  Object.entries(root).forEach(([key, storedValue]) => {
    if (!key.startsWith("bracketPuzzle_")) return;

    const value =
      typeof storedValue === "string"
        ? parseJson(storedValue, `Bracket City entry ${key}`)
        : storedValue;
    const state = expectObject(value, `Bracket City entry ${key}`);
    const date = expectString(state.puzzleDate, `${key}.puzzleDate`);
    const keyDate = key.slice("bracketPuzzle_".length);
    if (date !== keyDate) {
      throw new Error(`${key} contains mismatched puzzleDate ${JSON.stringify(date)}.`);
    }
    if (state.isComplete !== true) {
      incomplete += 1;
      return;
    }

    const wrongGuesses = expectNumber(state.wrongGuesses, `${key}.wrongGuesses`);
    const peeks = expectArray(state.peekedClues, `${key}.peekedClues`).length;
    const reveals = expectArray(state.megaPeekedClues, `${key}.megaPeekedClues`).length;
    const score = Math.max(0, 100 - wrongGuesses * 2 - peeks * 5 - reveals * 15);
    records.push({ date, score });
  });

  return { records, skipped: { incomplete } };
}

/**
 * Read the semantic archive-card labels instead of depending on presentation
 * markup. Cards are newest-first. When their month jumps forward (January to
 * December), the parser has crossed into the preceding year.
 */
function parseTaglineHistory(input: string, newestYear: number): ParsedHistory {
  const cardPattern =
    /aria-label="Archive card for game dated ([A-Z][a-z]{2}) (\d{1,2}) in status: ([^"]+)"/g;
  const records: GameRecord[] = [];
  const skipped: Record<string, number> = { unstarted: 0, "not solved": 0 };
  let match: RegExpExecArray | null;
  let year = newestYear;
  let previousMonth: number | undefined;
  let cardCount = 0;

  while ((match = cardPattern.exec(input)) !== null) {
    cardCount += 1;
    const month = monthNumbers[match[1]];
    if (month === undefined) throw new Error(`Unknown Tagline archive month ${match[1]}.`);
    if (previousMonth !== undefined && month > previousMonth) year -= 1;
    previousMonth = month;

    const day = Number(match[2]);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = match[3];
    const solved = status.match(/^solved, ([1-3]) stars? earned$/);
    if (solved) {
      records.push({ date, stars: Number(solved[1]) });
      continue;
    }
    if (status === "unstarted" || status === "not solved") {
      skipped[status] += 1;
      continue;
    }

    throw new Error(`Unsupported Tagline status ${JSON.stringify(status)} for ${date}.`);
  }

  if (cardCount === 0) {
    throw new Error("Tagline HTML contains no recognizable archive cards.");
  }

  return { records, skipped };
}

/** Parse the intentionally narrow CLI without accepting arbitrary output paths. */
function parseArguments(args: string[]): CliOptions {
  const [gameInput, inputPath, ...flags] = args;
  const parsedGame = gameIdSchema.safeParse(gameInput);
  if (!parsedGame.success || !inputPath) {
    throw new Error(
      "Usage: npm run games:import-history -- <connections|mini|bracket-city|tagline> <input-file> [--year YYYY] [--write] [--replace-existing]",
    );
  }

  let taglineYear: number | undefined;
  let write = false;
  let replaceExisting = false;

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--write") {
      write = true;
    } else if (flag === "--replace-existing") {
      replaceExisting = true;
    } else if (flag === "--year") {
      const value = flags[index + 1];
      if (!/^\d{4}$/.test(value ?? "")) {
        throw new Error("--year must be followed by the four-digit year of the newest Tagline card.");
      }
      taglineYear = Number(value);
      index += 1;
    } else {
      throw new Error(`Unknown option ${JSON.stringify(flag)}.`);
    }
  }

  if (parsedGame.data === "tagline" && taglineYear === undefined) {
    throw new Error("Tagline archive HTML omits years; pass --year for its newest card.");
  }
  if (parsedGame.data !== "tagline" && taglineYear !== undefined) {
    throw new Error("--year applies only to Tagline archive HTML.");
  }
  if (replaceExisting && !write) {
    throw new Error("--replace-existing has no effect without --write.");
  }

  return {
    game: parsedGame.data,
    inputPath: resolve(inputPath),
    taglineYear,
    write,
    replaceExisting,
  };
}

function parseHistory(options: CliOptions, input: string): ParsedHistory {
  switch (options.game) {
    case "connections":
      return parseConnectionsHistory(input);
    case "mini":
      return parseMiniHistory(input);
    case "bracket-city":
      return parseBracketCityHistory(input);
    case "tagline":
      return parseTaglineHistory(input, options.taglineYear!);
  }
}

/** Read and validate the complete current target before proposing any merge. */
async function readExistingRecords(game: GameId): Promise<GameRecord[]> {
  const target = targetFiles[game];
  const input = parseJson(
    await readFile(target.url, "utf8"),
    target.repositoryPath,
  );
  const records = expectArray(input, target.repositoryPath) as GameRecord[];
  const validated = normalizeRecordSet(game, records, target.repositoryPath);

  records.forEach((record, index) => {
    if (index > 0 && records[index - 1].date >= record.date) {
      throw new Error(`${target.repositoryPath} must already be in ascending date order.`);
    }
  });

  return validated;
}

/** Merge by date while keeping collisions visible and replacements explicit. */
function mergeRecords(
  existing: GameRecord[],
  imported: GameRecord[],
  replaceExisting: boolean,
): { records: GameRecord[]; collisions: string[] } {
  const byDate = new Map(existing.map((record) => [record.date, record]));
  const collisions = imported
    .filter((record) => byDate.has(record.date))
    .map((record) => record.date);

  if (collisions.length > 0 && !replaceExisting) {
    return { records: existing, collisions };
  }

  imported.forEach((record) => byDate.set(record.date, record));
  return {
    records: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
    collisions,
  };
}

/** Replace the fixed target atomically and remove a leftover temporary on error. */
async function writeRecords(game: GameId, records: GameRecord[]): Promise<void> {
  const target = targetFiles[game];
  const targetPath = fileURLToPath(target.url);
  const temporaryUrl = new URL(
    `./.${game}.history.${process.pid}.${randomUUID()}.tmp`,
    target.url,
  );

  try {
    await writeFile(temporaryUrl, `${JSON.stringify(records, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryUrl, targetPath);
  } catch (error) {
    await unlink(temporaryUrl).catch(() => undefined);
    throw new Error(`Could not safely replace ${target.repositoryPath}.`, {
      cause: error,
    });
  }
}

/** Coordinate parsing, schema validation, preview, collision handling, and write. */
async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const source = await readFile(options.inputPath, "utf8");
  const parsed = parseHistory(options, source);
  const imported = normalizeRecordSet(options.game, parsed.records, "Imported history");
  if (imported.length === 0) {
    throw new Error("The source contains no completed results to import.");
  }
  const existing = await readExistingRecords(options.game);
  const merge = mergeRecords(existing, imported, options.replaceExisting);
  const skipped = Object.entries(parsed.skipped)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(", ");

  console.log(`Parsed ${imported.length} ${options.game} records from ${options.inputPath}.`);
  if (skipped) console.log(`Skipped source entries: ${skipped}.`);
  console.log(
    `Target ${targetFiles[options.game].repositoryPath} currently has ${existing.length} records.`,
  );

  if (merge.collisions.length > 0 && !options.replaceExisting) {
    const dates = merge.collisions.join(", ");
    if (options.write) {
      throw new Error(
        `Refusing to replace ${merge.collisions.length} existing dates (${dates}); review them, then rerun with --replace-existing if intended.`,
      );
    }
    console.log(`Existing-date collisions (not merged): ${dates}.`);
  }

  if (!options.write) {
    const preview =
      merge.collisions.length > 0 ? mergeRecords(existing, imported, true).records : merge.records;
    console.log(
      merge.collisions.length > 0
        ? "Dry run only. Proposed target contents if collisions are explicitly replaced:"
        : "Dry run only. Proposed target contents:",
    );
    console.log(JSON.stringify(preview, null, 2));
    console.log("Rerun with --write to save; collisions also require --replace-existing.");
    return;
  }

  await writeRecords(options.game, merge.records);
  console.log(
    `Wrote ${merge.records.length} chronological records to ${targetFiles[options.game].repositoryPath}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

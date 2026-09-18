/**
 * Load and validate repository-owned game results for website consumers. The
 * loader imports the four static JSON arrays, validates every normalized record,
 * and enforces unique, strictly ascending dates before returning typed data
 * keyed by game ID. It is browser-safe and performs no filesystem mutation.
 */
import { z } from "zod";
import connectionsJson from "./connections.json";
import miniJson from "./mini.json";
import bracketCityJson from "./bracket-city.json";
import taglineJson from "./tagline.json";
import {
  bracketCityResultSchema,
  connectionsResultSchema,
  miniResultSchema,
  taglineResultSchema,
  type GameData,
  type GameId,
} from "./contracts";

/** Render a Zod path as the persisted field a data owner should inspect. */
function formatFieldPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "record";
  }

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") {
      return `${formatted}[${segment}]`;
    }

    return formatted ? `${formatted}.${String(segment)}` : String(segment);
  }, "");
}

/**
 * Validate one game's complete persisted array. Failures retain the game ID,
 * array position (and authored date when available), and the invalid field.
 */
function validateResults<Result extends { date: string }>(
  game: GameId,
  input: unknown,
  schema: z.ZodType<Result>,
): Result[] {
  if (!Array.isArray(input)) {
    throw new Error(
      `Invalid ${game} data at array position 0, field record: must be a top-level array`,
    );
  }

  const results: Result[] = [];
  const seenDates = new Set<string>();
  let previousDate: string | undefined;

  input.forEach((candidate, index) => {
    const parsed = schema.safeParse(candidate);

    if (!parsed.success) {
      const candidateDate =
        typeof candidate === "object" &&
        candidate !== null &&
        "date" in candidate &&
        typeof candidate.date === "string"
          ? `, date ${JSON.stringify(candidate.date)}`
          : "";
      const issues = parsed.error.issues
        .map(
          (issue) =>
            `field ${formatFieldPath(issue.path)}: ${issue.message}`,
        )
        .join("; ");

      throw new Error(
        `Invalid ${game} result at array position ${index}${candidateDate}, ${issues}`,
      );
    }

    const { date } = parsed.data;
    if (seenDates.has(date)) {
      throw new Error(
        `Invalid ${game} result at array position ${index}, date ${JSON.stringify(date)}, field date: duplicates an earlier result`,
      );
    }
    if (previousDate !== undefined && date < previousDate) {
      throw new Error(
        `Invalid ${game} result at array position ${index}, date ${JSON.stringify(date)}, field date: must be later than previous date ${JSON.stringify(previousDate)}`,
      );
    }

    results.push(parsed.data);
    seenDates.add(date);
    previousDate = date;
  });

  return results;
}

/** Return all persisted game results after validating their shared contract. */
export function loadGameData(): GameData {
  return {
    connections: validateResults(
      "connections",
      connectionsJson,
      connectionsResultSchema,
    ),
    mini: validateResults("mini", miniJson, miniResultSchema),
    "bracket-city": validateResults(
      "bracket-city",
      bracketCityJson,
      bracketCityResultSchema,
    ),
    tagline: validateResults("tagline", taglineJson, taglineResultSchema),
  };
}

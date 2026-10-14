/**
 * Validate normalized candidates and complete persisted arrays for all game
 * consumers. This module is browser-safe; share parsing and filesystem
 * operations belong to their respective ingestion and persistence modules.
 */
import type { z } from "zod";
import {
  bracketCityResultSchema,
  connectionsResultSchema,
  formatGameResultField,
  miniResultSchema,
  taglineResultSchema,
  type BracketCityResult,
  type ConnectionsResult,
  type GameData,
  type GameId,
  type MiniResult,
  type TaglineResult,
} from "./contracts.ts";

export type NormalizedGameCandidate =
  | { game: "connections"; record: ConnectionsResult }
  | { game: "mini"; record: MiniResult }
  | { game: "bracket-city"; record: BracketCityResult }
  | { game: "tagline"; record: TaglineResult };

export type CandidateValidationIssue = {
  field: string;
  message: string;
};

/** Preserve field-level schema failures so the admin UI can render them inline. */
export class CandidateValidationError extends Error {
  readonly game: GameId;
  readonly issues: CandidateValidationIssue[];

  constructor(game: GameId, issues: CandidateValidationIssue[]) {
    const details = issues
      .map(({ field, message }) => `${field}: ${message}`)
      .join("; ");
    super(`Invalid ${game} result: ${details}`);
    this.name = "CandidateValidationError";
    this.game = game;
    this.issues = issues;
  }
}

/** Validate a candidate with one authoritative game schema and retain fields. */
function parseCandidate<Result>(
  game: GameId,
  input: unknown,
  schema: z.ZodType<Result>,
): Result {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  throw new CandidateValidationError(
    game,
    parsed.error.issues.map((issue) => ({
      field: formatGameResultField(issue.path),
      message: issue.message,
    })),
  );
}

/**
 * Validate manually entered or edited normalized fields. The discriminated
 * result gives callers the exact game/record pair accepted by persistence.
 */
export function validateGameCandidate(
  game: GameId,
  input: unknown,
): NormalizedGameCandidate {
  switch (game) {
    case "connections":
      return {
        game,
        record: parseCandidate(game, input, connectionsResultSchema),
      };
    case "mini":
      return { game, record: parseCandidate(game, input, miniResultSchema) };
    case "bracket-city":
      return {
        game,
        record: parseCandidate(game, input, bracketCityResultSchema),
      };
    case "tagline":
      return { game, record: parseCandidate(game, input, taglineResultSchema) };
  }
}

/** Persisted arrays must already have unique dates in strictly ascending order. */
export function validatePersistedResults<Game extends GameId>(
  game: Game,
  input: unknown,
): GameData[Game] {
  if (!Array.isArray(input)) {
    throw new Error(`Invalid ${game} data, field record: must be a top-level array.`);
  }

  const records: NormalizedGameCandidate["record"][] = [];
  const seenDates = new Set<string>();
  let previousDate: string | undefined;

  input.forEach((value, index) => {
    const dateContext =
      typeof value === "object" && value !== null &&
      "date" in value && typeof value.date === "string"
        ? `, date ${JSON.stringify(value.date)}`
        : "";
    const context = `Invalid persisted ${game} result at array position ${index}${dateContext}`;
    let record: NormalizedGameCandidate["record"];
    try {
      record = validateGameCandidate(game, value).record;
    } catch (error) {
      if (!(error instanceof CandidateValidationError)) throw error;
      throw new Error(`${context}: ${error.message}`, { cause: error });
    }

    if (seenDates.has(record.date)) {
      throw new Error(`${context}, field date: duplicates an earlier result.`);
    }
    if (previousDate !== undefined && record.date < previousDate) {
      throw new Error(`${context}, field date: must be later than previous date ${JSON.stringify(previousDate)}.`);
    }

    records.push(record);
    seenDates.add(record.date);
    previousDate = record.date;
  });

  // Each record was parsed using the schema selected by this exact game ID.
  return records as GameData[Game];
}

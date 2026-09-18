/**
 * Parse one native game share into the normalized records owned by the website.
 * This module is browser-safe: it detects formats, extracts only persisted
 * fields, and validates manual or parsed candidates with the authoritative Zod
 * schemas. Raw share text is accepted only as a function input and is never
 * retained. Filesystem reads and writes belong to `persistence.ts`.
 */
import { format, isMatch, parse } from "date-fns";
import { enUS } from "date-fns/locale";
import type { z } from "zod";
import {
  bracketCityResultSchema,
  connectionsResultSchema,
  formatGameResultField,
  gameDateSchema,
  miniResultSchema,
  taglineResultSchema,
  type BracketCityResult,
  type ConnectionsResult,
  type GameId,
  type MiniResult,
  type TaglineResult,
} from "./contracts";

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

const connectionsColors = {
  "🟨": "yellow",
  "🟩": "green",
  "🟦": "blue",
  "🟪": "purple",
} as const;

/**
 * Remove zero-width spaces that native share sheets can insert into visible
 * labels. For example, Tagline may copy `TAGLINE\u200B:` even though it renders
 * as `TAGLINE:`. No meaningful result field relies on this formatting code
 * point, so removing it before format detection and parsing is lossless.
 */
function normalizeSharedText(input: string): string {
  return input.replaceAll("\u200B", "");
}

/** Format the laptop's current local calendar day without applying UTC shifts. */
function localCalendarDate(now = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/**
 * Convert an English share date such as `September 16, 2026` to the storage
 * form. date-fns performs strict English-format and calendar validation before
 * formatting the result as the repository's date-only representation.
 */
function parseEnglishDate(value: string, context: string): string {
  const shareDateFormat = "MMMM d, yyyy";
  if (!isMatch(value, shareDateFormat, { locale: enUS })) {
    throw new Error(
      `${context} must contain a date like \"September 16, 2026\"`,
    );
  }

  const date = parse(value, shareDateFormat, new Date(), { locale: enUS });
  return format(date, "yyyy-MM-dd");
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

/**
 * Identify one pasted native result without parsing its values. Signals are
 * deliberately narrow so arbitrary text is not misclassified as a game share.
 */
export function detectSharedGame(input: string): GameId {
  const text = normalizeSharedText(input).trim();
  if (!text) throw new Error("Paste a game result before parsing.");

  const matches: GameId[] = [];
  if (/^Connections(?: Puzzle)?\b/im.test(text)) matches.push("connections");
  if (/^\[Bracket City\]\s*$/im.test(text)) matches.push("bracket-city");
  if (/^TAGLINE:/im.test(text)) matches.push("tagline");
  if (/^\d+:\d{2}$/.test(text)) matches.push("mini");

  if (matches.length === 0) {
    throw new Error(
      "Could not detect a Connections, Mini, Bracket City, or Tagline result.",
    );
  }
  if (matches.length > 1) {
    throw new Error(`The pasted text matches multiple games: ${matches.join(", ")}.`);
  }

  return matches[0];
}

/**
 * Parse Connections rows. For example, `🟨🟨🟨🟨` completes yellow while
 * `🟨🟦🟨🟨` counts as one mistake. An `Archive` date prefix is optional.
 */
function parseConnections(text: string): NormalizedGameCandidate {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const dateLine = lines.find((line) =>
    /^(?:Archive )?[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(line),
  );
  if (!dateLine) {
    throw new Error(
      "Connections result is missing its date line (for example, \"Archive September 13, 2026\").",
    );
  }

  const rowLines = lines
    .map((line) => line.replaceAll("\uFE0F", ""))
    .filter((line) => /[🟨🟩🟦🟪]/u.test(line));
  if (rowLines.length === 0) {
    throw new Error("Connections result contains no colored result rows.");
  }

  const solveOrder: Array<
    (typeof connectionsColors)[keyof typeof connectionsColors]
  > = [];
  let mistakes = 0;

  rowLines.forEach((line, index) => {
    if (!/^[🟨🟩🟦🟪]+$/u.test(line)) {
      throw new Error(
        `Connections row ${index + 1} must contain colored squares only.`,
      );
    }

    const colors = Array.from(line) as Array<keyof typeof connectionsColors>;
    if (colors.length !== 4) {
      throw new Error(
        `Connections row ${index + 1} must contain exactly four colored squares.`,
      );
    }

    const completedColor = connectionsColors[colors[0]];
    if (colors.every((color) => color === colors[0])) {
      solveOrder.push(completedColor);
    } else {
      mistakes += 1;
    }
  });

  const date = parseEnglishDate(
    dateLine.replace(/^Archive /, ""),
    "Connections result",
  );
  return validateGameCandidate("connections", { date, mistakes, solveOrder });
}

/** Parse a Mini `minutes:seconds` duration and apply its editable date default. */
function parseMini(text: string, dateOverride?: string): NormalizedGameCandidate {
  const match = text.trim().match(/^(\d+):(\d{2})$/);
  if (!match) {
    throw new Error("Mini duration must use minutes:seconds, such as \"0:33\".");
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) {
    throw new Error("Mini seconds must be between 00 and 59.");
  }

  const date = dateOverride ?? localCalendarDate();
  const parsedDate = gameDateSchema.safeParse(date);
  if (!parsedDate.success) {
    throw new Error("Mini date override must be a valid YYYY-MM-DD date.");
  }

  return validateGameCandidate("mini", {
    date: parsedDate.data,
    durationSeconds: minutes * 60 + seconds,
  });
}

/** Parse the dated integer portion of a Bracket City share's total score. */
function parseBracketCity(text: string): NormalizedGameCandidate {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const dateLine = lines.find((line) =>
    /^[A-Z][a-z]+ \d{1,2}, \d{4}(?:\s|$)/.test(line),
  );
  if (!dateLine) {
    throw new Error("Bracket City result is missing its date line.");
  }

  const dateText = dateLine.match(
    /^[A-Z][a-z]+ \d{1,2}, \d{4}/,
  )?.[0];
  const scoreLine = lines.find((line) => /^Total Score:/i.test(line));
  if (!scoreLine) {
    throw new Error("Bracket City result is missing its \"Total Score\" line.");
  }

  const scoreMatch = scoreLine.match(/^Total Score:\s*(\d+(?:\.\d+)?)\s*$/i);
  if (!scoreMatch) {
    throw new Error("Bracket City total score must be a non-negative number.");
  }

  const date = parseEnglishDate(dateText!, "Bracket City result");
  const score = Math.trunc(Number(scoreMatch[1]));
  return validateGameCandidate("bracket-city", { date, score });
}

/**
 * Parse Tagline's explicit dated result and count only a standalone star row;
 * hints and all other metadata are intentionally ignored.
 */
function parseTagline(text: string): NormalizedGameCandidate {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const dateLine = lines.find((line) => /^TAGLINE:/i.test(line));
  if (!dateLine) {
    throw new Error("Tagline result is missing its TAGLINE date line.");
  }

  const dateMatch = dateLine.match(
    /^TAGLINE:\s*[A-Z][a-z]+ \d{1,2}, \d{4}\s*$/,
  );
  if (!dateMatch) {
    throw new Error(
      "Tagline date line must look like \"TAGLINE: September 16, 2026\".",
    );
  }

  const starLine = lines.find((line) => /^(?:⭐\uFE0F?\s*)+$/u.test(line));
  if (!starLine) {
    throw new Error("Tagline result is missing an explicit star result row.");
  }

  const dateText = dateLine.replace(/^TAGLINE:\s*/i, "");
  const date = parseEnglishDate(dateText, "Tagline result");
  const stars = Array.from(
    starLine.replaceAll("\uFE0F", "").replaceAll(/\s/g, ""),
  ).length;
  return validateGameCandidate("tagline", { date, stars });
}

/**
 * Auto-detect and parse one native share without side effects. Mini's optional
 * date override supports historical entry; otherwise the laptop's local date
 * is used and can be edited in the caller's preview.
 */
export function parseSharedResult(
  input: string,
  options: { miniDate?: string } = {},
): NormalizedGameCandidate {
  const text = normalizeSharedText(input);
  const game = detectSharedGame(text);

  switch (game) {
    case "connections":
      return parseConnections(text);
    case "mini":
      return parseMini(text, options.miniDate);
    case "bracket-city":
      return parseBracketCity(text);
    case "tagline":
      return parseTagline(text);
  }
}

/**
 * Preview and persist normalized game candidates in repository-owned JSON.
 * This is the ingestion engine's Node-only boundary: fixed game IDs select fixed
 * files, existing arrays are fully validated, duplicates require an explicit
 * replacement choice, and a same-directory temporary file is atomically renamed
 * into place. It never handles raw share text or writes outside game data.
 */
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { GameId } from "./contracts";
import {
  validateGameCandidate,
  type NormalizedGameCandidate,
} from "./ingestion";

type NormalizedRecord = NormalizedGameCandidate["record"];

export type GameSavePreview = {
  game: GameId;
  record: NormalizedRecord;
  targetFile: string;
  existingRecord?: NormalizedRecord;
};

const gameFiles: Record<GameId, { url: URL; repositoryPath: string }> = {
  connections: {
    url: new URL("./connections.json", import.meta.url),
    repositoryPath: "src/data/games/connections.json",
  },
  mini: {
    url: new URL("./mini.json", import.meta.url),
    repositoryPath: "src/data/games/mini.json",
  },
  "bracket-city": {
    url: new URL("./bracket-city.json", import.meta.url),
    repositoryPath: "src/data/games/bracket-city.json",
  },
  tagline: {
    url: new URL("./tagline.json", import.meta.url),
    repositoryPath: "src/data/games/tagline.json",
  },
};

/** Report both sides of a collision so the UI can request intentional replacement. */
export class DuplicateGameResultError extends Error {
  readonly preview: GameSavePreview;

  constructor(preview: GameSavePreview) {
    super(
      `A ${preview.game} result already exists for ${preview.record.date}; replacement must be explicitly requested.`,
    );
    this.name = "DuplicateGameResultError";
    this.preview = preview;
  }
}

/**
 * Read and validate one complete persisted array. Validation is strict and
 * preserves existing order errors rather than silently sorting or repairing the
 * source file before a proposed save.
 */
async function readPersistedResults(
  game: GameId,
): Promise<NormalizedRecord[]> {
  const { url, repositoryPath } = gameFiles[game];
  let input: unknown;

  try {
    input = JSON.parse(await readFile(url, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read valid JSON from ${repositoryPath}: ${detail}`,
      { cause: error },
    );
  }

  if (!Array.isArray(input)) {
    throw new Error(`${repositoryPath} must contain a top-level array.`);
  }

  const records: NormalizedRecord[] = [];
  let previousDate: string | undefined;

  input.forEach((value, index) => {
    let record: NormalizedRecord;
    try {
      record = validateGameCandidate(game, value).record;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Invalid persisted ${game} result at array position ${index}: ${detail}`,
        { cause: error },
      );
    }

    if (previousDate === record.date) {
      throw new Error(
        `Invalid persisted ${game} result at array position ${index}: date ${record.date} is duplicated.`,
      );
    }
    if (previousDate !== undefined && record.date < previousDate) {
      throw new Error(
        `Invalid persisted ${game} result at array position ${index}: date ${record.date} is earlier than ${previousDate}.`,
      );
    }

    records.push(record);
    previousDate = record.date;
  });

  return records;
}

/**
 * Return the exact schema-normalized record and target a save would use. This
 * read-only operation also exposes an existing same-day record for duplicate UI.
 */
export async function previewGameResult(
  game: GameId,
  input: unknown,
): Promise<GameSavePreview> {
  const candidate = validateGameCandidate(game, input);
  const records = await readPersistedResults(game);
  const existingRecord = records.find(
    (record) => record.date === candidate.record.date,
  );

  return {
    game,
    record: candidate.record,
    targetFile: gameFiles[game].repositoryPath,
    ...(existingRecord === undefined ? {} : { existingRecord }),
  };
}

/** Write complete JSON through a unique adjacent file, then replace atomically. */
async function replaceJsonFile(game: GameId, records: NormalizedRecord[]) {
  const targetUrl = gameFiles[game].url;
  const targetPath = fileURLToPath(targetUrl);
  const temporaryUrl = new URL(
    `./.${game}.${process.pid}.${randomUUID()}.tmp`,
    targetUrl,
  );

  try {
    await writeFile(temporaryUrl, `${JSON.stringify(records, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryUrl, targetPath);
  } catch (error) {
    await unlink(temporaryUrl).catch(() => undefined);
    throw new Error(
      `Could not safely replace ${gameFiles[game].repositoryPath}; its previous contents were preserved.`,
      { cause: error },
    );
  }
}

/**
 * Revalidate immediately before writing, reject an unapproved duplicate, and
 * persist the complete array in ascending date order. `replaceExisting` affects
 * only the same game/date pair shown by `previewGameResult`.
 */
export async function saveGameResult(
  game: GameId,
  input: unknown,
  options: { replaceExisting?: boolean } = {},
): Promise<GameSavePreview> {
  const records = await readPersistedResults(game);
  // The submitted value crosses the schema boundary after the last awaited read,
  // immediately before it can affect the replacement file.
  const candidate = validateGameCandidate(game, input);
  const duplicateIndex = records.findIndex(
    (record) => record.date === candidate.record.date,
  );
  const preview: GameSavePreview = {
    game,
    record: candidate.record,
    targetFile: gameFiles[game].repositoryPath,
    ...(duplicateIndex === -1
      ? {}
      : { existingRecord: records[duplicateIndex] }),
  };

  if (duplicateIndex !== -1 && options.replaceExisting !== true) {
    throw new DuplicateGameResultError(preview);
  }

  if (duplicateIndex === -1) {
    records.push(candidate.record);
  } else {
    records[duplicateIndex] = candidate.record;
  }
  records.sort((left, right) => left.date.localeCompare(right.date));

  await replaceJsonFile(game, records);
  return preview;
}

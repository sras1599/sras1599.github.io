/**
 * Expose read-before-write preview and explicit save operations to the local
 * ingestion page. This route is injected only by Astro's development command.
 * It requires same-origin JSON, accepts only an action, known game ID, schema
 * fields, and a replacement decision, then delegates all path derivation and
 * filesystem mutation to the Node-only persistence module.
 */
import type { APIRoute } from "astro";
import { gameIdSchema } from "../data/games/contracts";
import { CandidateValidationError } from "../data/games/ingestion";
import {
  DuplicateGameResultError,
  previewGameResult,
  saveGameResult,
} from "../data/games/persistence";

type RequestBody = {
  action?: unknown;
  game?: unknown;
  record?: unknown;
  replaceExisting?: unknown;
};

/** Return a consistent JSON response without exposing stack traces to the page. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Reject cross-origin calls before parsing their body. A browser request from
 * the injected admin page always supplies its exact development-server origin.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin !== null && origin === new URL(request.url).origin;
}

/** Preview or save one server-revalidated record within fixed game data files. */
export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) {
    return json({ error: "Game results accept same-origin development requests only." }, 403);
  }
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    return json({ error: "Expected an application/json request." }, 415);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: "The request body must be valid JSON." }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "The request body must be a JSON object." }, 400);
  }

  const allowedKeys = new Set(["action", "game", "record", "replaceExisting"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return json({ error: "The request contains an unknown field." }, 400);
  }

  if (body.action !== "preview" && body.action !== "save") {
    return json({ error: "Action must be preview or save." }, 400);
  }

  const parsedGame = gameIdSchema.safeParse(body.game);
  if (!parsedGame.success) {
    return json({ error: "Choose a known game." }, 400);
  }
  if (
    body.action === "save" &&
    body.replaceExisting !== undefined &&
    typeof body.replaceExisting !== "boolean"
  ) {
    return json({ error: "replaceExisting must be a boolean." }, 400);
  }

  try {
    const preview =
      body.action === "preview"
        ? await previewGameResult(parsedGame.data, body.record)
        : await saveGameResult(parsedGame.data, body.record, {
            replaceExisting: body.replaceExisting === true,
          });
    return json({ ok: true, preview });
  } catch (error) {
    if (error instanceof CandidateValidationError) {
      return json({ error: error.message, issues: error.issues }, 400);
    }
    if (error instanceof DuplicateGameResultError) {
      return json({ error: error.message, preview: error.preview }, 409);
    }

    const message = error instanceof Error ? error.message : "Could not process the result.";
    return json({ error: message }, 500);
  }
};

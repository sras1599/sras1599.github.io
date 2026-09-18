/**
 * Coordinate the browser half of the development ingestion workflow. Shared
 * parsers and schemas turn paste/manual input into one editable candidate; the
 * local endpoint previews persisted collisions and performs explicit saves. Raw
 * pasted text is cleared as soon as parsing succeeds and is never sent to or
 * retained by the server.
 */
import type { GameId } from "../data/games/contracts";
import {
  CandidateValidationError,
  parseSharedResult,
  validateGameCandidate,
  type NormalizedGameCandidate,
} from "../data/games/ingestion";

type RecordValue = NormalizedGameCandidate["record"];
type Preview = {
  game: GameId;
  record: RecordValue;
  targetFile: string;
  existingRecord?: RecordValue;
};
type ApiResult = {
  ok?: boolean;
  error?: string;
  issues?: Array<{ field: string; message: string }>;
  preview?: Preview;
};

const gameLabels: Record<GameId, string> = {
  connections: "Connections",
  mini: "Mini",
  "bracket-city": "Bracket City",
  tagline: "Tagline",
};

const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-mode-button]"));
const modePanels = Array.from(document.querySelectorAll<HTMLElement>("[data-mode-panel]"));
const pasteInput = document.querySelector<HTMLTextAreaElement>("#shared-result")!;
const parseError = document.querySelector<HTMLElement>("[data-parse-error]")!;
const manualGame = document.querySelector<HTMLSelectElement>("#manual-game")!;
const editor = document.querySelector<HTMLElement>("[data-editor]")!;
const recordForm = document.querySelector<HTMLFormElement>("[data-record-form]")!;
const gameInput = document.querySelector<HTMLInputElement>("#preview-game")!;
const dateInput = document.querySelector<HTMLInputElement>("#record-date")!;
const gameFields = document.querySelector<HTMLElement>("[data-game-fields]")!;
const previewError = document.querySelector<HTMLElement>("[data-preview-error]")!;
const duplicate = document.querySelector<HTMLElement>("[data-duplicate]")!;
const saveButton = document.querySelector<HTMLButtonElement>("[data-save]")!;
const replaceButton = document.querySelector<HTMLButtonElement>("[data-replace]")!;
const success = document.querySelector<HTMLElement>("[data-success]")!;

let activeGame: GameId | undefined;
let previewedRecord: RecordValue | undefined;
let previewRequest = 0;
let previewTimer: number | undefined;

/** Switch the segmented control without discarding either panel's draft input. */
function setMode(mode: "paste" | "manual") {
  modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.modeButton === mode));
  });
  modePanels.forEach((panel) => {
    panel.hidden = panel.dataset.modePanel !== mode;
  });
}

/** Supply local-calendar defaults while leaving game-specific values editable. */
function blankRecord(game: GameId): Record<string, unknown> {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  switch (game) {
    case "connections": return { date, mistakes: 0, solveOrder: [] };
    case "mini": return { date, durationSeconds: "" };
    case "bracket-city": return { date, score: "" };
    case "tagline": return { date, stars: "" };
  }
}

/** Render only the normalized fields owned by the selected game's schema. */
function renderGameFields(game: GameId, record: Record<string, unknown>) {
  if (game === "connections") {
    const order = Array.isArray(record.solveOrder) ? record.solveOrder : [];
    gameFields.innerHTML = `
      <div class="field">
        <label for="mistakes">Mistakes</label>
        <input id="mistakes" name="mistakes" type="number" min="0" max="4" step="1" required>
        <small data-field-error="mistakes"></small>
      </div>
      <fieldset>
        <legend>Solve order</legend>
        <div class="connection-order">
          ${Array.from({ length: 4 }, (_, index) => `
            <div>
              <label for="solve-order-${index}">${index + 1}</label>
              <select id="solve-order-${index}" name="solveOrder">
                <option value="">Not solved</option>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
              </select>
              <small data-field-error="solveOrder[${index}]"></small>
            </div>`).join("")}
        </div>
        <small data-field-error="solveOrder"></small>
      </fieldset>`;
    recordForm.querySelector<HTMLInputElement>("#mistakes")!.value = String(record.mistakes ?? "");
    recordForm.querySelectorAll<HTMLSelectElement>('[name="solveOrder"]').forEach((select, index) => {
      select.value = String(order[index] ?? "");
    });
    return;
  }

  const definitions = {
    mini: { name: "durationSeconds", label: "Duration (seconds)", min: 1, max: undefined },
    "bracket-city": { name: "score", label: "Score", min: 0, max: 100 },
    tagline: { name: "stars", label: "Stars", min: 1, max: 3 },
  } as const;
  const field = definitions[game];
  gameFields.innerHTML = `
    <div class="field">
      <label for="game-value">${field.label}</label>
      <input id="game-value" name="${field.name}" type="number" min="${field.min}"
        ${field.max === undefined ? "" : `max="${field.max}"`} step="1" required>
      <small data-field-error="${field.name}"></small>
    </div>`;
  recordForm.querySelector<HTMLInputElement>("#game-value")!.value = String(record[field.name] ?? "");
}

/** Populate the common editor used by both entry modes, then validate it. */
function showCandidate(game: GameId, record: RecordValue | Record<string, unknown>) {
  activeGame = game;
  gameInput.value = gameLabels[game];
  dateInput.value = String(record.date ?? "");
  renderGameFields(game, record as Record<string, unknown>);
  editor.hidden = false;
  success.hidden = true;
  void refreshPreview();
}

/** Convert native controls into the primitive record shape expected by Zod. */
function readRecord(): Record<string, unknown> {
  const record: Record<string, unknown> = { date: dateInput.value };
  if (activeGame === "connections") {
    const mistakes = recordForm.querySelector<HTMLInputElement>("#mistakes")!.value;
    record.mistakes = mistakes === "" ? undefined : Number(mistakes);
    record.solveOrder = Array.from(recordForm.querySelectorAll<HTMLSelectElement>('[name="solveOrder"]'))
      .map((select) => select.value)
      .filter(Boolean);
  } else {
    const input = recordForm.querySelector<HTMLInputElement>("#game-value")!;
    record[input.name] = input.value === "" ? undefined : Number(input.value);
  }
  return record;
}

/** Clear old inline messages, then attach authoritative schema issues to fields. */
function showIssues(issues: Array<{ field: string; message: string }>) {
  recordForm.querySelectorAll<HTMLElement>("[data-field-error]").forEach((element) => {
    element.textContent = "";
  });
  issues.forEach((issue) => {
    const target = recordForm.querySelector<HTMLElement>(`[data-field-error="${CSS.escape(issue.field)}"]`)
      ?? recordForm.querySelector<HTMLElement>(`[data-field-error="${CSS.escape(issue.field.split(".")[0])}"]`);
    if (target) target.textContent = issue.message;
  });
}

/** Call the development endpoint and preserve its structured error response. */
async function requestPreview(action: "preview" | "save", replaceExisting = false): Promise<ApiResult> {
  const response = await fetch("/admin/api/game-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, game: activeGame, record: previewedRecord, replaceExisting }),
  });
  const result = await response.json() as ApiResult;
  if (!response.ok && !result.error) result.error = `Request failed with status ${response.status}.`;
  return result;
}

/**
 * Validate in the browser, then ask the server for persisted duplicate state.
 * A sequence number prevents a slower prior response from enabling stale data.
 */
async function refreshPreview() {
  const requestNumber = ++previewRequest;
  saveButton.disabled = true;
  replaceButton.hidden = true;
  duplicate.hidden = true;
  previewError.hidden = true;
  previewedRecord = undefined;
  showIssues([]);
  if (!activeGame) return;

  try {
    previewedRecord = validateGameCandidate(activeGame, readRecord()).record;
  } catch (error) {
    if (error instanceof CandidateValidationError) showIssues(error.issues);
    else {
      previewError.textContent = error instanceof Error ? error.message : "Invalid result.";
      previewError.hidden = false;
    }
    return;
  }

  try {
    const result = await requestPreview("preview");
    if (requestNumber !== previewRequest) return;
    if (!result.ok || !result.preview) {
      showIssues(result.issues ?? []);
      previewError.textContent = result.error ?? "Could not preview the result.";
      previewError.hidden = false;
      return;
    }

    previewedRecord = result.preview.record;
    if (result.preview.existingRecord) {
      duplicate.querySelector<HTMLElement>("[data-existing-record]")!.textContent = JSON.stringify(result.preview.existingRecord, null, 2);
      duplicate.querySelector<HTMLElement>("[data-proposed-record]")!.textContent = JSON.stringify(result.preview.record, null, 2);
      duplicate.hidden = false;
      replaceButton.hidden = false;
    } else {
      saveButton.disabled = false;
    }
  } catch (error) {
    if (requestNumber !== previewRequest) return;
    previewError.textContent = error instanceof Error ? error.message : "Could not reach the local server.";
    previewError.hidden = false;
  }
}

/** Save the last server-previewed value, handling a race that creates a duplicate. */
async function save(replaceExisting: boolean) {
  if (!activeGame || !previewedRecord) return;
  saveButton.disabled = true;
  replaceButton.disabled = true;
  previewError.hidden = true;

  try {
    const result = await requestPreview("save", replaceExisting);
    if (!result.ok || !result.preview) {
      if (result.preview?.existingRecord) {
        duplicate.querySelector<HTMLElement>("[data-existing-record]")!.textContent = JSON.stringify(result.preview.existingRecord, null, 2);
        duplicate.querySelector<HTMLElement>("[data-proposed-record]")!.textContent = JSON.stringify(result.preview.record, null, 2);
        duplicate.hidden = false;
        replaceButton.hidden = false;
      }
      showIssues(result.issues ?? []);
      previewError.textContent = result.error ?? "Could not save the result.";
      previewError.hidden = false;
      return;
    }

    success.querySelector<HTMLElement>("[data-saved-record]")!.textContent = JSON.stringify(result.preview.record, null, 2);
    success.querySelector<HTMLElement>("[data-target-file]")!.textContent = result.preview.targetFile;
    success.hidden = false;
    editor.hidden = true;
    activeGame = undefined;
    previewedRecord = undefined;
    pasteInput.value = "";
    manualGame.value = "";
    setMode("paste");
  } catch (error) {
    previewError.textContent = error instanceof Error ? error.message : "Could not reach the local server.";
    previewError.hidden = false;
  } finally {
    replaceButton.disabled = false;
    if (success.hidden && duplicate.hidden && previewedRecord) {
      saveButton.disabled = false;
    }
  }
}

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.modeButton as "paste" | "manual")));
document.querySelector("[data-switch-manual]")!.addEventListener("click", () => setMode("manual"));
document.querySelector("[data-parse]")!.addEventListener("click", () => {
  parseError.hidden = true;
  try {
    const candidate = parseSharedResult(pasteInput.value);
    pasteInput.value = "";
    showCandidate(candidate.game, candidate.record);
  } catch (error) {
    parseError.querySelector("p")!.textContent = error instanceof Error ? error.message : "Could not parse the result.";
    parseError.hidden = false;
  }
});
manualGame.addEventListener("change", () => {
  if (!manualGame.value) {
    previewRequest += 1;
    editor.hidden = true;
    activeGame = undefined;
    previewedRecord = undefined;
    return;
  }
  showCandidate(manualGame.value as GameId, blankRecord(manualGame.value as GameId));
});
recordForm.addEventListener("input", () => {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => void refreshPreview(), 200);
});
saveButton.addEventListener("click", () => void save(false));
replaceButton.addEventListener("click", () => void save(true));

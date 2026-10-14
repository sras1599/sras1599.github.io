/**
 * Load and validate repository-owned game results for website consumers. The
 * loader imports the four static JSON arrays, validates every normalized record,
 * and enforces unique, strictly ascending dates before returning typed data
 * keyed by game ID. It is browser-safe and performs no filesystem mutation.
 */
import connectionsJson from "./connections.json";
import miniJson from "./mini.json";
import bracketCityJson from "./bracket-city.json";
import taglineJson from "./tagline.json";
import type { GameData } from "./contracts.ts";
import { validatePersistedResults } from "./validation.ts";

/** Return all persisted game results after validating their shared contract. */
export function loadGameData(): GameData {
  return {
    connections: validatePersistedResults("connections", connectionsJson),
    mini: validatePersistedResults("mini", miniJson),
    "bracket-city": validatePersistedResults("bracket-city", bracketCityJson),
    tagline: validatePersistedResults("tagline", taglineJson),
  };
}

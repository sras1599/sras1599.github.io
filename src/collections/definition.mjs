/**
 * Define the website-owned contract for vault collections. Definitions keep
 * entry validation, optional index validation, and public routes together while
 * remaining safe to import from Node scripts and Astro's content configuration.
 * Public routes are website-owned rather than authored by vault markers. The
 * helpers normalize canonical routes and entry slugs used by both the importer
 * and Astro route generation.
 */
import { z } from "zod";

export const collectionSlugPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/** Define all website-owned behavior for one vault collection. */
export function defineCollectionDefinition({
  id,
  route,
  indexSchema,
  metadataDefaults = { publish: false, preview: false },
  folderDefaultsSchema = z.object({}),
  entrySchema,
  contentSchema,
  projectEntry,
}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid collection ID ${id}`);
  }

  const normalizedRoute = normalizeCollectionRoute(route, {
    label: `route for collection ${id}`,
  });

  return {
    id,
    route: normalizedRoute,
    indexSchema,
    metadataDefaults,
    folderDefaultsSchema,
    entrySchema,
    contentSchema,
    projectEntry,
    markerSchema: z.strictObject({
      collection: z.literal(id),
      ...(indexSchema?.partial().shape ?? {}),
      ...folderDefaultsSchema.shape,
    }),
  };
}

export function createCollectionRegistry(definitions) {
  const registry = new Map();

  for (const definition of definitions) {
    if (registry.has(definition.id)) {
      throw new Error(`Duplicate collection definition ${definition.id}`);
    }
    registry.set(definition.id, definition);
  }

  return registry;
}

/** Validate the one canonical form accepted for a collection's root URL. */
export function normalizeCollectionRoute(route, { label = "route" } = {}) {
  if (typeof route !== "string" || !route.startsWith("/")) {
    throw new Error(`${label} must be an absolute URL path`);
  }
  if (route === "/") {
    throw new Error(`${label} must not be the site root /`);
  }
  if (route.includes("?") || route.includes("#")) {
    throw new Error(`${label} must not contain a query string or fragment`);
  }
  if (route.includes("\\") || route.includes("//")) {
    throw new Error(`${label} must not contain platform or repeated separators`);
  }
  if (route.endsWith("/")) {
    throw new Error(`${label} must not have a trailing separator`);
  }

  const segments = route.slice(1).split("/");
  if (
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        !/^[A-Za-z0-9._~-]+$/.test(segment),
    )
  ) {
    throw new Error(`${label} must be a normalized absolute URL path`);
  }

  return route;
}

export function normalizeCollectionSlug(slug, { label = "slug" } = {}) {
  if (typeof slug !== "string" || !collectionSlugPattern.test(slug)) {
    throw new Error(
      `${label} must contain lowercase letters, digits, and single hyphens in slash-separated segments`,
    );
  }

  return slug;
}

/** Construct URLs from a website-owned route and canonical entry slug. */
export function collectionEntryUrl(route, slug) {
  return `${normalizeCollectionRoute(route)}/${normalizeCollectionSlug(slug)}`;
}

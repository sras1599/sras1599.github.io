/**
 * Register local development-tool routes only while Astro is serving development.
 * The source pages deliberately live outside `src/pages`, so production route
 * discovery cannot emit admin HTML, prototype fixtures, or write endpoints. The
 * integration checks Astro's lifecycle command before injecting any route.
 */

/** Return the development-only route integration used by `astro.config.mjs`. */
export default function developmentAdmin() {
  return {
    name: "development-admin",
    hooks: {
      "astro:config:setup": ({ command, injectRoute }) => {
        if (command !== "dev") return;

        injectRoute({
          pattern: "/admin",
          entrypoint: new URL("./AdminIndex.astro", import.meta.url),
          prerender: false,
        });
        injectRoute({
          pattern: "/admin/ingest-game-data",
          entrypoint: new URL("./IngestGameData.astro", import.meta.url),
          prerender: false,
        });
        injectRoute({
          pattern: "/admin/game-showcase-prototypes",
          entrypoint: new URL("./GameShowcasePrototypes.astro", import.meta.url),
          prerender: false,
        });
        injectRoute({
          pattern: "/admin/api/game-result",
          entrypoint: new URL("./game-result.ts", import.meta.url),
          prerender: false,
        });
      },
    },
  };
}

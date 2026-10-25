/** List current vault and website page routes without generating files or starting Astro. */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { listVaultRoutes } from "./vault.mjs";

try {
  const { values } = parseArgs({
    options: {
      preview: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log("Usage: npm run routes -- [--preview]\n\nList published routes grouped by collection. --preview also includes writing-preview entries, labeled (preview).");
  } else {
    const routes = await listVaultRoutes({
      vaultPath: process.env.VAULT_PATH,
      projectRoot: fileURLToPath(new URL("../", import.meta.url)),
      preview: values.preview,
    });
    console.log(values.preview ? "Published and preview routes" : "Published routes");
    let previousCollection;
    for (const { collection, url, previewOnly } of routes) {
      if (collection !== previousCollection) {
        console.log(`\n${collection ?? "Standalone pages"}:`);
        previousCollection = collection;
      }
      console.log(`  ${url}${previewOnly ? " (preview)" : ""}`);
    }
    if (routes.length === 0) console.log("No routes found.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

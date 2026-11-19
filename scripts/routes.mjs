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
    console.log("Usage: npm run routes -- [--preview]\n\nList published routes grouped by collection, with published and preview counts per group and overall. --preview also includes writing-preview entries, labeled (preview). Counts include only listed routes.");
  } else {
    const routes = await listVaultRoutes({
      vaultPath: process.env.VAULT_PATH,
      projectRoot: fileURLToPath(new URL("../", import.meta.url)),
      preview: values.preview,
    });
    console.log(values.preview ? "Published and preview routes" : "Published routes");
    const groups = new Map();
    for (const { collection, url, previewOnly } of routes) {
      if (!groups.has(collection)) groups.set(collection, []);
      groups.get(collection).push({ url, previewOnly });
    }
    const formatCounts = (entries) => {
      const preview = entries.filter(({ previewOnly }) => previewOnly).length;
      return `(${entries.length - preview} published, ${preview} preview)`;
    };
    for (const [collection, entries] of groups) {
      console.log(`\n${collection ?? "Standalone pages"}: ${formatCounts(entries)}`);
      for (const { url, previewOnly } of entries) {
        console.log(`  ${url}${previewOnly ? " (preview)" : ""}`);
      }
    }
    if (routes.length === 0) console.log("No routes found.");
    console.log(`\nTotal: ${formatCounts(routes)}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import chokidar from "chokidar";
import { importVault } from "./vault.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const [mode, ...args] = process.argv.slice(2);
const development = mode === "dev" || mode === "writing";
const vaultPath = process.env.VAULT_PATH;
let child;
let server;
let watcher;
let timer;
let queue = Promise.resolve();
let resolveStopped;
const stopped = new Promise((resolve) => {
  resolveStopped = resolve;
});
const options = { vaultPath, projectRoot, preview: mode === "writing" };
async function refresh() {
  const result = await importVault(options);
  console.log(
    `Vault: ${result.posts} posts, ${result.assets} images${options.preview ? " (writing preview)" : ""}.`,
  );
}
function astro(command, extra = []) {
  return new Promise((resolve, reject) => {
    child = spawn(
      process.execPath,
      [
        path.join(projectRoot, "node_modules/astro/bin/astro.mjs"),
        command,
        ...extra,
      ],
      {
        cwd: projectRoot,
        stdio: "inherit",
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
function stop(signal) {
  clearTimeout(timer);
  child?.kill(signal);
  resolveStopped();
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
try {
  if (!["dev", "writing", "build"].includes(mode))
    throw new Error("Expected dev, writing, or build.");
  await refresh();
  if (development) {
    const normalizedArgs = args.map((arg, index) =>
      arg === "--host" && (!args[index + 1] || args[index + 1].startsWith("--"))
        ? "--host=0.0.0.0"
        : arg,
    );
    const { values } = parseArgs({
      args: normalizedArgs,
      options: {
        port: { type: "string" },
        host: { type: "string" },
        open: { type: "boolean" },
        mode: { type: "string" },
      },
    });
    const port = values.port === undefined ? undefined : Number(values.port);
    if (
      port !== undefined &&
      (!Number.isInteger(port) || port < 1 || port > 65535)
    )
      throw new Error("--port must be between 1 and 65535");
    watcher = chokidar.watch(path.resolve(vaultPath), {
      ignoreInitial: true,
      followSymlinks: false,
      ignored: (file) =>
        path
          .relative(path.resolve(vaultPath), file)
          .split(path.sep)
          .some((part) => part.startsWith(".")),
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });
    watcher.on("all", (_event, file) => {
      if (!/\.(md|png|jpe?g|gif|webp|avif|bmp)$/i.test(file)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        queue = queue
          .then(refresh)
          .catch((error) =>
            console.error(`Vault import failed: ${error.message}`),
          );
      }, 100);
    });
    await new Promise((resolve, reject) => {
      watcher.once("ready", resolve);
      watcher.once("error", reject);
    });
    await refresh();
    // Own the server lifecycle: the CLI can daemonize in agent environments,
    // which would otherwise stop our vault watcher while leaving Astro running.
    process.env.ASTRO_TELEMETRY_DISABLED = "1";
    const { dev } = await import("astro");
    server = await dev({
      root: projectRoot,
      mode: values.mode,
      server: {
        ...(port === undefined ? {} : { port }),
        ...(values.host === undefined ? {} : { host: values.host }),
        ...(values.open === undefined ? {} : { open: values.open }),
      },
    });
    console.log(`Website preview ready on port ${server.address.port}.`);
    await stopped;
  } else {
    const check = await astro("check");
    process.exitCode = check === 0 ? await astro("build", args) : check;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await watcher?.close();
  await queue;
  await server?.stop();
}

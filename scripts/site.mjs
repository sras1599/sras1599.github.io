/**
 * Run the website with content imported from the Obsidian vault in VAULT_PATH.
 * dotenv loads environment settings before startup; the first CLI argument selects
 * dev, writing, or build. The project root is resolved from this file's location.
 *
 * dev imports published notes and starts a local Astro server. writing follows the
 * same lifecycle but also imports preview notes. Both modes hold a project-level
 * lock, watch the vault, and queue imports when Markdown or supported images change.
 * Development flags --port, --host, --open, and --mode configure Astro's server;
 * --mode is Astro's environment mode, separate from this script's command.
 *
 * build imports published notes once, runs Astro's check command, and runs its
 * build command only if the check succeeds. Additional build arguments are passed
 * to Astro unchanged. Build subprocesses inherit terminal input and output.
 *
 * This module owns the lifecycle of the resources it starts: development shutdown
 * stops new refreshes, closes the watcher, drains queued imports, stops Astro, and
 * releases the lock. Build signals are forwarded to the active Astro subprocess.
 * Importing content writes generated website files; the source vault is read-only.
 * Startup and build failures set a nonzero exit code. Watch-triggered import errors
 * are reported without ending the development session, allowing the author to fix
 * the source and try again on the next change.
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import chokidar from "chokidar";
import { importVault } from "./vault.mjs";

try {
  await runSite();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

/**
 * Select the requested lifecycle and establish the import options it needs.
 * Development owns its imports and long-lived resources; builds import once and
 * propagate Astro's exit status. No server, watcher, or child process is shared
 * between the two paths.
 */
async function runSite() {
  const [command, ...args] = process.argv.slice(2);
  if (!["dev", "writing", "build"].includes(command)) {
    throw new Error("Expected dev, writing, or build.");
  }

  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const importOptions = {
    vaultPath: process.env.VAULT_PATH,
    projectRoot,
    preview: command === "writing",
  };

  if (command === "dev" || command === "writing") {
    await runDevelopment(importOptions, args);
    return;
  }

  await importAndReport(importOptions);

  const checkExitCode = await runAstroCommand(projectRoot, "check");
  if (checkExitCode !== 0) {
    process.exitCode = checkExitCode;
    return;
  }

  process.exitCode = await runAstroCommand(projectRoot, "build", args);
}

/**
 * Import using the caller's publishing mode and report selected entry and image
 * counts. Failures propagate: startup treats them as fatal, while the development
 * refresh queue reports them and remains available for subsequent changes.
 */
async function importAndReport(importOptions) {
  const result = await importVault(importOptions);
  const previewLabel = importOptions.preview ? " (writing preview)" : "";

  console.log(
    `Vault: ${result.entries} entries, ${result.assets} images${previewLabel}.`,
  );
}

/**
 * Hold the development lock and keep imports, the watcher, and Astro in one
 * lifecycle. All mutable resource handles stay here so the finally block can
 * release resources acquired before either a startup failure or a stop signal.
 * Refreshes run in sequence because each import synchronizes the same output.
 */
async function runDevelopment(importOptions, args) {
  const developmentOptions = parseDevelopmentOptions(args);
  let lockDirectory;
  let watcher;
  let server;
  let refreshTimer;
  let refreshQueue = Promise.resolve();
  let stopRequested = false;
  let resolveStopped;
  const stopped = new Promise((resolve) => {
    resolveStopped = resolve;
  });

  // Signals request shutdown; the finally block performs asynchronous cleanup.
  // The flag also prevents new watcher work while shutdown is draining the queue.
  function requestStop() {
    stopRequested = true;
    clearTimeout(refreshTimer);
    resolveStopped();
  }

  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);

  try {
    lockDirectory = await acquireDevelopmentLock(importOptions.projectRoot);
    if (stopRequested) return;

    await importAndReport(importOptions);
    if (stopRequested) return;

    const vaultRoot = path.resolve(importOptions.vaultPath);
    watcher = chokidar.watch(vaultRoot, {
      ignoreInitial: true,
      followSymlinks: false,
      ignored: (file) => {
        const segments = path.relative(vaultRoot, file).split(path.sep);
        return segments.some((segment) => segment.startsWith("."));
      },
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });

    // Wait for writes to settle, then debounce related file events for 100 ms.
    // Catch failures on each queued import so one invalid note cannot leave the
    // promise chain rejected and prevent later imports from running.
    watcher.on("all", (_event, file) => {
      if (stopRequested) return;
      if (!/\.(md|png|jpe?g|gif|webp|avif|bmp)$/i.test(file)) return;

      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshQueue = refreshQueue
          .then(() => importAndReport(importOptions))
          .catch((error) => {
            console.error(`Vault import failed: ${error.message}`);
          });
      }, 100);
    });

    await new Promise((resolve, reject) => {
      watcher.once("ready", resolve);
      watcher.once("error", reject);
    });
    if (stopRequested) return;

    // Import again after the watcher is ready to cover edits made during its
    // initial scan. Use the same queue as file events to avoid overlapping writes.
    refreshQueue = refreshQueue.then(() => importAndReport(importOptions));
    await refreshQueue;
    if (stopRequested) return;

    // Start Astro in this process so its lifetime stays tied to the vault watcher.
    // The CLI can daemonize in agent environments, leaving a server behind after
    // the process responsible for refreshing its content has stopped.
    process.env.ASTRO_TELEMETRY_DISABLED = "1";
    const { dev } = await import("astro");
    server = await dev({
      root: importOptions.projectRoot,
      ...developmentOptions,
    });

    console.log(`Website preview ready on port ${server.address.port}.`);
    await stopped;
  } finally {
    stopRequested = true;
    clearTimeout(refreshTimer);
    await watcher?.close();

    // Background errors have already been reported; a startup queue error is
    // already propagating out of the try block. Settle it here so that rejection
    // does not skip server shutdown or removal of the lock we acquired.
    await refreshQueue.catch(() => {});
    await server?.stop();

    if (lockDirectory) {
      await fs.rm(lockDirectory, { recursive: true, force: true });
    }

    process.off("SIGINT", requestStop);
    process.off("SIGTERM", requestStop);
  }
}

/**
 * Translate development CLI arguments into Astro's mode and server options.
 * A bare --host means all interfaces (0.0.0.0); --host localhost keeps its explicit
 * value. Validate the numeric port before starting resources and omit unspecified
 * server settings so Astro retains its own defaults.
 */
function parseDevelopmentOptions(args) {
  const normalizedArgs = args.map((arg, index) => {
    const nextArg = args[index + 1];
    if (arg === "--host" && (!nextArg || nextArg.startsWith("--"))) {
      return "--host=0.0.0.0";
    }

    return arg;
  });
  const { values } = parseArgs({
    args: normalizedArgs,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      open: { type: "boolean" },
      mode: { type: "string" },
    },
  });

  const server = {};
  if (values.port !== undefined) {
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("--port must be between 1 and 65535");
    }

    server.port = port;
  }

  if (values.host !== undefined) server.host = values.host;
  if (values.open !== undefined) server.open = values.open;

  return { mode: values.mode, server };
}

/**
 * Claim .astro/dev-server.lock and return its path only after recording our PID.
 * Creating the directory is the exclusive acquisition step. An existing live PID
 * prevents a second server; a PID confirmed absent permits one stale-lock retry.
 * Missing or invalid PID records and unexpected process-query errors fail rather
 * than allowing a second server to overwrite a lock whose ownership is uncertain.
 * The caller removes the returned directory when its development session ends.
 */
async function acquireDevelopmentLock(projectRoot) {
  const lockDirectory = path.join(projectRoot, ".astro/dev-server.lock");
  const pidFile = path.join(lockDirectory, "pid");
  await fs.mkdir(path.dirname(lockDirectory), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fs.mkdir(lockDirectory);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;

      const pid = Number(await fs.readFile(pidFile, "utf8"));
      if (!Number.isInteger(pid) || pid <= 0) {
        throw new Error(`Development lock has an invalid PID: ${pidFile}`);
      }

      // Signal zero checks process existence without asking that process to stop.
      // Only ESRCH establishes that the owner is gone; permission errors do not.
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;

        await fs.rm(lockDirectory, { recursive: true, force: true });
        continue;
      }

      throw new Error(
        `A development server is already running for this project (PID ${pid}). Stop it before starting another.`,
      );
    }

    // Once mkdir succeeds, this attempt owns the directory. If recording our PID
    // fails, remove that incomplete lock before propagating the write failure.
    try {
      await fs.writeFile(pidFile, String(process.pid));
    } catch (error) {
      await fs.rm(lockDirectory, { recursive: true, force: true });
      throw error;
    }

    return lockDirectory;
  }

  throw new Error("Could not acquire the development server lock.");
}

/**
 * Run one Astro CLI command and return its exit code, using 1 for signal exits.
 * The child inherits terminal streams and receives SIGINT/SIGTERM forwarded from
 * this process. Keep the child handle and signal handlers local to this command;
 * remove handlers when it exits or fails to start before another command runs.
 */
async function runAstroCommand(projectRoot, command, args = []) {
  const child = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/astro/bin/astro.mjs"),
      command,
      ...args,
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    },
  );
  const forwardInterrupt = () => child.kill("SIGINT");
  const forwardTerminate = () => child.kill("SIGTERM");
  process.on("SIGINT", forwardInterrupt);
  process.on("SIGTERM", forwardTerminate);

  try {
    return await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    process.off("SIGINT", forwardInterrupt);
    process.off("SIGTERM", forwardTerminate);
  }
}

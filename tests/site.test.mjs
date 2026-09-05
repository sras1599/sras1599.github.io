import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const note = (flag, slug, body) =>
  `---\n${flag}: true\ntitle: Synthetic\ndescription: Synthetic test\npublishDate: 2026-09-05\nslug: ${slug}\nprivate: SECRET_METADATA\n---\n${body}\n`;
async function eventually(check, output) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for site.\n${output()}`);
}
function command(mode, vault, args = []) {
  const child = spawn(process.execPath, ["scripts/site.mjs", mode, ...args], {
    cwd: root,
    env: { ...process.env, VAULT_PATH: vault },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code));
  });
  return { child, done, output: () => output };
}

test(
  "writing preview watches changes; production removes preview and private content",
  { timeout: 90000 },
  async (t) => {
    const vault = await fs.mkdtemp(path.join(os.tmpdir(), "site-vault-"));
    t.after(() => fs.rm(vault, { recursive: true, force: true }));
    const write = (file, contents) =>
      fs.writeFile(path.join(vault, file), contents);
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    );
    const imageUrl = (bytes) =>
      `/_vault/${createHash("sha256").update(bytes).digest("hex")}.png`;
    await write("pixel.png", image);
    await write(
      "published.md",
      note(
        "publish",
        "published",
        "FIRST_PUBLIC_TEXT\n\n![[pixel.png|100x80]]",
      ),
    );
    await write("preview.md", note("preview", "preview", "PREVIEW_SECRET"));
    await write("private.md", "PRIVATE_SECRET");
    await write("unused.png", "UNUSED_SECRET");
    const dev = command("writing", vault, [
      "--host",
      "127.0.0.1",
      "--port",
      "4389",
    ]);
    t.after(async () => {
      dev.child.kill("SIGTERM");
      await dev.done;
    });
    const get = async (route) => {
      const response = await fetch(`http://127.0.0.1:4389${route}`);
      return { status: response.status, text: await response.text() };
    };
    await eventually(
      async () => (await get("/blog/preview")).text.includes("PREVIEW_SECRET"),
      dev.output,
    );
    await eventually(
      async () => (await get("/blog/published")).text.includes(imageUrl(image)),
      dev.output,
    );
    const changedImage = Buffer.concat([image, Buffer.from("changed")]);
    await write("pixel.png", changedImage);
    await eventually(
      async () =>
        (await get("/blog/published")).text.includes(imageUrl(changedImage)),
      dev.output,
    );
    assert.equal((await get(imageUrl(changedImage))).status, 200);
    await write(
      "published.md",
      note("publish", "published", "UPDATED_PUBLIC_TEXT"),
    );
    await eventually(
      async () =>
        (await get("/blog/published")).text.includes("UPDATED_PUBLIC_TEXT"),
      dev.output,
    );
    await fs.rename(
      path.join(vault, "published.md"),
      path.join(vault, "moved.md"),
    );
    await eventually(
      async () =>
        (await get("/blog/published")).text.includes("UPDATED_PUBLIC_TEXT"),
      dev.output,
    );
    await write(
      "moved.md",
      note("publish", "published", "UPDATED_PUBLIC_TEXT").replace(
        "publish: true",
        "publish: false",
      ),
    );
    await eventually(
      async () => (await get("/blog/published")).status === 404,
      dev.output,
    );
    await write(
      "moved.md",
      note("publish", "published", "FINAL_PUBLIC_TEXT\n\n![pixel](pixel.png)"),
    );
    await eventually(
      async () =>
        (await get("/blog/published")).text.includes("FINAL_PUBLIC_TEXT"),
      dev.output,
    );
    dev.child.kill("SIGTERM");
    await dev.done;
    const build = command("build", vault);
    assert.equal(await build.done, 0, build.output());
    const html = await fs.readFile(
      path.join(root, "dist/blog/published/index.html"),
      "utf8",
    );
    assert.match(html, /FINAL_PUBLIC_TEXT/);
    assert.ok(html.includes(imageUrl(changedImage)));
    assert.deepEqual(
      await fs.readFile(path.join(root, "dist", imageUrl(changedImage))),
      changedImage,
    );
    async function files(dir) {
      const list = [];
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) list.push(...(await files(p)));
        else list.push(p);
      }
      return list;
    }
    for (const file of await files(path.join(root, "dist"))) {
      assert.doesNotMatch(
        await fs.readFile(file, "utf8"),
        /PREVIEW_SECRET|PRIVATE_SECRET|SECRET_METADATA|UNUSED_SECRET/,
        file,
      );
    }
    await assert.rejects(
      fs.access(path.join(root, "dist/blog/preview/index.html")),
    );
    await fs.unlink(path.join(vault, "moved.md"));
    const emptyBuild = command("build", vault);
    assert.equal(await emptyBuild.done, 0, emptyBuild.output());
    assert.match(
      await fs.readFile(path.join(root, "dist/blog/index.html"), "utf8"),
      /No posts yet/,
    );
    await assert.rejects(
      fs.access(path.join(root, "dist/blog/published/index.html")),
    );
    const emptyDev = command("dev", vault, [
      "--host",
      "127.0.0.1",
      "--port",
      "4389",
    ]);
    t.after(async () => {
      emptyDev.child.kill("SIGTERM");
      await emptyDev.done;
    });
    await eventually(
      async () => (await get("/blog")).text.includes("No posts yet"),
      emptyDev.output,
    );
    await write("first.md", note("publish", "first", "FIRST_AFTER_EMPTY"));
    await eventually(
      async () => (await get("/blog/first")).text.includes("FIRST_AFTER_EMPTY"),
      emptyDev.output,
    );
    await fs.unlink(path.join(vault, "first.md"));
    await eventually(
      async () => (await get("/blog/first")).status === 404,
      emptyDev.output,
    );
    emptyDev.child.kill("SIGTERM");
    await emptyDev.done;
  },
);

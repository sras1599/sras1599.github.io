import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { importVault } from "../scripts/vault.mjs";

const article = (slug, body = "Public article.", extra = "publish: true") =>
  `---\n${extra}\ntitle: Example\ndescription: Example description\nslug: ${slug}\npublishDate: 2026-09-05\nprivateProperty: SECRET_METADATA\n---\n${body}\n`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vault-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const vaultPath = path.join(root, "vault");
  const projectRoot = path.join(root, "site");
  await fs.mkdir(vaultPath);
  const write = async (name, text) => {
    const file = path.join(vaultPath, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  };
  return {
    vaultPath,
    projectRoot,
    write,
    run: (preview = false) => importVault({ vaultPath, projectRoot, preview }),
    read: (name) =>
      fs.readFile(
        path.join(projectRoot, ".generated/blog", `${name}.md`),
        "utf8",
      ),
    posts: () => fs.readdir(path.join(projectRoot, ".generated/blog")),
    assets: () => fs.readdir(path.join(projectRoot, "public/_vault")),
  };
}

test("explicit selection, private metadata removal, preview isolation, empty output", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.run(), { posts: 0, assets: 0 });
  await f.write("public.md", article("public"));
  await f.write(
    "preview.md",
    article("preview", "Preview content", "preview: true"),
  );
  await f.write(
    "string.md",
    article("string", "SECRET_STRING", 'publish: "true"'),
  );
  await f.write("private.md", "SECRET_BODY");
  await f.write(".hidden/post.md", article("hidden"));
  await fs.symlink(
    path.join(f.vaultPath, "public.md"),
    path.join(f.vaultPath, "symlink.md"),
  );
  assert.equal((await f.run()).posts, 1);
  assert.doesNotMatch(await f.read("public"), /SECRET|publish:|preview:/);
  assert.equal((await f.run(true)).posts, 2);
  assert.equal((await f.run()).posts, 1);
  assert.deepEqual(await f.posts(), ["public.md"]);
});

test("links, aliases, headings, reference links, images and private links", async (t) => {
  const f = await fixture(t);
  await f.write("Folder/Other.md", article("other", "## My heading"));
  await f.write("Private.md", "SECRET_BODY");
  await f.write("assets/pixel.png", png);
  await f.write("assets/unused.png", "SECRET_ASSET");
  await f.write(
    "Folder/Source.md",
    article(
      "source",
      `[[Other#My heading|Read more]] [[Private|Private label]]\n\n[other](Other.md#my-heading) [private](../Private.md)\n\n![[pixel.png|120x80]] ![pixel](../assets/pixel.png)\n\n[reference][other]\n\n[other]: Other.md\n\n![external](https://example.com/test.png)`,
    ),
  );
  assert.deepEqual(await f.run(), { posts: 2, assets: 1 });
  const content = await f.read("source");
  assert.match(content, /\[Read more\]\(\/blog\/other#my-heading\)/);
  assert.match(content, /\[reference\]\(\/blog\/other\)/);
  assert.match(content, /width="120" height="80"/);
  assert.match(content, /https:\/\/example.com\/test.png/);
  assert.doesNotMatch(content, /Private\.md|SECRET|\[Private label\]/);
  assert.match(content, /Private label/);
});

test("renaming preserves slug; unpublishing and deleting clear output and assets", async (t) => {
  const f = await fixture(t);
  await f.write("a.md", article("stable", "![[pixel.png]]"));
  await f.write("pixel.png", png);
  await f.run();
  await fs.rename(
    path.join(f.vaultPath, "a.md"),
    path.join(f.vaultPath, "renamed.md"),
  );
  await f.run();
  assert.deepEqual(await f.posts(), ["stable.md"]);
  await f.write(
    "renamed.md",
    article("stable", "![[pixel.png]]", "publish: false"),
  );
  await f.run();
  assert.deepEqual(await f.posts(), []);
  assert.deepEqual(await f.assets(), []);
  await f.write("renamed.md", article("stable"));
  await f.run();
  await fs.unlink(path.join(f.vaultPath, "renamed.md"));
  await f.run();
  assert.deepEqual(await f.posts(), []);
});

test("metadata errors and duplicate slugs fail without altering the last import", async (t) => {
  const f = await fixture(t);
  await f.write("a.md", article("valid"));
  await f.run();
  for (const invalid of [
    article("UPPER"),
    article("valid").replace("title: Example", "title: []"),
    article("valid").replace("2026-09-05", "2026-02-30"),
  ]) {
    await f.write("a.md", invalid);
    await assert.rejects(f.run());
    assert.deepEqual(await f.posts(), ["valid.md"]);
  }
  await f.write("a.md", article("valid"));
  await f.write("b.md", article("valid"));
  await assert.rejects(f.run(), /duplicate slug/);
});

test("missing or ambiguous references and unsupported Obsidian syntax fail", async (t) => {
  const f = await fixture(t);
  await f.write("one/Other.md", "private");
  await f.write("two/Other.md", "private");
  for (const [body, error] of [
    ["[[Missing]]", /missing reference/],
    ["[[Other]]", /ambiguous reference/],
    ["![[Other]]", /transclusions/],
    ["[[one\/Other#^block]]", /block references/],
    ["```dataview\nLIST\n```", /dynamic plugin/],
    ["`= this.file.name`", /Dataview/],
    ["<% tp.date.now() %>", /dynamic plugin|HTML/],
    ["![](http://example.com/a.png)", /HTTPS/],
  ]) {
    await f.write("a.md", article("test", body));
    await assert.rejects(f.run(), error);
  }
});

test("code examples are preserved and vault paths must exist", async (t) => {
  const f = await fixture(t);
  await f.write(
    "a.md",
    article("code", "`[[Missing]]`\n\n```md\n![[Missing]]\n```"),
  );
  await f.run();
  assert.match(await f.read("code"), /\[\[Missing\]\]/);
  await assert.rejects(
    importVault({ projectRoot: f.projectRoot }),
    /VAULT_PATH/,
  );
  await assert.rejects(
    importVault({
      vaultPath: path.join(f.vaultPath, "missing"),
      projectRoot: f.projectRoot,
    }),
    /Cannot read/,
  );
});

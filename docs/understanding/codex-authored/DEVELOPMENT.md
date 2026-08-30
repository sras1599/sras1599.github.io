# Local development

This document explains how to prepare a machine, run the website, verify a change, and inspect the production build locally.

## Prerequisites

Install the following before cloning the repository:

- Git
- Node.js `22.12.0` or newer
- npm `9.6.5` or newer

Astro 7.1.3 declares those minimum Node.js and npm versions. Node.js 22 is the best default for this project because the GitHub Actions workflow also uses Node.js 22. Matching CI reduces the chance that code works locally but fails during deployment.

Check the installed versions:

```sh
git --version
node --version
npm --version
```

A Node version manager such as `nvm`, `fnm`, or `mise` is optional but helpful when working across projects that require different Node versions.

## First-time setup

Clone the repository and enter it:

```sh
git clone git@github.com:sras1599/sras1599.github.io.git
cd sras1599.github.io
```

Install the exact dependency tree recorded in `package-lock.json`:

```sh
npm ci
```

Use `npm ci` for a clean checkout and in automation. It removes inconsistencies between `node_modules/` and the lockfile and does not rewrite dependency versions. Use `npm install` when intentionally adding, removing, or updating packages.

Confirm that the project is healthy:

```sh
npm run build
```

A successful build reports no Astro diagnostics and writes the generated website to `dist/`.

## Day-to-day development

Start Astro's development server:

```sh
npm run dev
```

Astro normally prints a local address such as:

```text
http://localhost:4321/
```

Open that address in a browser. The development server watches the source tree and updates the page after saved changes. Stop it with `Ctrl+C`.

The normal edit loop is:

1. Start `npm run dev` and leave it running.
2. Edit a file under `src/`.
3. Inspect the browser and terminal output.
4. Check both a wide and narrow browser viewport for visual changes.
5. Run `npm run build` before considering the work finished.

If port 4321 is occupied, Astro will normally select another port and print it. To require a particular port, pass an argument through the npm script:

```sh
npm run dev -- --port 4322
```

To make the development server reachable from another device on the same network:

```sh
npm run dev -- --host
```

Treat that as temporary development access, not internet-facing hosting.

## Development server versus local production preview

The development server prioritizes quick feedback. A production preview serves the output produced by the actual build.

Use this sequence to test the deployable result:

```sh
npm run build
npm run preview
```

`npm run preview` does not rebuild the site. If source files change, run `npm run build` again before previewing them.

This is sometimes informally called a “local deployment,” but technically it is a **local production preview**. It verifies the generated website without publishing anything. The preview server itself is not designed to host the public site.

Check at least these routes in preview:

- `/`
- `/blog`
- `/blog/hello-world`

Also check navigation, outbound links, browser console errors, and the narrow-screen layout.

## What each npm command does

### `npm run dev`

Runs `astro dev` with Astro telemetry disabled. It starts the local development server and serves source changes quickly.

### `npm run build`

Runs two commands in order:

1. `astro check` validates Astro files and reports type/content problems.
2. `astro build` generates the static production site in `dist/`.

Because checking is part of the build script, the same command provides the main pre-deployment quality gate locally and in GitHub Actions.

### `npm run preview`

Runs `astro preview` and serves the existing `dist/` directory locally. It is the closest local approximation of what GitHub Pages will serve.

## Working with blog posts

Create a Markdown file under `src/content/blog/`. Its filename becomes the default post identifier and therefore its URL segment.

For example:

```text
src/content/blog/learning-astro.md
                         |
                         +--> /blog/learning-astro
```

Use metadata that matches `src/content.config.ts`:

```md
---
title: "Learning Astro"
description: "What I learned while building my website."
publishDate: 2026-07-24
tags: ["astro", "learning"]
draft: true
---

Post content begins here.
```

Posts with `draft: true` are filtered out of both the blog index and generated post routes. Change it to `false` when the post is ready to publish.

Run `npm run build` after adding a post. This catches invalid or missing frontmatter and confirms that its route can be generated.

## Adding dependencies

Do not edit `node_modules/` directly. To add a runtime or build dependency, use:

```sh
npm install <package-name>
```

This updates both `package.json` and `package-lock.json`. Commit both changes together.

Before adding a package, establish:

- what problem it solves;
- whether Astro or the browser already provides the capability;
- whether it adds client-side JavaScript;
- whether it requires an Astro integration or configuration change;
- how actively it is maintained.

## Generated and ignored files

The following directories should not be edited or committed:

- `node_modules/` — locally installed dependencies;
- `.astro/` — Astro-generated cache and type data;
- `dist/` — generated production output.

The source of truth is the committed configuration and the files under `src/` and `public/`. A clean machine can recreate the ignored directories with `npm ci` and `npm run build`.

Files under `public/` are different: they are source files committed to Git and copied unchanged into `dist/`.

## Environment variables

The repository currently requires no application secrets or runtime environment variables. `.env` files are ignored in preparation for future local configuration.

If environment variables are introduced later:

- never commit secrets;
- document every required variable without recording its secret value;
- distinguish build-time variables from browser-visible variables;
- assume anything deliberately exposed to browser code is public.

## Before pushing a change

Use this checklist:

```sh
git status
npm run build
```

Then review what changed:

```sh
git diff
```

Confirm that:

- the build has zero errors;
- intended pages work in development or preview;
- unrelated generated files are not staged;
- no secrets or `.env` files are staged;
- `package-lock.json` changed only when dependencies changed;
- new blog posts have the intended `draft` value.

There are currently no separate test, lint, or formatting scripts. `npm run build` is the project's automated local check.

## Common problems

### `astro: command not found`

Run `npm ci`. The npm scripts expect Astro to be installed locally in `node_modules/`.

### Unsupported Node.js version

Switch to Node.js 22 or another version satisfying Astro's declared minimum, reinstall dependencies with `npm ci`, and build again.

### A post is absent from the blog

Check that:

- it is under `src/content/blog/`;
- its extension is `.md` or `.mdx`;
- its frontmatter passes the content schema;
- `draft` is `false`;
- the development server or build output shows no content error.

### Preview does not show the latest edit

Run `npm run build` again. Preview serves `dist/`, not the live source files.

### Local development works but deployment fails

Read the failed GitHub Actions step first. Then reproduce its important commands locally with the same major Node version:

```sh
npm ci
npm run build
```

See [Deployment.md](./Deployment.md) for the workflow and GitHub Pages setup.


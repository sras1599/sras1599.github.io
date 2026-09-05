# Project guide

This document is the map of the repository: what the website is, which technologies it uses, and where a change belongs. For practical workflows, continue with [DEVELOPMENT.md](./DEVELOPMENT.md), [Astro.md](./Astro.md), and [Deployment.md](./Deployment.md).

## What this project is

This repository builds the personal website published at `https://rasmalai.dev`. It contains a homepage and a Markdown-backed blog.

The site is **statically generated**. Astro reads the source files during a build and writes ready-to-serve HTML, CSS, and other assets to `dist/`. A visitor does not cause application code to run on a server; GitHub Pages serves the files that were generated earlier.

```text
Astro pages + Markdown posts + shared styles
                       |
                  npm run build
                       |
                    dist/
                       |
                  GitHub Pages
                       |
                https://rasmalai.dev
```

## Repository structure

```text
personal-website/
├── .github/workflows/
│   └── deploy.yml             Build and deployment automation
├── docs/understanding/
│   └── codex-authored/        Documentation written by Codex
├── public/
│   └── CNAME                  Custom-domain file copied to the build
├── .generated/blog/          Disposable imported posts (gitignored)
├── scripts/                  Vault import, content loader, and commands
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro   Shared document shell and navigation
│   ├── pages/                 Route-producing Astro files
│   │   ├── index.astro        /
│   │   └── blog/
│   │       ├── index.astro    /blog
│   │       └── [slug].astro   One generated route per blog post
│   ├── styles/
│   │   └── global.css         Site-wide styling
│   └── content.config.ts      Blog collection and metadata schema
├── astro.config.mjs           Astro's project-level configuration
├── package.json               Dependencies and developer commands
├── package-lock.json          Exact dependency resolution
├── tsconfig.json              Astro/TypeScript checking configuration
└── README.md                  Quick start and documentation links
```

Other top-level directories are not part of the running website:
- `bin/` and `completions/` contain a repository utility and its shell completion.
- `node_modules/`, `.astro/`, and `dist/` are generated locally and ignored by Git.

## Technologies and their responsibilities

### Astro

Astro is the site's web framework and static-site generator. It provides:

- file-based routing through `src/pages/`;
- `.astro` components and layouts;
- build-time data processing;
- Markdown rendering and content collections;
- development and production build commands;
- optimized static output.

Astro is the main technology to understand when changing the site's structure. See [Astro.md](./Astro.md).

### Node.js and npm

Node.js is the environment in which Astro and the build tools run. It is a development/build requirement, not a server used by the deployed website.

npm performs two jobs:

1. It installs the packages declared in `package.json`.
2. It runs the named scripts such as `npm run dev` and `npm run build`.

`package-lock.json` records the full, exact dependency tree. It makes local and CI installations reproducible and should be committed when dependency changes are intentional.

### Markdown and Astro content collections

Blog bodies live in the private Obsidian vault. The importer selects notes with `publish: true` and writes disposable Markdown under `.generated/blog/`. Metadata includes title, description, publication date, tags, and a stable slug.

`src/content.config.ts` defines the `blog` collection and validates that metadata. This prevents an incomplete or incorrectly shaped post from silently reaching production.

### TypeScript and Astro Check

TypeScript supplies static checking for configuration, content data, component props, and build-time code. `@astrojs/check` validates `.astro` files as part of `npm run build`.

TypeScript is supporting infrastructure here; it is not a separate application layer. The project extends Astro's strict configuration so mistakes are reported early.

### Vite

Astro uses Vite internally for its development server, module loading, and production build. Seeing `[vite]` in Astro's terminal output is normal.

There is no standalone Vite application or Vite configuration in this repository. Usually, project work should go through Astro's commands rather than invoking Vite directly.

### Git, GitHub Actions, and GitHub Pages

- Git records source history.
- GitHub hosts the repository.
- GitHub Actions runs the build workflow after changes reach `main`.
- GitHub Pages hosts the generated files.

The deployment process is documented in [Deployment.md](./Deployment.md).

### Google Fonts

`BaseLayout.astro` links to font files hosted by Google Fonts. Unlike the rest of the site's static assets, those fonts are fetched from Google's servers by the visitor's browser. If the site later needs to avoid that external dependency, the fonts can be self-hosted under `public/`.

## How a request becomes a page

Consider a request for `/blog/hello-world`:

1. During the build, the importer generates `.generated/blog/hello-world.md` from a selected vault note with `slug: hello-world`, and Astro loads it through the `blog` content collection.
2. The content schema validates the post's frontmatter.
3. `src/pages/blog/[slug].astro` includes the post in `getStaticPaths()`.
4. Astro renders the post body and inserts it into the page template.
5. The page uses `BaseLayout.astro` for shared metadata and navigation.
6. Astro writes the resulting static page into `dist/`.
7. GitHub Pages later serves that generated page to the browser.

There is no database lookup or server rendering when the reader opens the page.

## Where to make common changes

| Goal | Primary location |
|---|---|
| Change homepage content or sections | `src/pages/index.astro` |
| Change navigation, document metadata, or shared shell | `src/layouts/BaseLayout.astro` |
| Change the site's appearance | `src/styles/global.css` |
| Add a blog post | A selected `.md` note in the Obsidian vault |
| Change required blog metadata | `scripts/vault.mjs` and `src/content.config.ts` |
| Change blog listing behavior | `src/pages/blog/index.astro` |
| Change individual post presentation | `src/pages/blog/[slug].astro` |
| Add a new route | Add an `.astro` file under `src/pages/` |
| Add an unprocessed public file | `public/` |
| Change build-wide Astro behavior | `astro.config.mjs` |
| Change CI deployment | `.github/workflows/deploy.yml` |
| Add or update a package | `package.json` via an npm command |

## Deliberately absent technologies

The current site does not use Svelte, React, Vue, a database, an API server, or a content management system. It also has no client-side application entry point.

That is useful context when considering a new dependency: first ask whether Astro, an Astro component, or a small browser script can solve the problem. A UI framework is worth adding when its state-management and interactivity provide a concrete benefit, not simply because Astro supports integrations.

## Configuration snapshot

`astro.config.mjs` currently declares:

- `site: "https://rasmalai.dev"` — the canonical production origin Astro can use when creating absolute URLs;
- `output: "static"` — generate files ahead of time;
- `trailingSlash: "never"` — use canonical URLs without trailing slashes.

`package.json` contains three supported workflows:

- `npm run dev` — local development server;
- `npm run build` — check the project and create `dist/`;
- `npm run preview` — serve the contents of the production build locally.

Those workflows are described in [DEVELOPMENT.md](./DEVELOPMENT.md).


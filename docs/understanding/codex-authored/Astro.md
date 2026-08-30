# Astro overview

Astro is the framework that organizes and builds this website. This document focuses on the Astro concepts needed to work independently in this repository.

## Why Astro fits this site

The website is primarily pages, project information, and articles. Most of that content does not require JavaScript after it reaches the browser.

Astro is a good fit because it:

- generates static pages ahead of time;
- provides routing based on the filesystem;
- supports layouts and reusable components;
- treats Markdown as a first-class content source;
- sends no component JavaScript to the browser by default;
- can add interactive components later without turning the entire site into a client-side application.

The default “no client JavaScript” behavior is important. Astro can use JavaScript to assemble a page during the build while delivering ordinary static output to the reader.

## The two parts of an Astro component

An `.astro` file usually has a component script and a template:

```astro
---
const greeting = "Hello";
---

<h1>{greeting}, Raspreet</h1>
```

The code between the `---` fences runs in Astro's build/server environment. It can import other components, read content, create arrays, and prepare values for the template.

The template below the fence defines the rendered page or component. Expressions inside braces insert prepared values or generate repeated markup.

For this static project, frontmatter code runs while developing or building the website—not in the visitor's browser.

## Pages and file-based routing

Astro turns supported files under `src/pages/` into routes:

```text
src/pages/index.astro             -> /
src/pages/blog/index.astro        -> /blog
src/pages/blog/[slug].astro       -> /blog/<slug>
```

Directories become URL segments, `index.astro` represents the directory itself, and a bracketed name represents a dynamic parameter.

To add a static `/about` page, create:

```text
src/pages/about.astro
```

No separate routing table is necessary.

## Dynamic routes in a static site

`[slug].astro` describes a family of URLs, but a static build must know every member of that family ahead of time. `getStaticPaths()` supplies them.

The blog route performs this process:

```astro
export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);

  return posts.map((post) => ({
    params: { slug: post.id.replace(/\.mdx?$/, "") },
    props: { post }
  }));
}
```

For each non-draft post:

- `params.slug` determines the URL;
- `props.post` supplies the post to the page template.

If the collection contains `hello-world.md`, Astro generates `/blog/hello-world`. A new published Markdown file automatically adds another route at the next build.

## Layouts, components, props, and slots

Astro does not assign special behavior to `src/layouts/`; it is a project convention for components that wrap whole pages.

`BaseLayout.astro` receives optional values through `Astro.props`:

```astro
---
const { title, description } = Astro.props;
---
```

A page passes those props when it uses the layout:

```astro
<BaseLayout title="Blog" description="Writing by Raspreet Singh.">
  <main>...</main>
</BaseLayout>
```

The layout's `<slot />` marks where the nested page content should be inserted. The result is one rendered document containing both the shared layout and the page-specific content.

An Astro component is created the same way. For example, a repeated project card could be moved to `src/components/ProjectCard.astro`, receive project details through props, and be imported by the homepage.

Extract a component when it provides at least one of these benefits:

- reuse in multiple places;
- a meaningful boundary with its own responsibility;
- a large page becomes easier to understand;
- repeated markup can be kept consistent.

Avoid splitting every small element into a component. The goal is clearer ownership, not the largest possible number of files.

## Content collections

Astro content collections turn a directory of content files into validated, queryable data.

The project declares a collection named `blog` in `src/content.config.ts`. Its loader finds Markdown and MDX files under `src/content/blog/`, and its schema describes valid post metadata.

The collection is consumed in two ways:

```astro
const posts = await getCollection("blog");
```

loads entries and their metadata, while:

```astro
const { Content } = await render(post);
```

converts one entry's body into a component that can be placed in the page:

```astro
<Content />
```

The current pages filter out drafts in both the index and `getStaticPaths()`. Doing it in both places matters: a draft should be absent from the listing and should not have a publicly generated route.

## Build-time versus browser-time code

This distinction explains much of Astro:

| Build-time code | Browser-time code |
|---|---|
| Runs under Node.js/Astro | Runs on a visitor's device |
| Can load content collections | Can respond to clicks and browser events |
| Produces static output | Can change an already loaded page |
| Does not automatically ship to visitors | Adds bytes and execution work for visitors |

The arrays, sorting, `map()` calls, `getCollection()`, and `render()` calls in the current `.astro` pages are build-time work.

The site currently has no meaningful browser-side application code. Links, anchor navigation, and responsive presentation work through browser-native behavior and CSS.

## Astro islands and future interactivity

Astro can embed components from UI frameworks such as React, Svelte, or Vue. Astro calls its selective-interactivity approach **islands architecture**: only interactive regions are hydrated, while the rest remains static.

A framework component does not become interactive merely because it is imported. A `client:*` directive tells Astro when to send and activate its JavaScript, for example:

```astro
<InteractiveGame client:visible />
```

Common directives include:

- `client:load` — hydrate as soon as the page loads;
- `client:idle` — hydrate when the browser has idle time;
- `client:visible` — hydrate when the component approaches the viewport;
- `client:media` — hydrate when a media query matches;
- `client:only` — render only in the browser.

This project currently has no UI-framework integration and needs none for its existing pages. If interactivity is added, first decide whether a small native `<script>` is sufficient. Add a framework when the interactive feature genuinely benefits from one.

## Styling and assets in Astro

The shared layout imports the global stylesheet:

```astro
import "../styles/global.css";
```

Because every current page uses that layout, the stylesheet applies across the site.

Astro components can also contain scoped `<style>` blocks. Astro scopes those rules to the component by default, which is useful for styles owned by one component. This project currently keeps its visual system in one global stylesheet, which is reasonable at its present size.

Use `public/` for files that should be copied without processing and addressed from the site root. For example:

```text
public/favicon.svg -> /favicon.svg
```

Source assets that should be imported and processed by Astro can instead live under `src/`.

## Important Astro configuration

The project config is `astro.config.mjs`:

```js
export default defineConfig({
  site: "https://rasmalai.dev",
  output: "static",
  trailingSlash: "never"
});
```

- `site` identifies the production origin. Astro can use it when an absolute canonical URL is needed.
- `output: "static"` makes the build pre-render every route.
- `trailingSlash: "never"` establishes the preferred URL style.

There is no deployment adapter because GitHub Pages only needs static files. Server output would require a host-specific adapter and would change the site's architecture.

## The Astro build lifecycle in this repository

When `npm run build` runs:

1. `astro check` analyzes the Astro project.
2. Astro loads `astro.config.mjs` and `src/content.config.ts`.
3. Content entries are discovered and validated.
4. Static and dynamic page routes are collected.
5. Component frontmatter and templates are rendered.
6. Styles and assets are processed through Astro's Vite-based build pipeline.
7. Static output is written to `dist/`.

`dist/` is disposable output, not authored source. Fix source files rather than editing the generated result.

## Practical change recipes

### Add a page

1. Add an `.astro` file under `src/pages/` at the desired route.
2. Import and use `BaseLayout`.
3. Supply a useful title and description.
4. Add navigation only if the page belongs in primary navigation.
5. Run `npm run build` and visit the route in preview.

### Add a blog post

1. Add a `.md` file under `src/content/blog/`.
2. Include metadata matching the collection schema.
3. Draft with `draft: true`.
4. Set `draft: false` when ready.
5. Build and verify both the listing and post route.

### Add a reusable Astro component

1. Create `src/components/Name.astro`.
2. Define and read its props in the frontmatter.
3. Put its rendered template below the frontmatter.
4. Import it into a page, layout, or another component.
5. Keep data ownership in the clearest parent instead of duplicating it.

## Further reading

- [Astro project structure](https://docs.astro.build/en/basics/project-structure/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Pages and routing](https://docs.astro.build/en/basics/astro-pages/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Islands architecture](https://docs.astro.build/en/concepts/islands/)


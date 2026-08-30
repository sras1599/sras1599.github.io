# Deployment to GitHub Pages

This document explains how the site is built and published, what GitHub must be configured to do, and how to diagnose a failed deployment.

## Deployment architecture

The production site uses GitHub Actions for continuous deployment and GitHub Pages for static hosting.

```text
Push or merge to main
          |
          v
GitHub Actions: build job
  - check out repository
  - install Node.js and packages
  - run Astro build
  - upload dist/ artifact
          |
          v
GitHub Actions: deploy job
  - publish artifact to Pages
          |
          v
GitHub Pages + custom domain
          |
          v
  https://rasmalai.dev
```

This is a static deployment. GitHub Pages never runs Astro or Node.js for a visitor. Those tools run in GitHub Actions before the generated files are published.

## The workflow file

The automation is defined in `.github/workflows/deploy.yml`.

### Triggers

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

The workflow runs:

- automatically after a push reaches `main`;
- manually when someone selects **Run workflow** in GitHub's Actions interface.

A pull request does not deploy merely because it is opened. Once it is merged to `main`, the resulting push triggers deployment.

### Permissions

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

The workflow receives only the capabilities it needs:

- `contents: read` allows it to check out repository content;
- `pages: write` allows a Pages deployment;
- `id-token: write` supports GitHub's identity-token-based deployment authorization.

These are workflow permissions, not website runtime permissions.

### Concurrency

```yaml
concurrency:
  group: pages
  cancel-in-progress: false
```

The `pages` group prevents multiple deployments from racing each other. With `cancel-in-progress: false`, an active deployment is allowed to finish rather than being cancelled when a newer run starts.

### Build job

The `build` job runs on a fresh Ubuntu runner and performs these steps:

1. `actions/checkout@v4` downloads the repository into the runner.
2. `actions/setup-node@v4` installs Node.js 22 and enables npm caching.
3. `npm ci` installs exactly what `package-lock.json` describes.
4. `npm run build` checks the project and generates `dist/`.
5. `actions/upload-pages-artifact@v3` packages `dist/` for Pages.

The npm cache can make dependency installation faster, but `node_modules/` itself is not deployed. Only the generated `dist/` artifact moves to the deployment job.

### Deploy job

The `deploy` job declares:

```yaml
needs: build
```

That dependency means deployment starts only after a successful build. If checking, content validation, or page generation fails, the existing production site remains in place and the broken artifact is not deployed.

`actions/deploy-pages@v4` publishes the uploaded artifact to the `github-pages` environment. GitHub records the deployment and its resulting URL.

## Required GitHub repository setup

In the GitHub repository:

1. Open **Settings**.
2. Open **Pages** under **Code and automation**.
3. Set the Pages source to **GitHub Actions**.
4. Confirm the custom domain is `rasmalai.dev`.
5. Enable **Enforce HTTPS** once GitHub has issued the domain certificate.

The exact labels can evolve in GitHub's interface, but the important architectural choice is that Pages uses the custom Actions workflow, not “Deploy from a branch.” The workflow publishes a build artifact; it does not commit generated files to a special branch.

The repository's GitHub Actions settings must also permit actions to run. The workflow explicitly declares its Pages permissions in YAML.

## Custom domain responsibilities

Three separate pieces work together:

### `site` in Astro configuration

`astro.config.mjs` contains:

```js
site: "https://rasmalai.dev"
```

This tells Astro the canonical production origin. It affects URL generation where Astro needs a complete site URL; it does not configure DNS or prove ownership of the domain.

### `public/CNAME`

`public/CNAME` contains the custom domain. Because files under `public/` are copied unchanged, the built artifact includes a root-level `CNAME` file for GitHub Pages.

### DNS records

The domain's DNS provider must point `rasmalai.dev` to GitHub Pages using the records GitHub specifies for an apex domain. DNS lives outside this repository, so the workflow cannot configure or verify the registrar account by itself.

Do not copy IP addresses from an old note without checking GitHub's current documentation. GitHub can change infrastructure guidance, and incorrect DNS records can break the custom domain even when the Actions deployment is green.

## Why there is no `base` setting

The repository is named `sras1599.github.io`, which is a GitHub Pages user-site repository, and production uses the custom root domain `rasmalai.dev`. The site is therefore served from the domain root, so URLs such as `/blog` are appropriate.

A project site served at a subpath such as `username.github.io/project-name/` would generally need Astro's `base` configuration and base-aware internal URLs. That is not the current deployment shape.

## Standard deployment workflow

Before publishing:

```sh
npm ci
npm run build
npm run preview
```

After verifying the production preview:

1. Commit the source changes.
2. Push them to a feature branch if using a pull-request workflow.
3. Review and merge into `main`, or push directly to `main` when appropriate.
4. Open the repository's **Actions** tab.
5. Select **Deploy to GitHub Pages** and watch the triggered run.
6. Confirm both the `build` and `deploy` jobs succeed.
7. Visit `https://rasmalai.dev` and verify the changed route.

Publishing is tied to `main`, so “committed” does not necessarily mean “deployed.” A commit on another branch remains undeployed until it reaches `main` or the workflow is deliberately changed.

## Manual deployment run

Because `workflow_dispatch` is enabled, the same workflow can be run manually:

1. Open **Actions** in GitHub.
2. Select **Deploy to GitHub Pages**.
3. Choose **Run workflow**.
4. Run it against `main`.

This is useful when retrying a transient infrastructure failure. It rebuilds the repository state on the selected branch; it does not publish uncommitted local files.

## Reading a deployment failure

Start with the first failed step rather than the last skipped job.

### Failure in `npm ci`

Likely causes include:

- `package.json` and `package-lock.json` disagree;
- a dependency version cannot be resolved;
- the lockfile was not committed after a dependency change;
- a package registry or network problem occurred.

Reproduce locally from the committed files with `npm ci`.

### Failure in `npm run build`

Likely causes include:

- an Astro or content-schema diagnostic;
- invalid blog frontmatter;
- a broken import or renamed file;
- a route-generation failure;
- a difference between the local Node version and CI's Node 22.

Run the same command locally and resolve the first reported diagnostic.

### Failure while uploading the artifact

Confirm that `npm run build` created `dist/` and that the workflow still points `path` to `dist`.

### Failure in `deploy-pages`

Check:

- Pages is configured to use GitHub Actions;
- the workflow retains `pages: write` and `id-token: write`;
- the repository or organization has not disabled Pages or required actions;
- the `github-pages` environment does not have an unmet protection rule.

### Actions succeeds but the domain does not load

Separate hosting from DNS:

1. Inspect the deployment URL recorded by the deploy job.
2. Check the repository's Pages settings and custom-domain status.
3. Confirm that `public/CNAME` contains only `rasmalai.dev`.
4. Verify current DNS records against GitHub's official documentation.
5. Allow for DNS and HTTPS certificate propagation after a domain change.

### The old page is still visible

Confirm that the relevant commit reached `main` and that a newer workflow run completed. Then perform a normal browser reload or test in a private window. Avoid assuming cache is the cause before checking the deployed commit and workflow status.

## Rollback strategy

The source repository is the deployment source of truth. To undo a bad release:

1. Revert the problematic commit, or create a corrective commit.
2. Put that commit on `main`.
3. Let the normal workflow build and publish the corrected state.

This produces an auditable history and runs the same checks as any other deployment. Re-running an old workflow may be useful for diagnosis, but a source-level revert is clearer because future builds also contain the correction.

## Security and maintenance notes

- Do not place secrets in source files or `public/`; everything in the deployed artifact is public.
- Pin workflow actions to intentional major versions and review upgrades before changing them.
- Let Dependabot or deliberate maintenance update dependencies and workflow actions; validate those updates with a build.
- Keep workflow permissions minimal.
- Treat a green deployment as evidence that automation succeeded, then verify the important production route separately.

## Further reading

- [Astro's GitHub Pages deployment guide](https://docs.astro.build/en/guides/deploy/github/)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)


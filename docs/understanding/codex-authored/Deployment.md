# Deployment from the private vault

The website code lives in `sras1599/sras1599.github.io`. Writing lives in the private
`sras1599/obsidian` repository. GitHub Pages receives only the finished `dist`
artifact, never the vault checkout or its credentials.

## One-time setup

1. In the website repository, create the Actions secret `VAULT_READ_TOKEN` using a
   fine-grained personal access token restricted to `sras1599/obsidian` with
   **Contents: read**.
2. In the vault repository, create `WEBSITE_WORKFLOW_TOKEN` using a fine-grained
   token restricted to `sras1599/sras1599.github.io` with **Actions: write**.
3. The vault workflow belongs at `.github/workflows/rebuild-website.yml`; a copy is
   maintained in `docs/workflows/rebuild-website.yml` in the website repository.
4. Keep Pages configured to deploy through GitHub Actions. Retain the existing
   custom domain configuration for `rasmalai.dev`.

Tokens are separate because reading private writing and starting a website workflow
are different permissions. Store them only as Actions secrets, never in either
repository. Renew them when they expire.

## Publishing sequence

Every push to the vault's `main` branch runs its small trigger workflow. This uses
GitHub's `workflow_dispatch` API to start the website's `deploy.yml` on `main`.
The request sends no note contents. The ordinary vault backup is enough to start
this sequence; local saves appear publicly only after backup, build, and deployment.

The website workflow:

1. Checks out the website and the latest vault `main` into `.vault-checkout`.
2. Disables persisted Git credentials and logs the resolved vault commit SHA.
3. Sets `VAULT_PATH` to that checkout and runs the normal production build.
4. Uploads only `dist` and deploys that artifact to Pages.

Pushes to website `main` and manual workflow dispatches also rebuild the site.
All triggers share one workflow-level concurrency group. Running deployments finish
before the next starts; GitHub can coalesce pending runs. Each build reads the
latest vault state available when it checks out the vault.

Only notes explicitly marked `publish: true` and their referenced raster images
enter the site. See [development and metadata](DEVELOPMENT.md). Unpublishing or
deleting a note removes its URL on the next successful deployment. There is no
scheduled publishing: `publishDate` is display/sort metadata.

## Failures and recovery

- A failed vault trigger usually indicates a missing/expired token or incorrect
  Actions permission. Read the vault workflow log, then retry its job.
- A failed private checkout usually indicates the read token or repository access.
- An import/build failure identifies invalid selected content or an unresolved
  reference. Correct the source in Obsidian and let backup push the correction.
- Failed builds never replace the previous Pages deployment. Check the website
  workflow and its logged vault SHA if an old article remains visible.
- To roll back writing, restore the desired version in the vault and push it.
  Re-running an old website workflow still fetches current vault `main`.
- To roll back presentation code, revert the website change and rebuild.

Local implementation validation uses synthetic notes and does not push, dispatch,
or publish. Configure the secrets before enabling the workflow changes remotely.
The credential-backed end-to-end publishing trial is deferred until real-content
validation is requested.

## References

- [GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
- [Private repository checkout](https://github.com/actions/checkout#checkout-multiple-repos-private)
- [Astro content loaders](https://docs.astro.build/en/reference/content-loader-reference/)

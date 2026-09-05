# Personal website

Astro website for [rasmalai.dev](https://rasmalai.dev). Blog posts are imported from
a private Obsidian vault; this repository holds the presentation and publishing code.

```sh
npm ci
cp .env.example .env
# Set VAULT_PATH in .env to your local vault.
npm run dev
```

Use `npm run dev:writing` to include explicitly marked local previews, `npm test`
for synthetic validation, and `npm run build` for a production build.

- [Local development and writing](docs/understanding/codex-authored/DEVELOPMENT.md)
- [Deployment and required secrets](docs/understanding/codex-authored/Deployment.md)

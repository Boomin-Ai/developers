# Boomin Developers

Owned developer documentation site for `developers.boomin.ai`.

## Stack

- Astro
- Starlight
- Scalar OpenAPI pages
- Cloudflare Pages

## Local

```bash
npm ci
npm run build
npm run preview
```

## Deploy

Deploy through GitHub Actions, not local Wrangler.

Required repository secret:

- `CLOUDFLARE_API_TOKEN`

Manual workflow: `.github/workflows/deploy.yml`.


# Cloudflare Deployment Note

## Current production state

- Worker: `fatwa-api`
- URL: `https://fatwa-api.ziakhalid236.workers.dev`
- D1: `fatwa-web-content`
- R2: `fatwa-media`
- Live health endpoint returns `200`.
- Public content tables are intentionally empty after the approved reset.
- R2 media bucket is intentionally empty after the approved reset.

## Issue found

The Cloudflare Workers Build trigger was connected to GitHub repository `ziakhalid236/fatwa-mobile`, but used:

```text
root_directory: /
build_command: pnpm run build
deploy_command: npx wrangler deploy
```

The repository does not contain a reviewed Cloudflare Worker source/configuration at the root. The root build also includes Expo and web projects requiring different environment variables. Deploying this trigger would therefore risk replacing the live API with an invalid or incomplete deployment.

## Safe resolution applied

The `fatwa-api` Workers Build auto-build flag was disabled. This stops the broken trigger from automatically deploying on every GitHub push. It does not delete, modify or replace the live Worker, D1 database, R2 bucket or bindings.

## Correct future solution

Before enabling auto-build again:

1. Add a dedicated Worker source directory, for example `workers/fatwa-api/`.
2. Add a reviewed `wrangler.toml` with the exact D1 and R2 bindings.
3. Keep admin secrets in Cloudflare secrets, never in Git.
4. Add a Worker-only build and deploy command.
5. Deploy to a preview Worker and test health, public endpoints, admin authentication, multipart image upload, R2 retrieval and CORS.
6. Enable production auto-build only after preview validation.

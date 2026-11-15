# Dual Vibe security rollout

## Current verified status

- The server-side Worker relay is committed in `security-worker/`.
- The frontend HTML-injection fixes are merged into `main`: visitor-entered names are escaped before HTML interpolation and toast text is rendered with `textContent`.
- The Worker has automated Node.js tests for origin checks, preflight, method/content-type checks, malformed and oversized payloads, both relay routes, and unknown paths.
- GitHub Actions ran the Worker test job successfully on the latest security change (two successful check runs).
- The Worker is deployed at `https://dual-vibe-secure-api.arfatyaser194.workers.dev` and its Production runtime configuration has been populated by the repository owner.
- The frontend cutover was committed to `main` in `7cfeda137a3724ce7cdc47706603429f7f3af69d`: visitor Telegram reports now POST to `/telegram`, and consent-based mirror captures POST to `/capture`. The browser no longer contains the Telegram bot token, chat ID, Apps Script URL, or shared capture secret.
- GitHub Pages deployment/build for the frontend cutover must finish successfully and then be smoke-tested. Do not claim end-to-end delivery until Telegram and capture tests succeed.

## Secrets that must never be committed

Configure these as encrypted Cloudflare Worker secrets:

- `TELEGRAM_BOT_TOKEN`: create a replacement token with BotFather first; revoke the exposed token after the replacement is confirmed.
- `TELEGRAM_CHAT_ID`: existing destination chat ID, configured as a Worker secret for now.
- `GOOGLE_APP_URL`: the existing Apps Script deployment URL.
- `GOOGLE_APP_SECRET`: replace the old shared secret with a new random value and update the Apps Script deployment to validate it.

Set `ALLOWED_ORIGIN` in `wrangler.toml` to the exact production website origin (scheme + host, no path). The current value is `https://yaser-x.github.io`; confirm that this is the active production origin before deployment.

## Deploy and verify

1. Sign in to the Cloudflare account that will own the Worker and install/authenticate Wrangler.
2. From `security-worker/`, run `wrangler secret put TELEGRAM_BOT_TOKEN`, then repeat for `TELEGRAM_CHAT_ID`, `GOOGLE_APP_URL`, and `GOOGLE_APP_SECRET`. Enter values only in the secure terminal prompt, never in Git or chat.
3. Verify `ALLOWED_ORIGIN` against the actual deployed website origin.
4. Add Cloudflare WAF rate-limit rules for `POST /telegram` and `POST /capture`. Start conservatively and monitor legitimate traffic.
5. Deploy the Worker and test preflight, invalid origins, invalid payloads, oversized payloads, Telegram delivery, and Apps Script delivery.
6. Record the deployed Worker URL and complete a smoke test before changing the website.

## Frontend cutover (committed; deployment verification pending)

The frontend now uses the deployed Worker URL. The committed changes:

- Telegram visitor reports use `POST {WORKER_URL}/telegram` with `{ "text": message }`.
- Mirror captures use `POST {WORKER_URL}/capture` with `{ "image": dataUrl, "caption": caption }`.
- Camera UI, permission prompt, mirror UI, and existing capture triggers were preserved.

A public website cannot safely authenticate itself with a hard-coded shared key: visitors can extract it. The Worker therefore enforces the exact Origin as a browser boundary, but Origin/CORS is not authentication against non-browser clients. WAF rate limits and abuse monitoring are required before cutover. For stronger abuse resistance, add Cloudflare Turnstile or a server-issued short-lived challenge in a separate tested change.

## Historical exposure

Removing a credential from the latest file does not remove it from Git history. Rotate/revoke every exposed credential first. Consider rewriting repository history only after making an offline backup and coordinating any collaborators; force-pushing history can disrupt clones and deployments.

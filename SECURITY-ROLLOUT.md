# Dual Vibe security rollout

## Current verified status

- The server-side Worker relay is committed in `security-worker/`.
- The frontend HTML-injection fixes are merged into `main`: visitor-entered names are escaped before HTML interpolation and toast text is rendered with `textContent`.
- The Worker has automated Node.js tests for origin checks, preflight, method/content-type checks, malformed and oversized payloads, both relay routes, and unknown paths.
- GitHub Actions ran the Worker test job successfully on the latest security change (two successful check runs).
- The live frontend has **not** been switched to the Worker. The browser bundle still contains previously exposed integration credentials and direct upstream calls. Do not treat the site as secured yet.
- The Worker has **not** been deployed or configured with production secrets. No credentials have been rotated.

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

## Frontend cutover (still pending)

Only after the Worker is deployed and its URL is verified should `index.html` be updated:

- Replace direct Telegram Bot API calls with `POST {WORKER_URL}/telegram` and JSON body `{ "text": message }`.
- Replace direct Apps Script calls with `POST {WORKER_URL}/capture` and JSON body containing `image` and `caption`.
- Remove the browser-side Telegram token, chat ID, Apps Script URL, and shared secret in the same atomic frontend commit.
- Keep all current UI, permission prompts, visitor reporting, and capture triggers unchanged.

A public website cannot safely authenticate itself with a hard-coded shared key: visitors can extract it. The Worker therefore enforces the exact Origin as a browser boundary, but Origin/CORS is not authentication against non-browser clients. WAF rate limits and abuse monitoring are required before cutover. For stronger abuse resistance, add Cloudflare Turnstile or a server-issued short-lived challenge in a separate tested change.

## Historical exposure

Removing a credential from the latest file does not remove it from Git history. Rotate/revoke every exposed credential first. Consider rewriting repository history only after making an offline backup and coordinating any collaborators; force-pushing history can disrupt clones and deployments.

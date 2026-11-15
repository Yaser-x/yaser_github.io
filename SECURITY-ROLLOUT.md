# Dual Vibe security rollout

This branch adds a server-side relay for the existing Telegram reporting and Google Apps Script capture integrations. It does not change the current website yet, so the live experience remains untouched until the Worker is deployed and verified.

## Secrets that must never be committed

Configure these as encrypted Cloudflare Worker secrets:

- `TELEGRAM_BOT_TOKEN`: create a replacement token with BotFather first; revoke the exposed token after the replacement is confirmed.
- `TELEGRAM_CHAT_ID`: existing destination chat ID.
- `GOOGLE_APP_URL`: the existing Apps Script deployment URL.
- `GOOGLE_APP_SECRET`: replace the old shared secret with a new random value and update the Apps Script deployment to validate it.

Set `ALLOWED_ORIGIN` in `wrangler.toml` to the exact production website origin (scheme + host, no path). Confirm the actual Pages/custom-domain origin before deployment.

## Deploy

1. Install Wrangler and authenticate to the Cloudflare account that owns the site/API.
2. From this directory run `wrangler secret put TELEGRAM_BOT_TOKEN`, then repeat for `TELEGRAM_CHAT_ID`, `GOOGLE_APP_URL`, and `GOOGLE_APP_SECRET`.
3. Verify `ALLOWED_ORIGIN` against the actual deployed website origin.
4. Add Cloudflare WAF rate-limit rules for `POST /telegram` and `POST /capture`. Start conservatively and monitor legitimate traffic.
5. Deploy the Worker and test `OPTIONS`, invalid origins, invalid payloads, oversized payloads, Telegram delivery, and Apps Script delivery.

## Frontend cutover (intentionally pending)

Only after the Worker is deployed and its URL is verified should `index.html` be updated to call it:

- Replace direct Telegram Bot API calls with `POST {WORKER_URL}/telegram` and JSON body `{ "text": message }`.
- Replace direct Apps Script calls with `POST {WORKER_URL}/capture` and JSON body containing `image` and `caption`.
- Remove the browser-side Telegram token, chat ID, Apps Script URL, and shared secret in the same atomic frontend commit.
- Keep all current UI, permission prompts, visitor reporting, and capture triggers unchanged.

A public website cannot safely authenticate itself with a hard-coded shared key: visitors can extract it. The Worker therefore enforces the exact Origin as a browser boundary, but Origin/CORS is not authentication against non-browser clients. WAF rate limits and abuse monitoring are required before cutover. For stronger abuse resistance, add Cloudflare Turnstile or a server-issued short-lived challenge in a separate tested change.

## Other code finding

The visitor-provided name is interpolated into HTML in the girl-world copy. Before production cutover, change only those dynamic name insertions to text nodes / escaped text while preserving the surrounding styling. This prevents stored/reflected markup injection without changing the visual feature.

## Historical exposure

Removing a credential from the latest file does not remove it from Git history. Rotate/revoke every exposed credential first. Consider rewriting repository history only after making an offline backup and coordinating any collaborators; force-pushing history can disrupt clones and deployments.

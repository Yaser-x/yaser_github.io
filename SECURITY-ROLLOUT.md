# Dual Vibe security rollout

## Current verified status

- The server-side Cloudflare Worker relay is committed in `security-worker/` and deployed at `https://dual-vibe-secure-api.arfatyaser194.workers.dev`.
- The production Worker configuration has been populated with the required encrypted values by the repository owner. Secret values must never be committed or shared in chat.
- The frontend HTML-injection fixes are merged into `main`: visitor-entered names are escaped before HTML interpolation and toast text is rendered with `textContent`.
- The frontend cutover is committed to `main`: visitor Telegram reports POST to `/telegram`, and consent-based mirror captures POST to `/capture`. The browser no longer contains the Telegram bot token, chat ID, Apps Script URL, or shared capture secret.
- The existing camera permission flow, mirror UI, capture triggers, and visitor reporting flow were preserved.
- The repository includes automated Node.js Worker tests for origin checks, preflight, method/content-type checks, malformed and oversized payloads, Telegram and Apps Script forwarding, upstream application errors, and rate limiting.
- GitHub Actions test runs for the Worker have succeeded on the security changes.
- The repository owner manually confirmed that Telegram reports arrive and mirror capture images are delivered successfully.
- The Worker enforces the configured origin allow-list and route-specific rate limits. These rate limits are approximate and local to each Cloudflare location, not strict global quotas.
- This verification confirms the tested integration paths; it is not a guarantee that every possible abuse or security issue is eliminated.

## Production configuration

The Worker uses these runtime settings:

- `ALLOWED_ORIGIN`: exact production website origin, currently `https://yaser-x.github.io`.
- `TELEGRAM_BOT_TOKEN`: encrypted Cloudflare Worker secret.
- `TELEGRAM_CHAT_ID`: encrypted Cloudflare Worker secret.
- `GOOGLE_APP_URL`: encrypted Cloudflare Worker secret containing the Apps Script deployment URL.
- `GOOGLE_APP_SECRET`: encrypted Cloudflare Worker secret shared with the Apps Script endpoint.

Do not put any of these values in frontend code, repository files, screenshots, issue comments, or chat messages. Update secrets only through the appropriate secure Cloudflare or Apps Script configuration interface.

## Worker routes and protections

- `POST /telegram`: validates the request and forwards the visitor report to Telegram using server-side credentials.
- `POST /capture`: validates the request and forwards the image and caption to the Apps Script endpoint.
- Other origins, unsupported methods, malformed payloads, and oversized bodies are rejected.
- Telegram and Apps Script upstream responses are checked before the Worker reports success.
- `TELEGRAM_RATE_LIMITER`: 10 requests per 60 seconds per client IP and Cloudflare location.
- `CAPTURE_RATE_LIMITER`: 4 requests per 60 seconds per client IP and Cloudflare location.

Origin/CORS enforcement is a browser boundary, not authentication against non-browser clients. Rate limits reduce abuse but are not a strict global quota. A separate, tested Turnstile or short-lived challenge integration could provide stronger abuse resistance if needed.

## Historical secret exposure

GitHub Secret Scanning currently shows one open alert for a Telegram Bot Token previously detected in `index.html` (reported location: line 264, detection date shown by GitHub: 30 May).

The current `main` version of `index.html` no longer contains the old browser-side Telegram credential or the old direct Apps Script configuration. However, the credential was present in historical Git commits, so removing it from the latest file does not erase the historical copies.

The repository owner reported that the exposed Telegram token was revoked and replaced, and the replacement was configured in Cloudflare. The current validity/revocation state cannot be independently verified from the repository. Keep the GitHub alert open until the historical exposure has been remediated and the alert has been reviewed.

## Remaining work

- Back up the repository and its refs before any history rewrite.
- Rewrite Git history to remove the exposed credential from historical commits, then force-update the affected refs and remove obsolete branches/tags that retain the exposed history. This is a destructive operation and must be coordinated with anyone else using the repository.
- Re-scan the rewritten repository and review the GitHub Secret Scanning alert. Do not assume that closing an alert alone removes the secret from Git history.
- Verify the Apps Script endpoint still validates only the current shared secret and that any previously exposed shared secret is no longer accepted.

Do not claim historical cleanup is complete until the rewritten refs and a fresh secret scan have been verified.

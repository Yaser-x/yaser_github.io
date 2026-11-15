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

## Historical secret exposure and cleanup

- GitHub Actions run `43755622738` completed successfully on 16 November 2026.
- Before rewriting, the workflow created and verified a full Git bundle containing the fetched repository refs. The backup was uploaded as artifact `yaser-github-history-backup` (artifact ID `14178260959`, approximately 86 MB). The artifact has a short retention window; download and keep it offline before it expires.
- The workflow prepared four redaction entries from exposed credential patterns, rewrote the fetched Git history, and force-updated the affected refs.
- The post-rewrite scan completed successfully and reported no known exposed Telegram-token patterns, Apps Script deployment URLs, or legacy shared-secret marker across 358 reachable Git objects.
- The current `index.html` on `main`, `backup-before-upgrade-2026-08-29`, and `security/harden-secrets-api` was checked. None contains the old token pattern, direct Apps Script URL, or legacy shared-secret marker.
- GitHub Secret Scanning's alert status still needs to be checked in the Security tab. A successful Git history scan does not itself prove that GitHub has refreshed or closed the alert.
- The repository owner reported that the exposed Telegram token was revoked and replaced, and the replacement was configured in Cloudflare. The revocation state cannot be independently verified from the repository.

## Remaining verification

- Download the backup artifact and retain it offline. GitHub artifact expiry is temporary; do not treat it as a permanent backup.
- Open GitHub **Security → Secret scanning** and verify whether the Telegram Bot Token alert is now resolved. Do not manually dismiss it as a substitute for cleanup.
- Verify the Apps Script endpoint accepts only the current shared secret and rejects the old one.
- If any collaborator or external clone exists, notify its owner that Git history was rewritten and ask them to re-clone or carefully reset to the rewritten refs.
- GitHub may retain unreachable objects, cached views, forks, or external clones beyond the rewritten refs. Contact GitHub Support if the old secret remains visible through cached commit views after the refs are clean.


import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORIGIN = "https://yaser-x.github.io";
const env = {
  ALLOWED_ORIGIN: ORIGIN,
  TELEGRAM_BOT_TOKEN: "test-token-not-real",
  TELEGRAM_CHAT_ID: "123456",
  GOOGLE_APP_URL: "***REMOVED***",
  GOOGLE_APP_SECRET: "test-secret-not-real"
};

function request(path, { method = "POST", origin = ORIGIN, body, headers = {} } = {}) {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body
  });
}

test("rejects a foreign origin before contacting upstream", async () => {
  const response = await worker.fetch(request("/telegram", {
    origin: "https://attacker.example",
    body: JSON.stringify({ text: "hello" })
  }), env);
  assert.equal(response.status, 403);
});

test("answers valid preflight only for the configured origin", async () => {
  const response = await worker.fetch(request("/telegram", { method: "OPTIONS" }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
});

test("rejects non-POST methods", async () => {
  const response = await worker.fetch(request("/telegram", { method: "GET" }), env);
  assert.equal(response.status, 405);
});

test("rejects non-JSON requests", async () => {
  const response = await worker.fetch(request("/telegram", {
    headers: { "Content-Type": "text/plain" },
    body: "hello"
  }), env);
  assert.equal(response.status, 415);
});

test("returns 400 for malformed JSON", async () => {
  const response = await worker.fetch(request("/telegram", { body: "{" }), env);
  assert.equal(response.status, 400);
});

test("returns 413 when streamed body exceeds the route limit", async () => {
  const response = await worker.fetch(request("/telegram", {
    body: JSON.stringify({ text: "x".repeat(17000) })
  }), env);
  assert.equal(response.status, 413);
});

test("relays Telegram messages server-side without exposing secrets in response", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl = "";
  let upstreamBody;
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url);
    upstreamBody = JSON.parse(options.body);
    return Response.json({ ok: true }, { status: 200 });
  };
  try {
    const response = await worker.fetch(request("/telegram", {
      body: JSON.stringify({ text: "visitor report" })
    }), env);
    assert.equal(response.status, 200);
    assert.match(upstreamUrl, /^https:\/\/api\.telegram\.org\/bottest-token-not-real\/sendMessage$/);
    assert.equal(upstreamBody.chat_id, env.TELEGRAM_CHAT_ID);
    assert.equal(upstreamBody.text, "visitor report");
    const responseText = await response.text();
    assert.equal(responseText.includes(env.TELEGRAM_BOT_TOKEN), false);
    assert.equal(responseText.includes(env.TELEGRAM_CHAT_ID), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects malformed capture image data", async () => {
  const response = await worker.fetch(request("/capture", {
    body: JSON.stringify({ image: "data:image/png;base64,AAAA" })
  }), env);
  assert.equal(response.status, 400);
});

test("forwards capture payload with secret only from Worker environment", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamBody;
  globalThis.fetch = async (_url, options) => {
    upstreamBody = JSON.parse(options.body);
    return new Response("ok", { status: 200 });
  };
  try {
    const response = await worker.fetch(request("/capture", {
      body: JSON.stringify({
        image: "data:image/jpeg;base64,AAAA",
        caption: "test capture"
      })
    }), env);
    assert.equal(response.status, 200);
    assert.equal(upstreamBody.secret, env.GOOGLE_APP_SECRET);
    assert.equal(upstreamBody.caption, "test capture");
    assert.equal((await response.text()).includes(env.GOOGLE_APP_SECRET), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects unknown routes", async () => {
  const response = await worker.fetch(request("/unknown", { body: "{}" }), env);
  assert.equal(response.status, 404);
});

test("reports Telegram API-level failures even when HTTP status is 200", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: false, description: "Bad Request" }, { status: 200 });
  try {
    const response = await worker.fetch(request("/telegram", {
      body: JSON.stringify({ text: "visitor report" })
    }), env);
    assert.equal(response.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

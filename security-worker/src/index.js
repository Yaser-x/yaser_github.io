const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function response(body, status, origin) {
  const headers = new Headers(JSON_HEADERS);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type");
    headers.set("access-control-max-age", "86400");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return origin && origin === env.ALLOWED_ORIGIN ? origin : null;
}

async function readJson(request, maxBytes) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > maxBytes) throw new Error("Request too large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) throw new Error("Request too large");
  return JSON.parse(raw);
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return response({ error: "Origin not allowed" }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "Content-Type",
          "access-control-max-age": "86400",
          "vary": "Origin"
        }
      });
    }

    if (!origin) return response({ error: "Origin not allowed" }, 403);
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405, origin);
    if (!/^application\\/json(?:;|$)/i.test(request.headers.get("Content-Type") || "")) {
      return response({ error: "JSON required" }, 415, origin);
    }

    const path = new URL(request.url).pathname;
    try {
      if (path === "/telegram") {
        const data = await readJson(request, 16 * 1024);
        if (typeof data.text !== "string" || !data.text.trim() || data.text.length > 4000) {
          return response({ error: "Invalid message" }, 400, origin);
        }
        const upstream = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: data.text,
            parse_mode: "Markdown"
          })
        });
        if (!upstream.ok) return response({ error: "Message delivery failed" }, 502, origin);
        return response({ ok: true }, 200, origin);
      }

      if (path === "/capture") {
        const data = await readJson(request, 6 * 1024 * 1024);
        if (typeof data.image !== "string" ||
            !/^data:image\\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.image) ||
            data.image.length > 5 * 1024 * 1024) {
          return response({ error: "Invalid image payload" }, 400, origin);
        }
        const upstreamUrl = new URL(env.GOOGLE_APP_URL);
        if (upstreamUrl.hostname !== "script.google.com" || upstreamUrl.protocol !== "https:") {
          return response({ error: "Capture service configuration invalid" }, 500, origin);
        }
        const upstream = await fetch(upstreamUrl.toString(), {
          method: "POST",
          headers: { "content-type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            secret: env.GOOGLE_APP_SECRET,
            image: data.image,
            caption: typeof data.caption === "string" ? data.caption.slice(0, 1000) : "New capture"
          })
        });
        if (!upstream.ok) return response({ error: "Capture delivery failed" }, 502, origin);
        return response({ ok: true }, 200, origin);
      }

      return response({ error: "Not found" }, 404, origin);
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 413;
      return response({ error: status === 400 ? "Invalid JSON" : "Request rejected" }, status, origin);
    }
  }
};

/**
 * /api/votes — Abstimmungen speichern und abrufen
 *
 * POST /api/votes          → Stimme abgeben
 * GET  /api/votes?pollId=X → Ergebnisse einer Umfrage abrufen
 *
 * Benötigt KV-Binding: BAPTISM_KV
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method === "POST") {
    return handlePost(request, env);
  }

  if (request.method === "GET") {
    return handleGet(request, env);
  }

  return new Response("Method Not Allowed", { status: 405 });
}

/* POST — Stimme abgeben */
async function handlePost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage" }, 400);
  }

  const pollId = sanitize(body.pollId);
  const value  = sanitize(body.value);

  if (!pollId || !value) {
    return jsonResponse({ error: "pollId und value erforderlich" }, 400);
  }

  const resultsKey = `poll:${pollId}:results`;

  let results;
  try {
    const raw = await env.BAPTISM_KV.get(resultsKey);
    results = raw ? JSON.parse(raw) : { counts: {}, total: 0 };
  } catch {
    results = { counts: {}, total: 0 };
  }

  results.counts[value] = (results.counts[value] || 0) + 1;
  results.total = Object.values(results.counts).reduce((s, v) => s + v, 0);

  try {
    await env.BAPTISM_KV.put(resultsKey, JSON.stringify(results));
  } catch {
    return jsonResponse({ error: "Speicherfehler" }, 500);
  }

  return jsonResponse({ success: true, ...results });
}

/* GET — Ergebnisse abrufen */
async function handleGet(request, env) {
  const url    = new URL(request.url);
  const pollId = sanitize(url.searchParams.get("pollId") || "");

  if (!pollId) {
    return jsonResponse({ error: "pollId fehlt" }, 400);
  }

  const resultsKey = `poll:${pollId}:results`;

  try {
    const raw     = await env.BAPTISM_KV.get(resultsKey);
    const results = raw ? JSON.parse(raw) : { counts: {}, total: 0 };
    return jsonResponse(results);
  } catch {
    return jsonResponse({ counts: {}, total: 0 });
  }
}

/* Helpers */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function sanitize(val) {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, 200).replace(/[<>]/g, "");
}

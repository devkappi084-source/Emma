/**
 * /api/rsvp — RSVP speichern und abrufen
 *
 * POST /api/rsvp  → Neue Anmeldung speichern
 * GET  /api/rsvp?key=ADMIN_KEY → Alle Anmeldungen abrufen (Admin)
 *
 * Benötigt KV-Binding: BAPTISM_KV
 * Benötigt Secret: ADMIN_KEY (in Cloudflare Pages → Settings → Environment Variables)
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

/* POST — Anmeldung speichern */
async function handlePost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage" }, 400);
  }

  const name = sanitize(body.name);
  if (!name) {
    return jsonResponse({ error: "Name fehlt" }, 400);
  }

  const attendance = body.attendance === "yes" ? "yes" : "no";

  const entry = {
    name,
    email:      sanitize(body.email || ""),
    attendance,
    guests:     sanitize(body.guests || "1"),
    menu:       sanitize(body.menu || ""),
    allergies:  sanitize(body.allergies || ""),
    message:    sanitize(body.message || ""),
    timestamp:  new Date().toISOString(),
  };

  const key = `rsvp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    await env.BAPTISM_KV.put(key, JSON.stringify(entry));
  } catch {
    return jsonResponse({ error: "Speicherfehler" }, 500);
  }

  return jsonResponse({ success: true });
}

/* GET — Admin: Alle Anmeldungen abrufen */
async function handleGet(request, env) {
  const url      = new URL(request.url);
  const keyParam = url.searchParams.get("key");
  const adminKey = env.ADMIN_KEY;

  if (!adminKey || keyParam !== adminKey) {
    return jsonResponse({ error: "Nicht autorisiert" }, 401);
  }

  let keys;
  try {
    const list = await env.BAPTISM_KV.list({ prefix: "rsvp:" });
    keys = list.keys;
  } catch {
    return jsonResponse({ error: "Lesefehler" }, 500);
  }

  const entries = await Promise.all(
    keys.map(async ({ name }) => {
      const val = await env.BAPTISM_KV.get(name);
      return val ? JSON.parse(val) : null;
    })
  );

  const valid = entries
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const yes = valid.filter(e => e.attendance === "yes");
  const no  = valid.filter(e => e.attendance === "no");

  return jsonResponse({
    total:   valid.length,
    yes:     yes.length,
    no:      no.length,
    entries: valid,
  });
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
  return val.trim().slice(0, 1000).replace(/[<>]/g, "");
}

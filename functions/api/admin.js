/**
 * /api/admin — Zentraler Admin-Endpunkt
 *
 * Alle Anfragen erfordern den ADMIN_KEY als Query-Parameter (?key=...).
 *
 * GET    ?key=...&action=rsvps              → Alle Anmeldungen + Zusammenfassung
 * GET    ?key=...&action=polls              → Alle Abstimmungsergebnisse
 * GET    ?key=...&action=config             → Aktuelle Konfigurations-Overrides aus KV
 * PUT    ?key=...&action=config (body:JSON) → Konfigurations-Overrides speichern
 * DELETE ?key=...&action=rsvp&id=<kvKey>   → Eine Anmeldung löschen
 * PATCH  ?key=...&action=rsvp&id=<kvKey>   → Eine Anmeldung bearbeiten (body: JSON)
 * DELETE ?key=...&action=poll&pollId=<id>  → Abstimmung zurücksetzen
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const url    = new URL(request.url);
  const key    = url.searchParams.get("key");
  const action = url.searchParams.get("action");

  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: "Nicht autorisiert" }, 401);
  }

  if (request.method === "GET") {
    if (action === "rsvps")  return getRsvps(env);
    if (action === "polls")  return getPolls(env, url);
    if (action === "config") return getConfig(env);
  }

  if (request.method === "PUT" && action === "config") {
    return putConfig(request, env);
  }

  if (request.method === "PATCH" && action === "rsvp") {
    return patchRsvp(request, env, url);
  }

  if (request.method === "DELETE") {
    if (action === "rsvp") return deleteRsvp(env, url);
    if (action === "poll") return deletePoll(env, url);
  }

  return json({ error: "Unbekannte Aktion" }, 400);
}

/* ── GET rsvps ─────────────────────────────────────────────────── */
async function getRsvps(env) {
  const list = await env.BAPTISM_KV.list({ prefix: "rsvp:" });

  const entries = (
    await Promise.all(
      list.keys.map(async ({ name }) => {
        const val = await env.BAPTISM_KV.get(name);
        return val ? { _id: name, ...JSON.parse(val) } : null;
      })
    )
  )
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const yes   = entries.filter(e => e.attendance === "yes");
  const no    = entries.filter(e => e.attendance === "no");
  const menus = {};
  yes.forEach(e => {
    if (e.menu) menus[e.menu] = (menus[e.menu] || 0) + 1;
  });
  const totalGuests = yes.reduce((s, e) => s + (parseInt(e.guests) || 1), 0);

  return json({ entries, summary: { total: entries.length, yes: yes.length, no: no.length, totalGuests, menus } });
}

/* ── GET polls ──────────────────────────────────────────────────── */
async function getPolls(env, url) {
  const pollId = url.searchParams.get("pollId");

  if (pollId) {
    const raw = await env.BAPTISM_KV.get(`poll:${pollId}:results`);
    return json(raw ? JSON.parse(raw) : { counts: {}, total: 0 });
  }

  const list = await env.BAPTISM_KV.list({ prefix: "poll:" });
  const results = {};
  for (const { name } of list.keys) {
    const parts = name.split(":");   // poll:<id>:results
    if (parts.length === 3 && parts[2] === "results") {
      const raw = await env.BAPTISM_KV.get(name);
      results[parts[1]] = raw ? JSON.parse(raw) : { counts: {}, total: 0 };
    }
  }
  return json({ results });
}

/* ── GET config ─────────────────────────────────────────────────── */
async function getConfig(env) {
  const raw = await env.BAPTISM_KV.get("config:overrides");
  return json(raw ? JSON.parse(raw) : {});
}

/* ── PUT config ─────────────────────────────────────────────────── */
async function putConfig(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Ungültiger Body" }, 400); }
  await env.BAPTISM_KV.put("config:overrides", JSON.stringify(body));
  return json({ success: true });
}

/* ── DELETE rsvp ────────────────────────────────────────────────── */
async function deleteRsvp(env, url) {
  const id = url.searchParams.get("id");
  if (!id || !id.startsWith("rsvp:")) return json({ error: "Ungültige ID" }, 400);
  await env.BAPTISM_KV.delete(id);
  return json({ success: true });
}

/* ── PATCH rsvp ─────────────────────────────────────────────────── */
async function patchRsvp(request, env, url) {
  const id = url.searchParams.get("id");
  if (!id || !id.startsWith("rsvp:")) return json({ error: "Ungültige ID" }, 400);

  const existing = await env.BAPTISM_KV.get(id);
  if (!existing) return json({ error: "Eintrag nicht gefunden" }, 404);

  let patch;
  try { patch = await request.json(); } catch { return json({ error: "Ungültiger Body" }, 400); }

  const entry = { ...JSON.parse(existing), ...sanitizeEntry(patch) };
  await env.BAPTISM_KV.put(id, JSON.stringify(entry));
  return json({ success: true, entry });
}

/* ── DELETE poll ────────────────────────────────────────────────── */
async function deletePoll(env, url) {
  const pollId = url.searchParams.get("pollId");
  if (!pollId) return json({ error: "pollId fehlt" }, 400);
  await env.BAPTISM_KV.delete(`poll:${pollId}:results`);
  return json({ success: true });
}

/* ── Helpers ────────────────────────────────────────────────────── */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function sanitizeEntry(obj) {
  const allowed = ["name", "email", "attendance", "guests", "menu", "allergies", "message"];
  const out = {};
  for (const k of allowed) {
    if (k in obj) {
      out[k] = typeof obj[k] === "string" ? obj[k].trim().slice(0, 1000).replace(/[<>]/g, "") : "";
    }
  }
  return out;
}

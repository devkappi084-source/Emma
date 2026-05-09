/**
 * /api/photos — Foto-Upload und -Verwaltung via Cloudflare R2
 *
 * GET    ?file=<name>              → Foto aus R2 ausliefern (öffentlich)
 * POST   ?key=...  (multipart)    → Foto hochladen (Admin)
 * DELETE ?key=...&file=<name>     → Foto löschen (Admin)
 * PATCH  ?key=...&file=<name>     → Beschriftung aktualisieren (Admin, body: JSON)
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (!env.BAPTISM_PHOTOS) {
    return json({ error: "R2-Bucket nicht konfiguriert. Bitte 'emma-photos' in Cloudflare erstellen und binden." }, 503);
  }

  const url      = new URL(request.url);
  const filename = url.searchParams.get("file");
  const key      = url.searchParams.get("key");

  // GET – öffentlich, Foto aus R2 ausliefern
  if (request.method === "GET" && filename) {
    return servePhoto(env, filename);
  }

  // Alle anderen Methoden erfordern Auth
  if (env.ADMIN_KEY && key !== env.ADMIN_KEY) {
    return json({ error: "Nicht autorisiert" }, 401);
  }

  if (request.method === "POST")                     return uploadPhoto(request, env);
  if (request.method === "DELETE" && filename)       return deletePhoto(env, filename);
  if (request.method === "PATCH"  && filename)       return patchCaption(request, env, filename);

  return json({ error: "Unbekannte Anfrage" }, 400);
}

/* ── Foto ausliefern ──────────────────────────────────────────────── */
async function servePhoto(env, filename) {
  if (!isSafeFilename(filename)) return new Response("Not found", { status: 404 });

  const obj = await env.BAPTISM_PHOTOS.get(filename);
  if (!obj) return new Response("Not found", { status: 404 });

  const contentType = obj.httpMetadata?.contentType || "image/jpeg";
  return new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ...CORS,
    },
  });
}

/* ── Foto hochladen ───────────────────────────────────────────────── */
async function uploadPhoto(request, env) {
  let formData;
  try { formData = await request.formData(); }
  catch { return json({ error: "Ungültige Formulardaten" }, 400); }

  const file    = formData.get("photo");
  const caption = String(formData.get("caption") || "").trim().slice(0, 200);

  if (!file || typeof file === "string") return json({ error: "Keine Datei gefunden" }, 400);

  if (!ALLOWED_TYPES.includes(file.type)) {
    return json({ error: "Ungültiger Dateityp. Erlaubt: JPEG, PNG, WebP, GIF, AVIF" }, 400);
  }
  if (file.size > MAX_SIZE) {
    return json({ error: "Datei zu groß (max. 20 MB)" }, 400);
  }

  const ext      = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filename = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await env.BAPTISM_PHOTOS.put(filename, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const entry = {
    filename,
    src:     `/api/photos?file=${encodeURIComponent(filename)}`,
    caption,
  };
  await addPhotoToConfig(env, entry);

  return json({ success: true, filename, src: entry.src });
}

/* ── Foto löschen ─────────────────────────────────────────────────── */
async function deletePhoto(env, filename) {
  if (!isSafeFilename(filename)) return json({ error: "Ungültiger Dateiname" }, 400);

  await env.BAPTISM_PHOTOS.delete(filename);
  await removePhotoFromConfig(env, filename);

  return json({ success: true });
}

/* ── Beschriftung aktualisieren ───────────────────────────────────── */
async function patchCaption(request, env, filename) {
  if (!isSafeFilename(filename)) return json({ error: "Ungültiger Dateiname" }, 400);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Ungültiger Body" }, 400); }

  const caption = String(body.caption || "").trim().slice(0, 200);
  await updateCaption(env, filename, caption);

  return json({ success: true });
}

/* ── KV-Helfer ────────────────────────────────────────────────────── */
async function getConfig(env) {
  const raw = await env.BAPTISM_KV.get("config:overrides");
  return raw ? JSON.parse(raw) : {};
}

async function saveConfig(env, config) {
  await env.BAPTISM_KV.put("config:overrides", JSON.stringify(config));
}

async function addPhotoToConfig(env, entry) {
  const config  = await getConfig(env);
  const gallery = config.gallery || {};
  const photos  = [...(gallery.photos || []), { src: entry.src, caption: entry.caption, filename: entry.filename }];
  config.gallery = { ...gallery, photos };
  await saveConfig(env, config);
}

async function removePhotoFromConfig(env, filename) {
  const config  = await getConfig(env);
  const gallery = config.gallery || {};
  const photos  = (gallery.photos || []).filter(p => p.filename !== filename);
  config.gallery = { ...gallery, photos };
  await saveConfig(env, config);
}

async function updateCaption(env, filename, caption) {
  const config  = await getConfig(env);
  const gallery = config.gallery || {};
  const photos  = (gallery.photos || []).map(p =>
    p.filename === filename ? { ...p, caption } : p
  );
  config.gallery = { ...gallery, photos };
  await saveConfig(env, config);
}

/* ── Hilfsfunktionen ─────────────────────────────────────────────── */
const isSafeFilename = s => /^[\w.\-]+$/.test(s);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

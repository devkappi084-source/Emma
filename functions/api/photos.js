/**
 * /api/photos — Foto-Verwaltung mit Synology NAS als Speicher (via WebDAV)
 *
 * Umgebungsvariablen (in Cloudflare Pages → Settings → Environment Variables):
 *   NAS_WEBDAV_URL      z.B. https://fotos.meineseite.de   (Cloudflare Tunnel URL)
 *   NAS_PHOTOS_FOLDER   z.B. emma-photos                   (Name des geteilten Ordners)
 *   NAS_WEBDAV_USER     WebDAV-Benutzername
 *   NAS_WEBDAV_PASS     WebDAV-Passwort
 *
 * Routen:
 *   GET  ?file=<name>              → Foto vom NAS abrufen und an Besucher streamen (öffentlich)
 *   POST ?key=...  (multipart)     → Foto auf NAS hochladen (Admin)
 *   DELETE ?key=...&file=<name>    → Foto vom NAS löschen (Admin)
 *   PATCH  ?key=...&file=<name>    → Beschriftung in KV aktualisieren (Admin, body: JSON)
 *   GET  ?action=scan&key=...      → NAS scannen, neue Fotos in Galerie eintragen (Admin)
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_SIZE      = 20 * 1024 * 1024; // 20 MB
const IMAGE_EXT     = /\.(jpe?g|png|webp|gif|avif)$/i;

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    return await handleRequest(context);
  } catch (e) {
    return json({ error: `Interner Fehler: ${e.message}` }, 500);
  }
}

async function handleRequest(context) {
  const { request, env } = context;

  const url      = new URL(request.url);
  const filename = url.searchParams.get("file");
  const action   = url.searchParams.get("action");
  const key      = url.searchParams.get("key");

  // GET ?file=<name> — öffentlich, kein Auth nötig
  if (request.method === "GET" && filename) {
    return servePhoto(env, filename);
  }

  // Alle anderen Aktionen erfordern Admin-Auth
  if (env.ADMIN_KEY && key !== env.ADMIN_KEY) {
    return json({ error: "Nicht autorisiert" }, 401);
  }

  if (request.method === "GET"    && action === "scan") return scanNas(env);
  if (request.method === "POST")                        return uploadPhoto(request, env);
  if (request.method === "DELETE" && filename)          return deletePhoto(env, filename);
  if (request.method === "PATCH"  && filename)          return patchCaption(request, env, filename);

  return json({ error: "Unbekannte Anfrage" }, 400);
}

/* ── Foto an Besucher streamen ────────────────────────────────────── */
async function servePhoto(env, filename) {
  if (!isSafeFilename(filename)) return new Response("Not found", { status: 404 });

  if (!isNasConfigured(env)) {
    return new Response("NAS nicht konfiguriert", { status: 503 });
  }

  const nasRes = await fetch(nasFileUrl(env, filename), {
    headers: { Authorization: basicAuth(env) },
    signal:  AbortSignal.timeout(10_000),
  });

  if (!nasRes.ok) return new Response("Not found", { status: 404 });

  const contentType = nasRes.headers.get("Content-Type") || "image/jpeg";
  return new Response(nasRes.body, {
    headers: {
      "Content-Type":  contentType,
      "Cache-Control": "public, max-age=86400",
      ...CORS,
    },
  });
}

/* ── Foto hochladen ───────────────────────────────────────────────── */
async function uploadPhoto(request, env) {
  if (!isNasConfigured(env)) {
    return json({
      error: "NAS nicht konfiguriert. Bitte NAS_WEBDAV_URL, NAS_WEBDAV_USER und NAS_WEBDAV_PASS in den Cloudflare-Umgebungsvariablen setzen.",
    }, 503);
  }

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
  const buffer   = await file.arrayBuffer();

  const nasRes = await fetch(nasFileUrl(env, filename), {
    method:  "PUT",
    headers: {
      "Authorization": basicAuth(env),
      "Content-Type":  file.type,
    },
    body: buffer,
  });

  if (!nasRes.ok) {
    return json({ error: `NAS-Upload fehlgeschlagen (HTTP ${nasRes.status}). Bitte WebDAV-Zugangsdaten und Ordner prüfen.` }, 502);
  }

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

  if (isNasConfigured(env)) {
    // Fehler beim Löschen vom NAS ignorieren (Datei ggf. schon weg)
    await fetch(nasFileUrl(env, filename), {
      method:  "DELETE",
      headers: { Authorization: basicAuth(env) },
    }).catch(() => {});
  }

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

/* ── NAS scannen: neue Fotos in Galerie eintragen ─────────────────── */
async function scanNas(env) {
  if (!isNasConfigured(env)) {
    return json({ error: "NAS nicht konfiguriert" }, 503);
  }

  const folderUrl = nasFolderUrl(env);

  let nasRes;
  try {
    nasRes = await fetch(folderUrl, {
      method:  "PROPFIND",
      headers: {
        Authorization:  basicAuth(env),
        Depth:          "1",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body:   `<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:resourcetype/></D:prop></D:propfind>`,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return json({ error: `NAS nicht erreichbar: ${e.message}` }, 502);
  }

  if (!nasRes.ok) {
    return json({ error: `NAS-Fehler: HTTP ${nasRes.status}. Bitte URL und Zugangsdaten prüfen.` }, 502);
  }

  const xml = await nasRes.text();

  // Dateinamen aus PROPFIND-Antwort extrahieren
  const filenames = [...xml.matchAll(/<[^:>]*:?href[^>]*>([^<]+)<\/[^:>]*:?href>/gi)]
    .map(m => decodeURIComponent(m[1].trim()))
    .map(href => href.split("/").filter(Boolean).pop() || "")
    .filter(name => name && IMAGE_EXT.test(name) && isSafeFilename(name));

  const config           = await getConfig(env);
  const existingFilenames = new Set((config.gallery?.photos || []).map(p => p.filename).filter(Boolean));

  let added = 0;
  for (const filename of filenames) {
    if (!existingFilenames.has(filename)) {
      await addPhotoToConfig(env, {
        filename,
        src:     `/api/photos?file=${encodeURIComponent(filename)}`,
        caption: "",
      });
      added++;
    }
  }

  return json({ success: true, found: filenames.length, added });
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

/* ── NAS-Helfer ───────────────────────────────────────────────────── */
const isNasConfigured = env =>
  !!(env.NAS_WEBDAV_URL && env.NAS_WEBDAV_USER && env.NAS_WEBDAV_PASS);

const basicAuth = env =>
  "Basic " + btoa(`${env.NAS_WEBDAV_USER}:${env.NAS_WEBDAV_PASS}`);

function nasBase(env) {
  return env.NAS_WEBDAV_URL.replace(/\/$/, "");
}

function nasFolder(env) {
  return (env.NAS_PHOTOS_FOLDER || "emma-photos").replace(/^\//, "").replace(/\/$/, "");
}

const nasFolderUrl = env => `${nasBase(env)}/${nasFolder(env)}/`;
const nasFileUrl   = (env, filename) => `${nasBase(env)}/${nasFolder(env)}/${filename}`;

/* ── Sonstiges ────────────────────────────────────────────────────── */
const isSafeFilename = s => /^[\w.\-]+$/.test(s);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

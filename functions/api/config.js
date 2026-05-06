/**
 * GET /api/config — Öffentlicher Endpunkt für Konfigurations-Overrides
 *
 * Gibt die in KV gespeicherten Overrides zurück (kein Auth nötig zum Lesen).
 * Wird vom Haupt-main.js genutzt, um Config-Änderungen aus dem Admin live
 * auf die Seite zu übernehmen, ohne config.js editieren zu müssen.
 */

export async function onRequest(context) {
  const raw = await context.env.BAPTISM_KV.get("config:overrides");
  const overrides = raw ? JSON.parse(raw) : {};

  return new Response(JSON.stringify(overrides), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

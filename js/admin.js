/* =====================================================
   admin.js — Admin-Dashboard Frontend-Logik
   ===================================================== */

let adminKey = "";
let rsvpData  = [];

/* ── Init ──────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  showDashboard();

  document.getElementById("btnLogout").addEventListener("click", logout);

  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // RSVP actions
  document.getElementById("btnRefreshRsvp").addEventListener("click", loadRsvps);
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

  // Polls
  document.getElementById("btnRefreshPolls").addEventListener("click", loadPolls);

  // Settings
  document.getElementById("btnSaveSettings").addEventListener("click", saveSettings);
  document.getElementById("btnResetSettings").addEventListener("click", resetSettings);

  // Edit modal
  document.getElementById("modalClose").addEventListener("click",  closeEditModal);
  document.getElementById("modalCancel").addEventListener("click", closeEditModal);
  document.getElementById("editForm").addEventListener("submit",   handleEditSave);

  // Confirm modal
  document.getElementById("confirmNo").addEventListener("click",   closeConfirmModal);
});

/* ── Auth ──────────────────────────────────────────────────────── */
function logout() {
  window.location.reload();
}

/* ── Dashboard ─────────────────────────────────────────────────── */
function showDashboard() {
  loadRsvps();
  loadPolls();
  loadSettings();
}

/* ── Tabs ──────────────────────────────────────────────────────── */
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach(p => {
    const isActive = p.id === `tab-${name}`;
    p.classList.toggle("active", isActive);
    p.hidden = !isActive;
  });
}

/* ── RSVP: laden ───────────────────────────────────────────────── */
async function loadRsvps() {
  const body = document.getElementById("rsvpBody");
  body.innerHTML = '<tr><td colspan="8" class="loading">Wird geladen…</td></tr>';

  const res  = await api("rsvps");
  if (!res.ok) { body.innerHTML = '<tr><td colspan="8" class="loading">Fehler beim Laden.</td></tr>'; return; }
  const data = await res.json();
  rsvpData   = data.entries || [];

  renderSummary(data.summary);
  renderRsvpTable(rsvpData);
}

function renderSummary(s) {
  const el = document.getElementById("rsvpSummary");
  const menuList = Object.entries(s.menus || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ") || "—";

  el.innerHTML = `
    ${card("Gesamt", s.total, "")}
    ${card("Zusagen", s.yes, "yes")}
    ${card("Absagen", s.no, "no")}
    ${card("Gäste", s.totalGuests, "gold")}
    <div class="summary-card">
      <div class="summary-card-label">Menüwahl</div>
      <div style="font-size:.9rem;margin-top:.4rem;color:var(--text)">${menuList}</div>
    </div>
  `;
}
const card = (label, val, cls) =>
  `<div class="summary-card">
    <div class="summary-card-label">${label}</div>
    <div class="summary-card-value ${cls}">${val}</div>
  </div>`;

function renderRsvpTable(entries) {
  const body = document.getElementById("rsvpBody");
  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="8" class="loading">Noch keine Anmeldungen.</td></tr>';
    return;
  }
  body.innerHTML = entries.map(e => `
    <tr data-id="${esc(e._id)}">
      <td><strong>${esc(e.name)}</strong>${e.email ? `<br><span style="font-size:.8rem;color:var(--text-muted)">${esc(e.email)}</span>` : ""}</td>
      <td><span class="badge badge-${e.attendance === "yes" ? "yes" : "no"}">${e.attendance === "yes" ? "Ja ✓" : "Nein ✗"}</span></td>
      <td>${esc(e.guests || "1")}</td>
      <td>${esc(e.menu || "—")}</td>
      <td class="cell-truncate" title="${esc(e.allergies || "")}">${esc(e.allergies || "—")}</td>
      <td class="cell-truncate" title="${esc(e.message || "")}">${esc(e.message || "—")}</td>
      <td style="white-space:nowrap;font-size:.8rem;color:var(--text-muted)">${fmtDate(e.timestamp)}</td>
      <td class="col-actions">
        <button class="btn-icon" onclick="openEditModal('${esc(e._id)}')" title="Bearbeiten">✏️</button>
        <button class="btn-icon danger" onclick="confirmDelete('${esc(e._id)}', '${esc(e.name)}')" title="Löschen">🗑️</button>
      </td>
    </tr>
  `).join("");
}

/* ── RSVP: bearbeiten ──────────────────────────────────────────── */
function openEditModal(id) {
  const entry = rsvpData.find(e => e._id === id);
  if (!entry) return;

  document.getElementById("edit-id").value         = id;
  document.getElementById("edit-name").value       = entry.name || "";
  document.getElementById("edit-email").value      = entry.email || "";
  document.getElementById("edit-attendance").value = entry.attendance || "yes";
  document.getElementById("edit-guests").value     = entry.guests || "1";
  document.getElementById("edit-menu").value       = entry.menu || "";
  document.getElementById("edit-allergies").value  = entry.allergies || "";
  document.getElementById("edit-message").value    = entry.message || "";

  document.getElementById("editModal").hidden = false;
}

function closeEditModal() {
  document.getElementById("editModal").hidden = true;
}

async function handleEditSave(e) {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;
  const patch = {
    name:       document.getElementById("edit-name").value,
    email:      document.getElementById("edit-email").value,
    attendance: document.getElementById("edit-attendance").value,
    guests:     document.getElementById("edit-guests").value,
    menu:       document.getElementById("edit-menu").value,
    allergies:  document.getElementById("edit-allergies").value,
    message:    document.getElementById("edit-message").value,
  };

  const res = await api(`rsvp&id=${encodeURIComponent(id)}`, "PATCH", patch);
  if (res.ok) {
    closeEditModal();
    showToast("Anmeldung gespeichert.");
    loadRsvps();
  } else {
    showToast("Fehler beim Speichern.");
  }
}

/* ── RSVP: löschen ─────────────────────────────────────────────── */
let pendingDeleteId = null;

function confirmDelete(id, name) {
  pendingDeleteId = id;
  document.getElementById("confirmMsg").textContent =
    `„${name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
  document.getElementById("confirmModal").hidden = false;
  document.getElementById("confirmYes").onclick = doDelete;
}

function closeConfirmModal() {
  document.getElementById("confirmModal").hidden = true;
  pendingDeleteId = null;
}

async function doDelete() {
  if (!pendingDeleteId) return;
  const res = await api(`rsvp&id=${encodeURIComponent(pendingDeleteId)}`, "DELETE");
  closeConfirmModal();
  if (res.ok) {
    showToast("Eintrag gelöscht.");
    loadRsvps();
  } else {
    showToast("Fehler beim Löschen.");
  }
}

/* ── CSV Export ────────────────────────────────────────────────── */
function exportCsv() {
  if (!rsvpData.length) { showToast("Keine Daten zum Exportieren."); return; }

  const headers = ["Name", "E-Mail", "Teilnahme", "Personen", "Menü", "Allergien", "Nachricht", "Datum"];
  const rows = rsvpData.map(e => [
    e.name, e.email, e.attendance === "yes" ? "Ja" : "Nein",
    e.guests, e.menu, e.allergies, e.message, fmtDate(e.timestamp),
  ].map(csvCell).join(";"));

  const csv     = [headers.join(";"), ...rows].join("\n");
  const blob    = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = url;
  a.download    = `emma-taufe-anmeldungen-${datestamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV wird heruntergeladen.");
}

const csvCell = v => `"${String(v || "").replace(/"/g, '""')}"`;

/* ── Polls: laden ──────────────────────────────────────────────── */
async function loadPolls() {
  const container = document.getElementById("pollsContainer");
  container.innerHTML = '<p class="loading">Wird geladen…</p>';

  const res  = await api("polls");
  if (!res.ok) { container.innerHTML = "<p>Fehler beim Laden.</p>"; return; }
  const data = await res.json();
  const kvResults = data.results || {};

  const polls = (typeof CONFIG !== "undefined" && CONFIG.polls) ? CONFIG.polls : [];
  if (!polls.length) { container.innerHTML = "<p>Keine Umfragen in config.js definiert.</p>"; return; }

  container.innerHTML = "";
  polls.forEach(poll => {
    const r      = kvResults[poll.id] || { counts: {}, total: 0 };
    container.appendChild(buildPollCard(poll, r));
  });
}

function buildPollCard(poll, results) {
  const total  = results.total || 0;
  const counts = results.counts || {};
  let   maxV   = Math.max(0, ...Object.values(counts));

  const optHtml = poll.options.map(opt => {
    const v   = counts[opt.label] || 0;
    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
    const isWinner = v === maxV && v > 0;
    return `
      <div class="poll-admin-option" ${isWinner ? 'style="background:var(--blue-light);border-radius:6px"' : ""}>
        <span>${opt.emoji}</span>
        <span>${esc(opt.label)}</span>
        <div class="poll-bar-wrap"><div class="poll-bar-fill" style="width:${pct}%"></div></div>
        <span class="poll-pct">${v} <span style="color:var(--border);font-weight:400">(${pct}%)</span></span>
      </div>`;
  }).join("");

  const card = document.createElement("div");
  card.className = "poll-admin-card";
  card.innerHTML = `
    <div class="poll-admin-header">
      <h3 class="poll-admin-question">${esc(poll.question)}</h3>
    </div>
    ${optHtml}
    <div class="poll-admin-footer">
      <span>${total} Stimme${total !== 1 ? "n" : ""} insgesamt</span>
      <button class="btn-danger" onclick="resetPoll('${esc(poll.id)}', '${esc(poll.question)}')">
        Zurücksetzen
      </button>
    </div>
  `;
  return card;
}

/* ── Poll: zurücksetzen ─────────────────────────────────────────── */
async function resetPoll(pollId, question) {
  pendingDeleteId = null;
  document.getElementById("confirmMsg").textContent =
    `Alle Stimmen für „${question}" wirklich löschen?`;
  document.getElementById("confirmModal").hidden = false;
  document.getElementById("confirmYes").onclick = async () => {
    closeConfirmModal();
    const res = await api(`poll&pollId=${encodeURIComponent(pollId)}`, "DELETE");
    if (res.ok) { showToast("Abstimmung zurückgesetzt."); loadPolls(); }
    else          showToast("Fehler beim Zurücksetzen.");
  };
}

/* ── Settings: laden ────────────────────────────────────────────── */
async function loadSettings() {
  const res = await api("config");
  const overrides = res.ok ? await res.json() : {};
  const c = { ...((typeof CONFIG !== "undefined" ? CONFIG : {})), ...flattenOverrides(overrides) };

  setVal("s-babyName",      c.babyName      || "");
  setVal("s-eventDate",     toDatetimeLocal(c.eventDate));
  setVal("s-rsvpDeadline",  c.rsvpDeadline  || "");
  setVal("s-dresscode",     c.dresscode     || "");
  setVal("s-verseText",     c.verse?.text   || "");
  setVal("s-verseSource",   c.verse?.source || "");
  setVal("s-churchTime",    c.church?.time    || "");
  setVal("s-churchName",    c.church?.name    || "");
  setVal("s-churchAddress", c.church?.address || "");
  setVal("s-churchMaps",    c.church?.mapsUrl || "");
  setVal("s-partyTime",     c.party?.time     || "");
  setVal("s-partyName",     c.party?.name     || "");
  setVal("s-partyAddress",  c.party?.address  || "");
  setVal("s-partyMaps",     c.party?.mapsUrl  || "");
  document.getElementById("s-galleryActive").checked = !!(c.gallery?.active);
}

async function saveSettings() {
  const overrides = {
    babyName:     gVal("s-babyName"),
    eventDate:    gVal("s-eventDate"),
    rsvpDeadline: gVal("s-rsvpDeadline"),
    dresscode:    gVal("s-dresscode"),
    verse: {
      text:   gVal("s-verseText"),
      source: gVal("s-verseSource"),
    },
    church: {
      time:    gVal("s-churchTime"),
      name:    gVal("s-churchName"),
      address: gVal("s-churchAddress"),
      mapsUrl: gVal("s-churchMaps"),
    },
    party: {
      time:    gVal("s-partyTime"),
      name:    gVal("s-partyName"),
      address: gVal("s-partyAddress"),
      mapsUrl: gVal("s-partyMaps"),
    },
    gallery: {
      active: document.getElementById("s-galleryActive").checked,
    },
  };

  const res = await api("config", "PUT", overrides);
  if (res.ok) showToast("Einstellungen gespeichert und live aktiv.");
  else        showToast("Fehler beim Speichern.");
}

async function resetSettings() {
  document.getElementById("confirmMsg").textContent =
    "Alle gespeicherten Overrides löschen? Die Seite zeigt dann wieder die Werte aus config.js.";
  document.getElementById("confirmModal").hidden = false;
  document.getElementById("confirmYes").onclick = async () => {
    closeConfirmModal();
    const res = await api("config", "PUT", {});
    if (res.ok) { showToast("Overrides gelöscht."); loadSettings(); }
    else          showToast("Fehler beim Löschen.");
  };
}

/* ── API helper ─────────────────────────────────────────────────── */
function api(action, method = "GET", body = null, key = adminKey) {
  const url = `/api/admin?key=${encodeURIComponent(key)}&action=${action}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== null) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const gVal = id => document.getElementById(id)?.value?.trim() || "";
const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

function toDatetimeLocal(iso) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function flattenOverrides(o) {
  // overrides are already structured; just return them
  return o;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function datestamp() {
  return new Date().toISOString().slice(0, 10);
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

/* =====================================================
   admin.js — Admin-Dashboard Frontend-Logik
   ===================================================== */

let adminKey = "";
let rsvpData  = [];

/* ── Init ──────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const stored = sessionStorage.getItem("adminKey");
  if (stored) {
    adminKey = stored;
    showDashboard();
  } else {
    document.getElementById("loginScreen").hidden = false;
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
  }

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

  // Photos
  document.getElementById("btnRefreshPhotos").addEventListener("click", loadPhotos);
  initUploadZone();

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
async function handleLogin(e) {
  e.preventDefault();
  const key = document.getElementById("loginKey").value.trim();
  if (!key) return;

  // Key gegen API testen
  const res = await fetch(`/api/admin?key=${encodeURIComponent(key)}&action=rsvps`);
  if (res.status === 401) {
    document.getElementById("loginError").hidden = false;
    return;
  }

  sessionStorage.setItem("adminKey", key);
  adminKey = key;
  document.getElementById("loginError").hidden = true;
  showDashboard();
}

function logout() {
  sessionStorage.removeItem("adminKey");
  window.location.reload();
}

/* ── Dashboard ─────────────────────────────────────────────────── */
function showDashboard() {
  document.getElementById("loginScreen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  loadRsvps();
  loadPolls();
  loadPhotos();
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

/* ── Photos: Upload-Zone ─────────────────────────────────────────── */
function initUploadZone() {
  const zone  = document.getElementById("uploadZone");
  const input = document.getElementById("photoInput");

  input.addEventListener("change", () => {
    if (input.files.length) uploadPhotos(Array.from(input.files));
    input.value = "";
  });

  zone.addEventListener("dragover", e => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length) uploadPhotos(files);
  });
}

async function uploadPhotos(files) {
  const progressEl   = document.getElementById("uploadProgress");
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");

  progressEl.hidden = false;
  let uploaded = 0;
  let errors   = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    progressText.textContent = `Lädt hoch ${i + 1} von ${files.length}: ${file.name}`;
    progressFill.style.width = `${(i / files.length) * 100}%`;

    const form = new FormData();
    form.append("photo",   file);
    form.append("caption", "");

    try {
      const res = await fetch(`/api/photos?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        body:   form,
      });
      const data = await res.json();
      if (res.ok) { uploaded++; }
      else        { errors++; showToast(`Fehler: ${data.error || file.name}`); }
    } catch {
      errors++;
    }
  }

  progressFill.style.width = "100%";
  progressText.textContent = `${uploaded} Foto${uploaded !== 1 ? "s" : ""} hochgeladen${errors ? `, ${errors} Fehler` : ""}.`;
  setTimeout(() => { progressEl.hidden = true; progressFill.style.width = "0%"; }, 2000);

  if (uploaded > 0) showToast(`${uploaded} Foto${uploaded !== 1 ? "s" : ""} hochgeladen.`);
  loadPhotos();
}

/* ── Photos: laden & anzeigen ────────────────────────────────────── */
async function loadPhotos() {
  const grid = document.getElementById("photosGrid");
  grid.innerHTML = '<p class="loading">Wird geladen…</p>';
  document.getElementById("photosEmpty").hidden = true;

  const res    = await api("config");
  const config = res.ok ? await res.json() : {};
  const photos = config.gallery?.photos || [];

  renderPhotosGrid(photos);
}

function renderPhotosGrid(photos) {
  const grid  = document.getElementById("photosGrid");
  const empty = document.getElementById("photosEmpty");

  if (!photos.length) {
    grid.innerHTML  = "";
    empty.hidden    = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = photos.map(p => {
    const fn = esc(p.filename || "");
    return `
      <div class="photo-card" data-filename="${fn}">
        <div class="photo-thumb">
          <img src="${esc(p.src)}" alt="${esc(p.caption || "")}" loading="lazy">
          <button class="photo-delete-btn" onclick="confirmDeletePhoto('${fn}')" title="Foto löschen">✕</button>
        </div>
        <input class="photo-caption-input" type="text" value="${esc(p.caption || "")}"
               placeholder="Beschriftung (optional)"
               data-filename="${fn}"
               onblur="saveCaption(this)">
      </div>`;
  }).join("");
}

/* ── Photos: Beschriftung speichern ──────────────────────────────── */
async function saveCaption(input) {
  const filename = input.dataset.filename;
  const caption  = input.value.trim();
  if (!filename) return;

  const res = await fetch(
    `/api/photos?key=${encodeURIComponent(adminKey)}&file=${encodeURIComponent(filename)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caption }) }
  );
  if (res.ok) showToast("Beschriftung gespeichert.");
  else        showToast("Fehler beim Speichern der Beschriftung.");
}

/* ── Photos: löschen ─────────────────────────────────────────────── */
function confirmDeletePhoto(filename) {
  document.getElementById("confirmMsg").textContent =
    "Foto wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.";
  document.getElementById("confirmModal").hidden = false;
  document.getElementById("confirmYes").onclick = async () => {
    closeConfirmModal();
    const res = await fetch(
      `/api/photos?key=${encodeURIComponent(adminKey)}&file=${encodeURIComponent(filename)}`,
      { method: "DELETE" }
    );
    if (res.ok) { showToast("Foto gelöscht."); loadPhotos(); }
    else          showToast("Fehler beim Löschen.");
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
  // Aktuelle Fotos-Liste lesen und erhalten
  const currentRes = await api("config");
  const current    = currentRes.ok ? await currentRes.json() : {};

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
      photos: current.gallery?.photos || [],
    },
  };

  const res = await api("config", "PUT", overrides);
  if (res.ok) showToast("Einstellungen gespeichert und live aktiv.");
  else        showToast("Fehler beim Speichern.");
}

async function resetSettings() {
  document.getElementById("confirmMsg").textContent =
    "Alle Einstellungen zurücksetzen? Hochgeladene Fotos bleiben erhalten.";
  document.getElementById("confirmModal").hidden = false;
  document.getElementById("confirmYes").onclick = async () => {
    closeConfirmModal();
    // Fotos beim Zurücksetzen erhalten
    const currentRes = await api("config");
    const current    = currentRes.ok ? await currentRes.json() : {};
    const preserved  = { gallery: { photos: current.gallery?.photos || [] } };
    const res = await api("config", "PUT", preserved);
    if (res.ok) { showToast("Einstellungen zurückgesetzt."); loadSettings(); }
    else          showToast("Fehler beim Zurücksetzen.");
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

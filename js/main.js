/* =====================================================
   main.js — Navigation, Countdown, RSVP
   ===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfigOverrides();
  applyConfig();
  initNavbar();
  initCountdown();
  initFadeIn();
  initRsvp();
  initGallery();
});

/* ---------- Config-Overrides aus KV laden ---------- */
async function loadConfigOverrides() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const overrides = await res.json();
    if (!overrides || typeof overrides !== "object") return;

    // Flache Felder direkt überschreiben
    const flat = ["babyName", "eventDate", "rsvpDeadline", "dresscode"];
    flat.forEach(k => { if (overrides[k]) window.CONFIG[k] = overrides[k]; });

    // Verschachtelte Objekte mergen
    ["verse", "church", "party"].forEach(k => {
      if (overrides[k] && typeof overrides[k] === "object") {
        window.CONFIG[k] = { ...window.CONFIG[k], ...overrides[k] };
      }
    });

    // Galerie
    if (overrides.gallery) {
      if (typeof overrides.gallery.active === "boolean") {
        window.CONFIG.gallery.active = overrides.gallery.active;
      }
      if (Array.isArray(overrides.gallery.photos) && overrides.gallery.photos.length > 0) {
        window.CONFIG.gallery.photos = overrides.gallery.photos;
      }
    }
  } catch { /* Lokal oder KV nicht verfügbar — stillschweigend ignorieren */ }
}

/* ---------- Config auf die Seite anwenden ---------- */
function applyConfig() {
  const c = CONFIG;

  document.title = `${c.babyName}s Taufe`;

  // Hero Vers
  document.querySelector(".hero-verse").textContent = c.verse.text;
  document.querySelector(".hero-verse-source").textContent = c.verse.source;

  // Info Karten
  setText("info-date",           `Sonntag, ${formatDate(c.eventDate)}`);
  setText("info-church-time",    c.church.time);
  setText("info-church-name",    c.church.name);
  setText("info-church-address", c.church.address);
  setText("info-party-time",     c.party.time);
  setText("info-party-name",     c.party.name);
  setText("info-party-address",  c.party.address);
  setText("info-dresscode",      c.dresscode);
  setText("info-deadline-text",  `Bitte meldet euch bis zum <strong>${c.rsvpDeadline}</strong> über das untenstehende Formular an. Wir freuen uns sehr auf euren Besuch!`, true);

  setAttr("info-church-maps", "href", c.church.mapsUrl);
  setAttr("info-party-maps",  "href", c.party.mapsUrl);

  // Footer
  setText("footer-date", `Getauft am ${formatDate(c.eventDate)}`);
}

function setText(id, val, html = false) {
  const el = document.getElementById(id);
  if (!el) return;
  html ? (el.innerHTML = val) : (el.textContent = val);
}
function setAttr(id, attr, val) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(attr, val);
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/* ---------- Navbar ---------- */
function initNavbar() {
  const navbar = document.getElementById("navbar");
  const toggle = document.getElementById("navToggle");
  const links  = document.getElementById("navLinks");

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 60);
  }, { passive: true });

  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", links.classList.contains("open"));
  });

  // Close on link click (mobile)
  links.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });
}

/* ---------- Countdown ---------- */
function initCountdown() {
  const target  = new Date(CONFIG.eventDate).getTime();
  const el      = document.getElementById("countdown");
  const pastEl  = document.getElementById("countdownPast");

  function update() {
    const diff = target - Date.now();
    if (diff <= 0) {
      el.style.display    = "none";
      pastEl.style.display = "block";
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    document.getElementById("days").textContent    = pad(d);
    document.getElementById("hours").textContent   = pad(h);
    document.getElementById("minutes").textContent = pad(m);
    document.getElementById("seconds").textContent = pad(s);
  }

  update();
  setInterval(update, 1000);
}
const pad = n => String(n).padStart(2, "0");

/* ---------- Fade-in Animations ---------- */
function initFadeIn() {
  document.querySelectorAll(".section-header, .info-card, .poll-card, .form, .gallery-placeholder").forEach(el => {
    el.classList.add("fade-in");
  });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });

  document.querySelectorAll(".fade-in").forEach(el => obs.observe(el));
}

/* ---------- RSVP Form ---------- */
function initRsvp() {
  const form    = document.getElementById("rsvpForm");
  const details = document.getElementById("attendanceDetails");
  const success = document.getElementById("rsvpSuccess");
  const submitBtn = document.getElementById("rsvpSubmitBtn");

  // Show/hide attendance details
  form.querySelectorAll('[name="attendance"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const going = radio.value === "yes" && radio.checked;
      details.style.display = going ? "block" : "none";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateRsvpForm(form)) return;

    setSubmitting(submitBtn, true);

    const data = {
      name:       form.elements["name"].value.trim(),
      attendance: form.elements["attendance"].value,
      guests:     form.elements["guests"]?.value || "1",
      allergies:  form.elements["allergies"]?.value.trim() || "",
      message:    form.elements["message"]?.value.trim() || "",
      timestamp:  new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Server error");

      form.style.display   = "none";
      success.style.display = "block";

      const msg = data.attendance === "yes"
        ? `Schön, dass du dabei bist, ${data.name}! 🎉`
        : `Schade, ${data.name}. Wir werden dich vermissen!`;
      document.getElementById("rsvpSuccessMsg").textContent = msg;

    } catch {
      showToast("Fehler beim Senden. Bitte versuche es erneut.", "error");
      setSubmitting(submitBtn, false);
    }
  });
}

function validateRsvpForm(form) {
  let valid = true;

  const name = form.elements["name"].value.trim();
  const nameErr = document.getElementById("error-name");
  if (!name) {
    nameErr.textContent = "Bitte gib deinen Namen ein.";
    valid = false;
  } else {
    nameErr.textContent = "";
  }

  const attendanceErr = document.getElementById("error-attendance");
  const attending = form.elements["attendance"].value;
  if (!attending) {
    attendanceErr.textContent = "Bitte wähle deine Teilnahme aus.";
    valid = false;
  } else {
    attendanceErr.textContent = "";
  }

  return valid;
}

function setSubmitting(btn, submitting) {
  btn.disabled = submitting;
  btn.querySelector(".btn-text").style.display   = submitting ? "none" : "";
  btn.querySelector(".btn-spinner").style.display = submitting ? "" : "none";
}

/* ---------- Polls ---------- */
function initPolls() {
  const container = document.getElementById("pollsContainer");
  if (!container) return;

  CONFIG.polls.forEach(poll => {
    const card = buildPollCard(poll);
    container.appendChild(card);
    loadPollResults(poll.id);
  });
}

function buildPollCard(poll) {
  const card = document.createElement("div");
  card.className = "poll-card fade-in";
  card.dataset.poll = poll.id;

  const q = document.createElement("h3");
  q.className = "poll-question";
  q.textContent = poll.question;
  card.appendChild(q);

  const opts = document.createElement("div");
  opts.className = "poll-options";

  poll.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "poll-option";
    btn.dataset.value = opt.label;
    btn.innerHTML = `
      <span class="poll-emoji">${opt.emoji}</span>
      <span class="poll-label">${opt.label}</span>
      <span class="poll-bar-wrap"><span class="poll-bar-fill" style="width:0%"></span></span>
      <span class="poll-pct">0%</span>
    `;
    btn.addEventListener("click", () => castVote(poll.id, opt.label));
    opts.appendChild(btn);
  });

  card.appendChild(opts);

  const footer = document.createElement("div");
  footer.className = "poll-footer";
  footer.innerHTML = `<span class="poll-total-label">0 Stimmen insgesamt</span><span class="poll-voted-note" style="display:none">✓ Abgestimmt</span>`;
  card.appendChild(footer);

  return card;
}

async function castVote(pollId, value) {
  const card   = document.querySelector(`[data-poll="${pollId}"]`);
  const buttons = card.querySelectorAll(".poll-option");
  const already = localStorage.getItem(`voted_${pollId}`);
  if (already) { showToast("Du hast bereits abgestimmt."); return; }

  buttons.forEach(b => { b.disabled = true; });

  try {
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId, value }),
    });
    if (!res.ok) throw new Error();

    localStorage.setItem(`voted_${pollId}`, value);
    const data = await res.json();
    renderPollResults(pollId, data);
    card.querySelector(".poll-voted-note").style.display = "";
    showToast("Danke für deine Stimme! 🗳️");
  } catch {
    showToast("Fehler. Bitte versuche es erneut.");
    buttons.forEach(b => { b.disabled = false; });
  }
}

async function loadPollResults(pollId) {
  try {
    const res = await fetch(`/api/votes?pollId=${encodeURIComponent(pollId)}`);
    if (!res.ok) return;
    const data = await res.json();
    renderPollResults(pollId, data);

    if (localStorage.getItem(`voted_${pollId}`)) {
      const card = document.querySelector(`[data-poll="${pollId}"]`);
      if (card) {
        card.querySelectorAll(".poll-option").forEach(b => { b.disabled = true; });
        card.querySelector(".poll-voted-note").style.display = "";
      }
    }
  } catch { /* API nicht verfügbar — kein Fehler zeigen */ }
}

function renderPollResults(pollId, data) {
  const card   = document.querySelector(`[data-poll="${pollId}"]`);
  if (!card) return;

  const total  = data.total || 0;
  const counts = data.counts || {};
  let maxVotes = 0;
  Object.values(counts).forEach(v => { if (v > maxVotes) maxVotes = v; });

  card.querySelectorAll(".poll-option").forEach(btn => {
    const label  = btn.dataset.value;
    const votes  = counts[label] || 0;
    const pct    = total > 0 ? Math.round((votes / total) * 100) : 0;
    const isWinner = votes === maxVotes && votes > 0;
    const myVote   = localStorage.getItem(`voted_${pollId}`) === label;

    btn.querySelector(".poll-bar-fill").style.width = `${pct}%`;
    btn.querySelector(".poll-pct").textContent = `${pct}%`;
    btn.classList.toggle("voted",  myVote);
    btn.classList.toggle("winner", isWinner);
  });

  card.querySelector(".poll-total-label").textContent =
    `${total} Stimme${total !== 1 ? "n" : ""} insgesamt`;
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

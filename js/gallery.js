/* =====================================================
   gallery.js — Fotogalerie mit Lightbox
   ===================================================== */

let currentIndex = 0;
let photos = [];

function initGallery() {
  const cfg = CONFIG.gallery;

  if (!cfg.active || cfg.photos.length === 0) {
    // Platzhalter anzeigen, Galerie verstecken
    document.getElementById("gallerySoon").style.display   = "block";
    document.getElementById("galleryActive").style.display = "none";
    return;
  }

  photos = cfg.photos;

  document.getElementById("gallerySoon").style.display   = "none";
  document.getElementById("galleryActive").style.display = "block";

  renderGallery();
  initLightbox();

  document.getElementById("btnDownloadAll").addEventListener("click", downloadAll);
  document.getElementById("galleryCount").textContent = `${photos.length} Foto${photos.length !== 1 ? "s" : ""}`;
}

/* ---------- Gallery Grid ---------- */
function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  grid.innerHTML = "";

  photos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "gallery-item fade-in";
    item.innerHTML = `
      <img src="${escHtml(photo.src)}" alt="${escHtml(photo.caption || `Foto ${index + 1}`)}" loading="lazy">
      <div class="gallery-item-overlay"><span>🔍</span></div>
    `;
    item.addEventListener("click", () => openLightbox(index));
    grid.appendChild(item);
  });

  // Trigger fade-in for newly added items
  requestAnimationFrame(() => {
    grid.querySelectorAll(".fade-in").forEach((el, i) => {
      setTimeout(() => el.classList.add("visible"), i * 60);
    });
  });
}

/* ---------- Lightbox ---------- */
function initLightbox() {
  const lb      = document.getElementById("lightbox");
  const overlay = document.getElementById("lightboxOverlay");

  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev").addEventListener("click", () => navigateLightbox(-1));
  document.getElementById("lightboxNext").addEventListener("click", () => navigateLightbox(1));
  overlay.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (e) => {
    if (lb.style.display === "none") return;
    if (e.key === "Escape")     closeLightbox();
    if (e.key === "ArrowLeft")  navigateLightbox(-1);
    if (e.key === "ArrowRight") navigateLightbox(1);
  });

  // Touch swipe support
  let startX = null;
  lb.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) navigateLightbox(dx < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });
}

function openLightbox(index) {
  currentIndex = index;
  updateLightboxContent();
  const lb = document.getElementById("lightbox");
  lb.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
  document.body.style.overflow = "";
}

function navigateLightbox(dir) {
  currentIndex = (currentIndex + dir + photos.length) % photos.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  const photo = photos[currentIndex];
  const img   = document.getElementById("lightboxImg");
  const cap   = document.getElementById("lightboxCaption");
  const dl    = document.getElementById("lightboxDownload");

  img.src = photo.src;
  img.alt = photo.caption || `Foto ${currentIndex + 1}`;
  cap.textContent = photo.caption
    ? `${photo.caption} — ${currentIndex + 1} / ${photos.length}`
    : `${currentIndex + 1} / ${photos.length}`;

  const filename = photo.src.split("/").pop() || `emma-taufe-${currentIndex + 1}.jpg`;
  dl.href     = photo.src;
  dl.download = filename;

  // Prev/Next Button Sichtbarkeit
  document.getElementById("lightboxPrev").style.display = photos.length > 1 ? "" : "none";
  document.getElementById("lightboxNext").style.display = photos.length > 1 ? "" : "none";
}

/* ---------- Download All ---------- */
async function downloadAll() {
  if (photos.length === 0) return;

  const btn = document.getElementById("btnDownloadAll");
  btn.disabled  = true;
  btn.textContent = "⏳ Wird vorbereitet…";

  // Einzelne Downloads mit kleiner Verzögerung
  for (let i = 0; i < photos.length; i++) {
    const photo    = photos[i];
    const filename = photo.src.split("/").pop() || `emma-taufe-${i + 1}.jpg`;
    const a = document.createElement("a");
    a.href     = photo.src;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    await delay(300);
  }

  btn.disabled    = false;
  btn.textContent = "⬇ Alle herunterladen";
  showToast(`${photos.length} Fotos werden heruntergeladen.`);
}

/* ---------- Utils ---------- */
const delay  = ms => new Promise(r => setTimeout(r, ms));
const escHtml = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

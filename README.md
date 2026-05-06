# Emmas Taufe — Webseite

Elegante Ein-Seiten-Webseite für die Taufe, gehostet auf **Cloudflare Pages**.

## Funktionen

- **Countdown** bis zum Tauftag
- **Informationen** zu Gottesdienst & Feier (Orte, Uhrzeiten, Anfahrt)
- **Anmeldeformular** (RSVP) mit Menüwahl
- **Abstimmung** — zwei Umfragen für die Gäste
- **Fotogalerie** nach der Taufe: Fotos ansehen & herunterladen

---

## Einrichtung (einmalig)

### 1. Repository mit Cloudflare Pages verbinden

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages**
2. GitHub-Repository verbinden
3. Build-Einstellungen:
   - **Framework preset**: None
   - **Build command**: *(leer lassen)*
   - **Build output directory**: `/` (Root)

### 2. KV-Namespace erstellen

1. Cloudflare Dashboard → **Workers & Pages** → **KV** → **Create namespace**
2. Name: `BAPTISM_KV`
3. Pages-Projekt → **Settings** → **Functions** → **KV namespace bindings**
4. Binding hinzufügen:
   - **Variable name**: `BAPTISM_KV`
   - **KV namespace**: den gerade erstellten auswählen

### 3. Admin-Key für RSVP-Liste setzen

1. Pages-Projekt → **Settings** → **Environment variables**
2. Variable hinzufügen:
   - **Name**: `ADMIN_KEY`
   - **Value**: ein langes, zufälliges Passwort (z.B. aus [Bitwarden](https://bitwarden.com/password-generator/))

---

## Webseite anpassen (`js/config.js`)

Alle Texte, Datum und Orte werden in `js/config.js` konfiguriert:

```js
const CONFIG = {
  babyName:    "Emma",
  eventDate:   "2025-06-15T10:00:00",  // Datum & Uhrzeit der Taufe
  rsvpDeadline: "1. Juni 2025",

  church: {
    time:    "10:00 Uhr",
    name:    "Evangelische Kirche",
    address: "Kirchstraße 1, Musterstadt",
    mapsUrl: "https://maps.google.com/?q=...",  // Google Maps Link
  },

  party: {
    time:    "12:30 Uhr",
    name:    "Restaurant Gartenhaus",
    address: "Gartenweg 15, Musterstadt",
    mapsUrl: "https://maps.google.com/?q=...",
  },
  // ...
};
```

---

## Fotos nach der Taufe hinzufügen

1. Fotos in den Ordner `/images/gallery/` hochladen
2. In `js/config.js` die Dateinamen eintragen und Galerie aktivieren:

```js
gallery: {
  active: true,  // ← auf true setzen
  photos: [
    { src: "images/gallery/foto-001.jpg", caption: "Taufgottesdienst" },
    { src: "images/gallery/foto-002.jpg", caption: "Familie" },
    { src: "images/gallery/foto-003.jpg", caption: "Tauffeier" },
  ],
},
```

3. Commit & Push → Cloudflare Pages deployt automatisch

---

## RSVP-Anmeldungen abrufen

Alle eingegangenen Anmeldungen können per Browser abgerufen werden:

```
https://deine-domain.pages.dev/api/rsvp?key=DEIN_ADMIN_KEY
```

Die Antwort ist ein JSON mit allen Anmeldungen, Anzahl Ja/Nein und Menüwahlen.

---

## Lokale Entwicklung (optional)

Mit [Wrangler](https://developers.cloudflare.com/workers/wrangler/) lokal testen:

```bash
npm install -g wrangler
wrangler pages dev . --kv BAPTISM_KV
```

---

## Dateistruktur

```
/
├── index.html              # Hauptseite
├── css/style.css           # Alle Styles
├── js/
│   ├── config.js           # ← HIER anpassen
│   ├── main.js             # Navigation, Countdown, RSVP, Polls
│   └── gallery.js          # Fotogalerie & Lightbox
├── images/gallery/         # Fotos hier ablegen
├── functions/api/
│   ├── rsvp.js             # RSVP API (Cloudflare Pages Function)
│   └── votes.js            # Abstimmungs API
├── _headers                # Sicherheits-Header
└── README.md
```

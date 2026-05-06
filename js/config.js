/**
 * config.js — Alle anpassbaren Einstellungen für die Taufe-Webseite
 * ================================================================
 * Hier alle Texte, Datum, Orte und Fotos eintragen.
 */

window.CONFIG = {

  /* ------ Allgemeine Informationen ------ */
  babyName: "Emma",

  /* Datum der Taufe als ISO-String (YYYY-MM-DDTHH:MM) */
  eventDate: "2025-06-15T10:00:00",

  /* Anmeldefrist */
  rsvpDeadline: "1. Juni 2025",

  /* ------ Gottesdienst ------ */
  church: {
    time:    "10:00 Uhr",
    name:    "Evangelische Kirche",
    address: "Kirchstraße 1, Musterstadt",
    mapsUrl: "https://maps.google.com/?q=Kirchstra%C3%9Fe+1+Musterstadt",
  },

  /* ------ Tauffeier ------ */
  party: {
    time:    "12:30 Uhr",
    name:    "Restaurant Gartenhaus",
    address: "Gartenweg 15, Musterstadt",
    mapsUrl: "https://maps.google.com/?q=Gartenweg+15+Musterstadt",
  },

  dresscode: "Festlich & sommerlich",

  /* ------ Bibelvers im Hero ------ */
  verse: {
    text:   '„Ich habe dich bei deinem Namen gerufen. Du bist mein.“',
    source: "Jesaja 43,1",
  },

  /* ------ Abstimmungs-Fragen ------ */
  polls: [
    {
      id:       "zukunft",
      question: "Was wird Emma einmal werden?",
      options: [
        { emoji: "👩‍⚕️", label: "Ärztin" },
        { emoji: "👩‍🎨", label: "Künstlerin" },
        { emoji: "👩‍🔬", label: "Wissenschaftlerin" },
        { emoji: "👩‍💼", label: "Unternehmerin" },
        { emoji: "🏅",   label: "Sportlerin" },
      ],
    },
    {
      id:       "hobby",
      question: "Welches Hobby wird Emma haben?",
      options: [
        { emoji: "🎵", label: "Musik" },
        { emoji: "⚽", label: "Sport" },
        { emoji: "📚", label: "Lesen" },
        { emoji: "✈️", label: "Reisen" },
        { emoji: "🍳", label: "Kochen" },
      ],
    },
  ],

  /* ------ Fotogalerie ------ */
  gallery: {
    /*
     * active: true  → Galerie wird angezeigt
     * active: false → "Fotos folgen nach der Taufe" Platzhalter wird gezeigt
     *
     * Nach der Taufe:
     *  1. Fotos in den Ordner /images/gallery/ hochladen
     *  2. Dateinamen unten eintragen
     *  3. active: true setzen
     */
    active: false,

    photos: [
      /* Beispiel:
      { src: "images/gallery/foto-001.jpg", caption: "Taufgottesdienst" },
      { src: "images/gallery/foto-002.jpg", caption: "Familie" },
      { src: "images/gallery/foto-003.jpg", caption: "Tauffeier" },
      */
    ],
  },

};

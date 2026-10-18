import type { Settings } from "./types";

export const settings: Settings = {
  // Hora de la ceremonia (Chile en horario de verano, UTC-3). La cuenta regresiva apunta aquí.
  wedding_date: "2026-10-31T18:00:00-03:00",
  // Último día para confirmar (Chile en horario de invierno, UTC-4).
  rsvp_deadline: "2026-08-14T23:59:00-04:00",
  ceremony_place: "Boda eclesiástica",
  ceremony_time: "18:00 hrs",
  ceremony_address: "Av. José Miguel Carrera 3520, Paradero 6, San Miguel",
  party_place: "Full Party",
  party_time: "19:00 a 02:00 hrs",
  party_address: "Chacabuco 389, Maipú, Región Metropolitana",
  google_maps_url:
    "https://www.google.com/maps/search/?api=1&query=Chacabuco+389%2C+Maip%C3%BA%2C+Regi%C3%B3n+Metropolitana",
  waze_url:
    "https://waze.com/ul?q=Chacabuco+389%2C+Maip%C3%BA",
  ceremony_google_maps_url:
    "https://www.google.com/maps/search/?api=1&query=Av.+Jos%C3%A9+Miguel+Carrera+3520%2C+San+Miguel",
  ceremony_waze_url:
    "https://waze.com/ul?q=Av.+Jos%C3%A9+Miguel+Carrera+3520%2C+San+Miguel",
  spotify_playlist_url: "https://open.spotify.com/embed/playlist/3pLPvX6ife6zxKBN8gx4i1",
  main_song_url: "https://archive.org/download/ChristinaPerriAThousandYearsPianoCelloCoverThePianoGuys/Christina%20Perri%20--%20A%20Thousand%20years%20%28Piano_Cello%20Cover%29%20ThePianoGuys.mp3",
  bank_holder_name: "Zequelly Zedimar Blanco Cabezas",
  bank_name: "Banco Santander",
  bank_account_type: "Cuenta de Ahorro",
  bank_account_number: "0 012 04 96303 3",
  bank_rut: "26.026.335-8",
  bank_email: "ZEQUELLYB@GMAIL.COM",
  mercadopago_enabled: process.env.NEXT_PUBLIC_MERCADOPAGO_ENABLED === "true",
  mercadopago_public_url: "",
  mercadopago_link_50k: "https://mpago.la/1PqwEph",
  mercadopago_link_100k: "https://mpago.la/2aWJk5T",
  // Video "save the date" (opcional). Vacío = se salta el video y abre la portada.
  save_the_date_url: "",
};

export function formatWeddingDate(date = settings.wedding_date) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date(date));
}

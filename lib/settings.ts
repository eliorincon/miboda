import type { Settings } from "./types";

export const settings: Settings = {
  wedding_date: "2026-10-31T20:00:00-03:00",
  rsvp_deadline: "2026-08-15",
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
  bank_holder_name: "",
  bank_name: "",
  bank_account_type: "",
  bank_account_number: "",
  bank_rut: "",
  bank_email: "",
  mercadopago_enabled: process.env.NEXT_PUBLIC_MERCADOPAGO_ENABLED === "true",
  mercadopago_public_url: "",
  mercadopago_link_50k: "",
  mercadopago_link_100k: "",
  // Video "save the date" (opcional). Vacío = se salta el video y abre la portada.
  save_the_date_url: "",
};

export function formatWeddingDate(date = settings.wedding_date) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

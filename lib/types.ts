export type GuestStatus = "pending" | "confirmed" | "declined";

/** Cada integrante de una invitación con su confirmación individual */
export type GuestMember = {
  name: string;
  confirmed: boolean;
};

export type Guest = {
  id: string;
  code: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  group_name: string;
  max_guests: number;
  members: GuestMember[];
  status: GuestStatus;
  confirmed_count: number;
  food_restrictions: string;
  message: string;
  has_opened_invitation: boolean;
  opened_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Settings = {
  wedding_date: string;
  rsvp_deadline: string;
  ceremony_place: string;
  ceremony_time: string;
  ceremony_address: string;
  party_place: string;
  party_time: string;
  ceremony_venue: string;
  party_venue: string;
  party_start_time: string;
  party_entry_time: string;
  gift_already_given: string[];
  party_address: string;
  google_maps_url: string;
  waze_url: string;
  ceremony_google_maps_url: string;
  ceremony_waze_url: string;
  spotify_playlist_url: string;
  main_song_url: string;
  bank_holder_name: string;
  bank_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_rut: string;
  bank_email: string;
  mercadopago_enabled: boolean;
  mercadopago_public_url: string;
  mercadopago_link_50k: string;
  mercadopago_link_100k: string;
  save_the_date_url: string;
  // Galería de fotos de los invitados
  photos_enabled: boolean;
  photos_show_in_invitation: boolean;
  photos_open_from: string;
  photos_open_until: string;
  photos_max_per_uploader: number;
  photos_max_total_bytes: number;
  photos_bucket: string;
};

export type PhotoAccessMode = "guest" | "qr" | "admin";
export type PhotoStatus = "pending" | "ready";

export type Photo = {
  id: string;
  guest_id: string | null;
  uploader_name: string;
  uploader_key: string;
  access_mode: PhotoAccessMode;
  status: PhotoStatus;
  storage_path: string;
  thumb_path: string;
  content_type: string;
  size_bytes: number;
  thumb_size_bytes: number;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  created_at: string;
  ready_at: string | null;
};

/** Foto lista para el panel de los novios, con URLs firmadas temporales */
export type AdminPhoto = {
  id: string;
  uploaderName: string;
  accessMode: PhotoAccessMode;
  createdAt: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  thumbUrl: string | null;
  photoUrl: string | null;
};

export type PhotoUploaderCount = { name: string; count: number };

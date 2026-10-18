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
};

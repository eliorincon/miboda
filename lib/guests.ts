import { createSupabaseAdminClient } from "./supabase";
import type { Guest } from "./types";
import { generateCode } from "./utils";
import type {
  CreateGuestInput,
  ImportRowInput,
  RsvpInput,
  UpdateGuestInput,
} from "./validations";

function ts() {
  return new Date().toISOString();
}

export const demoGuests: Guest[] = [
  {
    id: "1",
    code: "familia-rojas-ABC123",
    display_name: "Familia Rojas",
    phone: "+56912345678",
    email: null,
    group_name: "Familia novia",
    max_guests: 2,
    members: [
      { name: "José Rojas", confirmed: false },
      { name: "María Rojas", confirmed: false },
    ],
    status: "pending",
    confirmed_count: 0,
    food_restrictions: "",
    message: "",
    has_opened_invitation: false,
    opened_at: null,
    confirmed_at: null,
    created_at: ts(),
    updated_at: ts(),
  },
  {
    id: "2",
    code: "camila-soto-DEF456",
    display_name: "Camila Soto",
    phone: null,
    email: "camila@example.com",
    group_name: "Amigos",
    max_guests: 2,
    members: [
      { name: "Camila Soto", confirmed: true },
      { name: "Acompañante", confirmed: true },
    ],
    status: "confirmed",
    confirmed_count: 2,
    food_restrictions: "Vegetariana",
    message: "Felices de acompañarlos.",
    has_opened_invitation: true,
    opened_at: ts(),
    confirmed_at: ts(),
    created_at: ts(),
    updated_at: ts(),
  },
  {
    id: "3",
    code: "mario-fernandez-GHI789",
    display_name: "Mario Fernández",
    phone: null,
    email: null,
    group_name: "Familia novio",
    max_guests: 1,
    members: [{ name: "Mario Fernández", confirmed: false }],
    status: "declined",
    confirmed_count: 0,
    food_restrictions: "",
    message: "Les mando todo mi cariño.",
    has_opened_invitation: true,
    opened_at: ts(),
    confirmed_at: null,
    created_at: ts(),
    updated_at: ts(),
  },
];

const memoryGuests = new Map(demoGuests.map((g) => [g.code, { ...g }]));

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getGuestByCode(code: string): Promise<Guest | null> {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("code", code)
      .single();
    if (!error && data) return data as Guest;
  }
  return memoryGuests.get(code) ?? null;
}

export async function listGuests(): Promise<Guest[]> {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .order("group_name")
      .order("display_name");
    if (!error && data) return data as Guest[];
  }
  return Array.from(memoryGuests.values()).sort((a, b) =>
    a.group_name.localeCompare(b.group_name),
  );
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createGuest(input: CreateGuestInput): Promise<Guest> {
  const code = generateCode(input.display_name);
  const now = ts();
  const memberNames = (input.members ?? []).map((n) => n.trim()).filter(Boolean);
  const members = memberNames.map((name) => ({ name, confirmed: false }));
  // Si hay integrantes nombrados, los cupos siguen ese número
  const max_guests = members.length > 0 ? members.length : input.max_guests;
  const payload = {
    code,
    display_name: input.display_name,
    phone: input.phone || null,
    email: input.email || null,
    group_name: input.group_name,
    max_guests,
    members,
    status: "pending" as const,
    confirmed_count: 0,
    food_restrictions: "",
    message: "",
    has_opened_invitation: false,
    opened_at: null,
    confirmed_at: null,
    created_at: now,
    updated_at: now,
  };

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("guests")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Guest;
  }

  const guest: Guest = { ...payload, id: crypto.randomUUID() };
  memoryGuests.set(code, guest);
  return guest;
}

export async function updateGuest(
  id: string,
  input: UpdateGuestInput,
): Promise<Guest> {
  const supabase = createSupabaseAdminClient();

  // Si vienen nombres de integrantes, los convertimos a objetos preservando
  // las confirmaciones existentes que coincidan por nombre.
  let current: Guest | null = null;
  if (input.members) {
    current = await getGuestById(id);
  }

  const { members: memberNames, ...rest } = input;
  const patch: Record<string, unknown> = { ...rest, updated_at: ts() };

  if (memberNames) {
    const prev = current?.members ?? [];
    const confirmedByName = new Map(prev.map((m) => [m.name, m.confirmed]));
    const members = memberNames
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ name, confirmed: confirmedByName.get(name) ?? false }));
    patch.members = members;
    patch.max_guests = members.length || (rest.max_guests ?? 1);
    patch.confirmed_count = members.filter((m) => m.confirmed).length;
    patch.status = patch.confirmed_count
      ? "confirmed"
      : current?.status === "confirmed"
        ? "declined"
        : current?.status ?? "pending";
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("guests")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Guest;
  }

  for (const [code, guest] of memoryGuests.entries()) {
    if (guest.id === id) {
      const updated = { ...guest, ...patch } as Guest;
      memoryGuests.set(code, updated);
      return updated;
    }
  }
  throw new Error("Invitado no encontrado.");
}

async function getGuestById(id: string): Promise<Guest | null> {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("id", id)
      .single();
    if (!error && data) return data as Guest;
    return null;
  }
  for (const guest of memoryGuests.values()) {
    if (guest.id === id) return guest;
  }
  return null;
}

export async function deleteGuest(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("guests").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  for (const [code, guest] of memoryGuests.entries()) {
    if (guest.id === id) {
      memoryGuests.delete(code);
      return;
    }
  }
}

export async function markGuestOpened(code: string): Promise<void> {
  const guest = await getGuestByCode(code);
  if (!guest || guest.has_opened_invitation) return;

  const now = ts();
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    await supabase
      .from("guests")
      .update({ has_opened_invitation: true, opened_at: now, updated_at: now })
      .eq("code", code);
    return;
  }
  memoryGuests.set(code, {
    ...guest,
    has_opened_invitation: true,
    opened_at: now,
    updated_at: now,
  });
}

export async function updateGuestRsvp(input: RsvpInput): Promise<Guest> {
  const guest = await getGuestByCode(input.code);
  if (!guest) throw new Error("No encontramos esta invitación.");

  // Los integrantes confirmados definen el estado y el conteo
  const members = input.members ?? [];
  const confirmed_count = members.filter((m) => m.confirmed).length;
  const status: "confirmed" | "declined" =
    confirmed_count >= 1 ? "confirmed" : "declined";

  const now = ts();
  const patch = {
    members,
    status,
    confirmed_count,
    message: input.message ?? "",
    confirmed_at: status === "confirmed" ? now : null,
    updated_at: now,
  };

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("guests")
      .update(patch)
      .eq("code", input.code)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Guest;
  }

  const updated = { ...guest, ...patch };
  memoryGuests.set(input.code, updated);
  return updated;
}

export async function importGuests(
  rows: ImportRowInput[],
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  for (const row of rows) {
    try {
      const members = (row.members ?? "")
        .split(/[;|]/)
        .map((n) => n.trim())
        .filter(Boolean);
      await createGuest({
        display_name: row.display_name,
        phone: row.phone,
        email: row.email,
        group_name: row.group_name,
        max_guests: row.max_guests,
        members,
      });
      created++;
    } catch (e) {
      errors.push(
        `${row.display_name}: ${e instanceof Error ? e.message : "Error"}`,
      );
    }
  }
  return { created, errors };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getGuestSummary(guests: Guest[]) {
  return {
    total: guests.length,
    totalCupos: guests.reduce((s, g) => s + g.max_guests, 0),
    confirmed: guests.filter((g) => g.status === "confirmed").length,
    pending: guests.filter((g) => g.status === "pending").length,
    declined: guests.filter((g) => g.status === "declined").length,
    confirmedPeople: guests.reduce((s, g) => s + g.confirmed_count, 0),
    opened: guests.filter((g) => g.has_opened_invitation).length,
  };
}

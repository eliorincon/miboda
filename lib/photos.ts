// Galería "Nuestra noche en fotos" — SOLO servidor.
// Nunca importar este archivo desde componentes "use client".
import { randomUUID } from "node:crypto";
import { getPhotoWindowState, settings } from "./settings";
import { createSupabaseAdminClient } from "./supabase";
import type { AdminPhoto, Photo, PhotoAccessMode, PhotoUploaderCount } from "./types";
import { slugify } from "./utils";
import type { PhotoAccessInput, PhotoCompleteInput, PhotoUploadUrlInput } from "./validations";

/** Tiempo de vida de una subida "pendiente" (= vida de la URL firmada de subida) */
const PENDING_TTL_MS = 2 * 60 * 60 * 1000;
/** Tolerancia de `complete` después del cierre, para fotos que empezaron antes */
export const COMPLETE_TOLERANCE_MINUTES = 15;
const READ_URL_SECONDS = 60 * 60;
const DOWNLOAD_URL_SECONDS = 3 * 60 * 60;
const TIME_ZONE = "America/Santiago";

export class PhotoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function db() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new PhotoError("La galería no está configurada.", 503);
  return supabase;
}

function bucket() {
  return db().storage.from(settings.photos_bucket);
}

// ─── Acceso ──────────────────────────────────────────────────────────────────

export function normalizeUploaderName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type PhotoAccess = {
  /** Cómo entró: link personal, QR de la mesa o panel de admin */
  mode: PhotoAccessMode;
  /** Sesión de admin: ignora la ventana horaria y guarda las fotos como prueba */
  isTest: boolean;
  guestId: string | null;
  displayName: string;
  /** Cupos de la invitación (1 en QR y admin) */
  seats: number;
  uploaderKey: string;
  limit: number;
};

type GuestRow = { id: string; display_name: string; max_guests: number };

async function findGuestByCode(code: string): Promise<GuestRow | null> {
  // Consulta directa (sin el modo demo de lib/guests): solo invitados reales
  const { data, error } = await db()
    .from("guests")
    .select("id, display_name, max_guests")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) return null;
  return data as GuestRow;
}

/**
 * Resuelve quién está subiendo. La galería es abierta (evento cerrado): con el
 * link personal se usa la invitación; si no, basta el nombre. Sin ninguno de
 * los dos devuelve null y la página pide el nombre primero.
 */
export async function resolvePhotoAccess(
  input: PhotoAccessInput,
  isAdmin: boolean,
): Promise<PhotoAccess | null> {
  const perPerson = settings.photos_max_per_uploader;
  let access: PhotoAccess | null = null;

  if (input.code) {
    const guest = await findGuestByCode(input.code);
    if (guest) {
      const seats = Math.max(1, guest.max_guests || 1);
      access = {
        mode: "guest",
        isTest: false,
        guestId: guest.id,
        displayName: guest.display_name,
        seats,
        uploaderKey: `guest:${guest.id}`,
        limit: perPerson * seats,
      };
    }
  }
  if (!access && input.uploaderName) {
    // Acceso abierto (QR general o /fotos directo): solo el nombre
    const name = input.uploaderName.trim();
    access = {
      mode: "qr",
      isTest: false,
      guestId: null,
      displayName: name,
      seats: 1,
      uploaderKey: `qr:${normalizeUploaderName(name)}`,
      limit: perPerson,
    };
  }

  if (!access) return null;

  // Con sesión de admin todo es prueba: no gasta el cupo real del invitado
  // y se puede borrar con "Borrar fotos de prueba".
  if (isAdmin) {
    access.isTest = true;
    access.uploaderKey = `test:${access.uploaderKey}`;
    if (input.simular === "limite") access.limit = 3;
  }
  return access;
}

export function assertUploadAllowed(access: PhotoAccess, toleranceMinutes = 0) {
  if (access.isTest) return;
  const state = getPhotoWindowState(new Date(), toleranceMinutes);
  if (state === "disabled")
    throw new PhotoError("Por ahora la subida de fotos no está disponible 💛", 403);
  if (state === "before")
    throw new PhotoError(
      "La subida de fotos se abrirá el sábado 31 de octubre a las 18:00 hrs 💛",
      403,
    );
  if (state === "after")
    throw new PhotoError(
      "La subida de fotos cerró el lunes 2 de noviembre. ¡Gracias por tu cariño! 💛",
      403,
    );
}

function pendingCutoffIso() {
  return new Date(Date.now() - PENDING_TTL_MS).toISOString();
}

/** Fotos que cuentan para el límite: listas + subidas en curso recientes */
export async function countActivePhotos(uploaderKey: string): Promise<number> {
  const { count, error } = await db()
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("uploader_key", uploaderKey)
    .or(`status.eq.ready,created_at.gt.${pendingCutoffIso()}`);
  if (error) throw new PhotoError("No pudimos revisar tus fotos. Intenta de nuevo.", 500);
  return count ?? 0;
}

export async function getRemaining(access: PhotoAccess): Promise<number> {
  if (!Number.isFinite(access.limit)) return Number.POSITIVE_INFINITY;
  const used = await countActivePhotos(access.uploaderKey);
  return Math.max(0, access.limit - used);
}

/** Serializa "sin límite" para JSON/props */
export function remainingForClient(remaining: number): number | null {
  return Number.isFinite(remaining) ? remaining : null;
}

function limitReachedMessage(access: PhotoAccess) {
  const plural = access.mode === "guest" && access.seats > 1;
  return plural
    ? `Ya compartieron sus ${access.limit} fotos 💛 Si les quedaron más que quieran regalarnos, escríbannos por WhatsApp.`
    : `Ya compartiste tus ${access.limit} fotos 💛 Si te quedaron más que quieras regalarnos, escríbenos por WhatsApp.`;
}

export async function assertCapacity(incomingBytes: number) {
  const { data, error } = await db().rpc("photos_total_bytes");
  if (error) throw new PhotoError("No pudimos revisar el espacio disponible. Intenta de nuevo.", 500);
  const total = Number(data ?? 0);
  if (total + incomingBytes > settings.photos_max_total_bytes)
    throw new PhotoError(
      "Ya recibimos todas las fotos que podemos guardar. ¡Gracias por tanto cariño! 💛",
      409,
    );
}

// ─── Subida ──────────────────────────────────────────────────────────────────

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function chileDateFolder(date = new Date()) {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type PendingUpload = {
  photoId: string;
  photoPath: string;
  photoToken: string;
  thumbPath: string;
  thumbToken: string;
};

export async function createPendingUpload(
  access: PhotoAccess,
  input: Pick<PhotoUploadUrlInput, "contentType" | "size" | "thumbSize">,
): Promise<PendingUpload> {
  const remaining = await getRemaining(access);
  if (remaining <= 0) throw new PhotoError(limitReachedMessage(access), 409);
  await assertCapacity(input.size + input.thumbSize);

  const id = randomUUID();
  const folder = chileDateFolder();
  const ext = EXT_BY_TYPE[input.contentType] ?? "jpg";
  const photoPath = `photos/${folder}/${id}.${ext}`;
  const thumbPath = `thumbs/${folder}/${id}.jpg`;

  const storage = bucket();
  const [photoUrl, thumbUrl] = await Promise.all([
    storage.createSignedUploadUrl(photoPath),
    storage.createSignedUploadUrl(thumbPath),
  ]);
  if (photoUrl.error || thumbUrl.error || !photoUrl.data || !thumbUrl.data)
    throw new PhotoError("No pudimos preparar la subida. Intenta de nuevo en un momento.", 502);

  const uploaderName = access.isTest ? `${access.displayName} (prueba)` : access.displayName;
  const { error } = await db()
    .from("photos")
    .insert({
      id,
      guest_id: access.isTest ? null : access.guestId,
      uploader_name: uploaderName,
      uploader_key: access.uploaderKey,
      access_mode: access.isTest ? "admin" : access.mode,
      status: "pending",
      storage_path: photoPath,
      thumb_path: thumbPath,
      content_type: input.contentType,
      size_bytes: input.size,
      thumb_size_bytes: input.thumbSize,
    });
  if (error) throw new PhotoError("No pudimos preparar la subida. Intenta de nuevo en un momento.", 500);

  return {
    photoId: id,
    photoPath,
    photoToken: photoUrl.data.token,
    thumbPath,
    thumbToken: thumbUrl.data.token,
  };
}

export async function completeUpload(
  access: PhotoAccess,
  input: Pick<PhotoCompleteInput, "photoId" | "width" | "height">,
) {
  const supabase = db();
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("id", input.photoId)
    .maybeSingle();
  if (error) throw new PhotoError("No pudimos guardar tu foto. Intenta de nuevo.", 500);
  const row = data as Photo | null;
  if (!row) throw new PhotoError("No encontramos esta foto. Vuelve a elegirla, por favor.", 404);
  if (row.uploader_key !== access.uploaderKey)
    throw new PhotoError("No encontramos esta foto. Vuelve a elegirla, por favor.", 404);
  if (row.status === "ready") return;

  const storage = bucket();
  const { data: exists } = await storage.exists(row.storage_path);
  if (!exists)
    throw new PhotoError("Tu foto todavía no termina de llegar. Vamos a intentarlo de nuevo…", 409);

  let sizeBytes = row.size_bytes;
  const info = await storage.info(row.storage_path);
  if (!info.error && typeof info.data?.size === "number") sizeBytes = info.data.size;

  const { error: updateError } = await supabase
    .from("photos")
    .update({
      status: "ready",
      ready_at: new Date().toISOString(),
      width: input.width ?? null,
      height: input.height ?? null,
      size_bytes: sizeBytes,
    })
    .eq("id", row.id);
  if (updateError) throw new PhotoError("No pudimos guardar tu foto. Intenta de nuevo.", 500);
}

// ─── Panel de los novios ─────────────────────────────────────────────────────

async function signMany(paths: string[], seconds: number) {
  const urls = new Map<string, string>();
  const storage = bucket();
  for (let i = 0; i < paths.length; i += 200) {
    const chunk = paths.slice(i, i + 200);
    const { data } = await storage.createSignedUrls(chunk, seconds);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
    }
  }
  return urls;
}

export type PhotoListResult = {
  photos: AdminPhoto[];
  total: number;
  uploaders: PhotoUploaderCount[];
  people: { guest: number; qr: number };
  totalBytes: number;
  maxBytes: number;
  staleCount: number;
  testCount: number;
};

export async function listPhotos(opts: { offset: number; limit: number; uploader?: string }) {
  const supabase = db();

  // Resumen: todas las filas listas (pocas columnas; son a lo más unos miles)
  const { data: summaryRows, error: summaryError } = await supabase
    .from("photos")
    .select("uploader_name, uploader_key, access_mode, size_bytes, thumb_size_bytes")
    .eq("status", "ready");
  if (summaryError) throw new PhotoError("No pudimos cargar las fotos.", 500);

  const counts = new Map<string, number>();
  const guestKeys = new Set<string>();
  const qrKeys = new Set<string>();
  let totalBytes = 0;
  let testCount = 0;
  for (const r of summaryRows ?? []) {
    counts.set(r.uploader_name, (counts.get(r.uploader_name) ?? 0) + 1);
    totalBytes += (r.size_bytes ?? 0) + (r.thumb_size_bytes ?? 0);
    if (r.access_mode === "guest") guestKeys.add(r.uploader_key);
    else if (r.access_mode === "qr") qrKeys.add(r.uploader_key);
    else testCount += 1;
  }
  const uploaders = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  const { count: staleCount } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", pendingCutoffIso());

  let query = supabase
    .from("photos")
    .select("*", { count: "exact" })
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (opts.uploader) query = query.eq("uploader_name", opts.uploader);
  const { data, count, error } = await query;
  if (error) throw new PhotoError("No pudimos cargar las fotos.", 500);

  const rows = (data ?? []) as Photo[];
  const urls = await signMany(
    rows.flatMap((r) => [r.thumb_path, r.storage_path]),
    READ_URL_SECONDS,
  );

  const result: PhotoListResult = {
    photos: rows.map((r) => ({
      id: r.id,
      uploaderName: r.uploader_name,
      accessMode: r.access_mode,
      createdAt: r.ready_at ?? r.created_at,
      width: r.width,
      height: r.height,
      sizeBytes: r.size_bytes,
      thumbUrl: urls.get(r.thumb_path) ?? null,
      photoUrl: urls.get(r.storage_path) ?? null,
    })),
    total: count ?? 0,
    uploaders,
    people: { guest: guestKeys.size, qr: qrKeys.size },
    totalBytes,
    maxBytes: settings.photos_max_total_bytes,
    staleCount: staleCount ?? 0,
    testCount,
  };
  return result;
}

// ─── Galería pública (invitados): solo ver, sin descargas ────────────────────

export type PublicPhoto = {
  id: string;
  uploaderName: string;
  createdAt: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  photoUrl: string | null;
};

/**
 * Fotos listas, más recientes primero. Las de prueba solo se incluyen para los
 * novios (vista previa); los invitados nunca las ven.
 */
export async function listPublicPhotos(opts: { offset: number; limit: number; includeTest?: boolean }) {
  let query = db()
    .from("photos")
    .select("id, uploader_name, created_at, ready_at, width, height, storage_path, thumb_path", {
      count: "exact",
    })
    .eq("status", "ready");
  if (!opts.includeTest) query = query.neq("access_mode", "admin");
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (error) throw new PhotoError("No pudimos cargar la galería. Intenta de nuevo.", 500);

  const rows = data ?? [];
  const urls = await signMany(
    rows.flatMap((r) => [r.thumb_path, r.storage_path]),
    READ_URL_SECONDS,
  );
  return {
    total: count ?? 0,
    photos: rows.map(
      (r): PublicPhoto => ({
        id: r.id,
        uploaderName: r.uploader_name,
        createdAt: r.ready_at ?? r.created_at,
        width: r.width,
        height: r.height,
        thumbUrl: urls.get(r.thumb_path) ?? null,
        photoUrl: urls.get(r.storage_path) ?? null,
      }),
    ),
  };
}

async function removeObjects(paths: string[]) {
  const storage = bucket();
  for (let i = 0; i < paths.length; i += 100) {
    await storage.remove(paths.slice(i, i + 100));
  }
}

export async function deletePhoto(id: string) {
  const supabase = db();
  const { data } = await supabase
    .from("photos")
    .select("storage_path, thumb_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new PhotoError("Esta foto ya no existe.", 404);
  await removeObjects([data.storage_path, data.thumb_path]);
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) throw new PhotoError("No pudimos eliminar la foto.", 500);
}

export async function deleteTestPhotos() {
  const supabase = db();
  const { data, error } = await supabase
    .from("photos")
    .select("id, storage_path, thumb_path")
    .eq("access_mode", "admin");
  if (error) throw new PhotoError("No pudimos borrar las fotos de prueba.", 500);
  const rows = data ?? [];
  if (!rows.length) return { removed: 0 };
  await removeObjects(rows.flatMap((r) => [r.storage_path, r.thumb_path]));
  const { error: delError } = await supabase.from("photos").delete().eq("access_mode", "admin");
  if (delError) throw new PhotoError("No pudimos borrar las fotos de prueba.", 500);
  return { removed: rows.length };
}

/** Subidas que nunca confirmaron: si la foto llegó se recupera, si no se limpia */
export async function reconcilePendingPhotos() {
  const supabase = db();
  const { data, error } = await supabase
    .from("photos")
    .select("id, storage_path, thumb_path")
    .eq("status", "pending")
    .lt("created_at", pendingCutoffIso());
  if (error) throw new PhotoError("No pudimos revisar las subidas incompletas.", 500);

  const storage = bucket();
  let rescued = 0;
  let removed = 0;
  for (const row of data ?? []) {
    const { data: exists } = await storage.exists(row.storage_path);
    if (exists) {
      await supabase
        .from("photos")
        .update({ status: "ready", ready_at: new Date().toISOString() })
        .eq("id", row.id);
      rescued += 1;
    } else {
      await removeObjects([row.storage_path, row.thumb_path]);
      await supabase.from("photos").delete().eq("id", row.id);
      removed += 1;
    }
  }
  return { rescued, removed };
}

function chileStamp(iso: string) {
  const parts = new Intl.DateTimeFormat("es-CL", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("day")}-${get("hour")}${get("minute")}`;
}

export async function listAllPhotosForDownload() {
  const { data, error } = await db()
    .from("photos")
    .select("storage_path, uploader_name, created_at, ready_at")
    .eq("status", "ready")
    .order("created_at", { ascending: true });
  if (error) throw new PhotoError("No pudimos preparar la descarga.", 500);
  const rows = data ?? [];
  const urls = await signMany(
    rows.map((r) => r.storage_path),
    DOWNLOAD_URL_SECONDS,
  );
  return rows
    .map((r, i) => {
      const ext = r.storage_path.split(".").pop() ?? "jpg";
      const n = String(i + 1).padStart(4, "0");
      const who = slugify(r.uploader_name).slice(0, 40) || "invitado";
      return {
        url: urls.get(r.storage_path) ?? "",
        filename: `${n}_${who}_${chileStamp(r.ready_at ?? r.created_at)}.${ext}`,
      };
    })
    .filter((f) => f.url);
}

export function photoErrorBody(e: unknown) {
  if (e instanceof PhotoError) return { body: { error: e.message }, status: e.status };
  return {
    body: { error: "Parece que la señal está débil. Vamos a intentarlo de nuevo…" },
    status: 500,
  };
}

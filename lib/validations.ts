import { z } from "zod";

export const guestMemberSchema = z.object({
  name: z.string().min(1).max(120),
  confirmed: z.boolean(),
});

export const rsvpSchema = z.object({
  code: z.string().min(2),
  members: z.array(guestMemberSchema).default([]),
  // El mensaje de amor es obligatorio
  message: z
    .string()
    .trim()
    .min(3, "Por favor déjales un mensaje de amor a los novios 💛")
    .max(1000),
});

export const guestMessageSchema = z.object({
  code: z.string().min(2),
  message: z
    .string()
    .trim()
    .min(3, "Escríbenos unas palabras para los novios 💛")
    .max(1000, "El mensaje puede tener hasta 1000 caracteres"),
});

export const createGuestSchema = z.object({
  display_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  phone: z.string().max(20).optional(),
  email: z
    .string()
    .email("Email inválido")
    .max(120)
    .optional()
    .or(z.literal("")),
  group_name: z.string().min(1, "El grupo es obligatorio").max(80),
  max_guests: z.number().int().min(1, "Mínimo 1 cupo").max(20),
  // Nombres de los integrantes, uno por línea (opcional)
  members: z.array(z.string().min(1).max(120)).optional(),
});

export const updateGuestSchema = z.object({
  display_name: z.string().min(2).max(120).optional(),
  // Campos vacíos del formulario se guardan como null
  phone: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().max(20).nullable().optional(),
  ),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("Email inválido").max(120).nullable().optional(),
  ),
  group_name: z.string().min(1).max(80).optional(),
  max_guests: z.number().int().min(1).max(20).optional(),
  // Nombres de los integrantes (uno por elemento); el servidor preserva las
  // confirmaciones existentes que coincidan por nombre.
  members: z.array(z.string().min(1).max(120)).optional(),
  status: z.enum(["pending", "confirmed", "declined"]).optional(),
  confirmed_count: z.number().int().min(0).max(50).optional(),
  food_restrictions: z.string().max(500).optional(),
  message: z.string().max(1000).optional(),
});

export const importRowSchema = z.object({
  display_name: z.string().min(1, "display_name requerido"),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  group_name: z.string().optional().default(""),
  max_guests: z.coerce.number().int().min(1).default(1),
  // Integrantes separados por ";" o "|" — ej: "José Rojas; María Rojas"
  members: z.string().optional().default(""),
});

// ─── Galería de fotos ────────────────────────────────────────────────────────
// El acceso puede venir del link personal (code), del QR (k + nombre) o de la
// cookie de admin; por eso aquí todo es opcional y la ruta decide.
export const photoAccessSchema = z.object({
  code: z.string().trim().min(2).max(120).optional(),
  k: z.string().trim().min(4).max(64).optional(),
  uploaderName: z.string().trim().min(2, "Cuéntanos tu nombre (mínimo 2 letras)").max(60).optional(),
  simular: z.enum(["before", "open", "after", "limite"]).optional(),
});

export const photoMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export const photoUploadUrlSchema = photoAccessSchema.extend({
  contentType: z.enum(photoMimeTypes),
  size: z.number().int().positive().max(15 * 1024 * 1024),
  thumbSize: z.number().int().positive().max(1024 * 1024),
});

export const photoCompleteSchema = photoAccessSchema.extend({
  photoId: z.string().uuid(),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

export type PhotoAccessInput = z.output<typeof photoAccessSchema>;
export type PhotoUploadUrlInput = z.output<typeof photoUploadUrlSchema>;
export type PhotoCompleteInput = z.output<typeof photoCompleteSchema>;

export type RsvpInput = z.output<typeof rsvpSchema>;
export type RsvpFormInput = z.input<typeof rsvpSchema>;
export type CreateGuestInput = z.output<typeof createGuestSchema>;
export type UpdateGuestInput = z.output<typeof updateGuestSchema>;
export type ImportRowInput = z.output<typeof importRowSchema>;

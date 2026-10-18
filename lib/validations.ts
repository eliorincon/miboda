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
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(120).nullable().optional(),
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

export type RsvpInput = z.output<typeof rsvpSchema>;
export type RsvpFormInput = z.input<typeof rsvpSchema>;
export type CreateGuestInput = z.output<typeof createGuestSchema>;
export type UpdateGuestInput = z.output<typeof updateGuestSchema>;
export type ImportRowInput = z.output<typeof importRowSchema>;

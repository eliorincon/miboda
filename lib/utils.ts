import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateCode(displayName: string): string {
  const slug = slugify(displayName).slice(0, 22);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return slug ? `${slug}-${random}` : `invitado-${random}`;
}

export function getInvitationUrl(code: string): string {
  const base =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_SITE_URL ?? "")
      : "";
  if (!base) return `/invitado/${code}`;
  return `${base.replace(/\/$/, "")}/invitado/${code}`;
}

export function generateWhatsAppMessage(
  displayName: string,
  invitationUrl: string,
): string {
  return `Con mucho cariño, Zequelly & Elio quieren invitar a *${displayName}* a celebrar su boda.

Hemos preparado una invitación especial para ustedes:

${invitationUrl}

Por favor confirmen su asistencia desde la invitación.

Con amor,
Zequelly & Elio`;
}

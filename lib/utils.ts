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
  return `Hola *${displayName}* 💛

¡Ya falta muy poco para nuestra boda! Gracias de corazón por confirmar y acompañarnos en este día tan especial.

En tu invitación personal encontrarás toda la información para el gran día: horarios, ubicaciones, dress code, la lluvia de amor y un espacio para dejarnos un mensaje que proyectaremos en las pantallas del salón durante la celebración ✨

${invitationUrl}

¡Te esperamos!
Con amor,
Zequelly & Elio`;
}

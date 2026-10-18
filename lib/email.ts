import type { Guest } from "./types";

/**
 * Envía un correo de notificación cuando un invitado responde su RSVP.
 * Usa Resend (https://resend.com) vía su API REST.
 *
 * Se activa solo si RESEND_API_KEY está configurada; si no, es un no-op
 * (no rompe la confirmación del invitado).
 *
 * Variables de entorno:
 *  - RESEND_API_KEY  (obligatoria para activar el envío)
 *  - NOTIFY_EMAIL    (obligatoria: correo que recibe los avisos)
 *  - RESEND_FROM     (remitente; por defecto el dominio de pruebas de Resend)
 */
export async function sendRsvpNotification(guest: Guest): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // sin configurar → no enviar

  // En minúsculas: Resend (modo prueba) compara exacto con el correo de la cuenta
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) return;
  const to = notifyEmail.toLowerCase();
  const from = process.env.RESEND_FROM || "Invitación Boda <onboarding@resend.dev>";

  const members = guest.members ?? [];
  const confirmed = members.filter((m) => m.confirmed);
  const declined = members.filter((m) => !m.confirmed);
  const isConfirmed = guest.status === "confirmed";

  const subject = isConfirmed
    ? `✅ ${guest.display_name} confirmó (${confirmed.length} ${confirmed.length === 1 ? "persona" : "personas"})`
    : `💌 ${guest.display_name} respondió la invitación`;

  const list = (arr: typeof members) =>
    arr.length
      ? arr.map((m) => `<li style="margin:2px 0;">${escapeHtml(m.name)}</li>`).join("")
      : `<li style="margin:2px 0;color:#999;">—</li>`;

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;background:#F7F3EA;border-radius:18px;overflow:hidden;border:1px solid #e7e2d3;">
    <div style="background:#154D35;padding:24px 28px;text-align:center;">
      <p style="margin:0;color:#A39F88;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Confirmación de asistencia</p>
      <h1 style="margin:6px 0 0;color:#F7F3EA;font-size:26px;">Zequelly &amp; Elio</h1>
    </div>
    <div style="padding:26px 28px;color:#15351f;">
      <p style="font-size:18px;margin:0 0 4px;"><strong>${escapeHtml(guest.display_name)}</strong></p>
      <p style="margin:0 0 18px;color:#837E5E;font-size:14px;">Grupo: ${escapeHtml(guest.group_name || "—")} · Estado:
        <strong style="color:${isConfirmed ? "#154D35" : "#9a6a00"};">${isConfirmed ? "Confirmado" : "No asistirán"}</strong>
      </p>

      <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#154D35;">Asistirán (${confirmed.length})</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;">${list(confirmed)}</ul>

      ${declined.length ? `
      <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#837E5E;">No asistirán (${declined.length})</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#837E5E;">${list(declined)}</ul>` : ""}

      <div style="margin-top:18px;padding:16px 18px;background:#fff;border-radius:12px;border:1px solid #ece7d8;">
        <p style="margin:0 0 6px;font-size:13px;color:#837E5E;text-transform:uppercase;letter-spacing:1px;">Mensaje de amor</p>
        <p style="margin:0;font-size:16px;font-style:italic;color:#15351f;">${guest.message ? escapeHtml(guest.message) : "(sin mensaje)"}</p>
      </div>
    </div>
    <div style="padding:14px 28px;background:#efe9da;text-align:center;color:#A39F88;font-size:12px;">
      Notificación automática · Invitación Zequelly &amp; Elio
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error("Resend email error:", res.status, await res.text());
    }
  } catch (e) {
    console.error("Resend email exception:", e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import { NextResponse } from "next/server";
import { sendRsvpNotification } from "@/lib/email";
import { updateGuestRsvp } from "@/lib/guests";
import { rsvpSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = rsvpSchema.parse(body);
    const guest = await updateGuestRsvp(input);

    // Notificación por correo (no bloquea ni rompe la confirmación si falla)
    await sendRsvpNotification(guest).catch(() => {});

    return NextResponse.json({
      guest,
      message:
        guest.status === "declined"
          ? "Gracias por avisarnos. Aunque nos habría encantado contar con ustedes, agradecemos mucho su cariño y buenos deseos."
          : "Gracias por confirmar. Nos alegra mucho saber que serán parte de este día tan especial.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos guardar tu confirmación." },
      { status: 400 },
    );
  }
}

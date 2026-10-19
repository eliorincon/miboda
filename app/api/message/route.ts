import { NextResponse } from "next/server";
import { saveGuestMessage } from "@/lib/guests";
import { guestMessageSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const parsed = guestMessageSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const guest = await saveGuestMessage(parsed.data.code, parsed.data.message);
    return NextResponse.json({ ok: true, message: guest.message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos guardar tu mensaje." },
      { status: 400 },
    );
  }
}

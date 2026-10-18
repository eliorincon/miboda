import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createGuest, listGuests } from "@/lib/guests";
import { createGuestSchema } from "@/lib/validations";

export async function GET() {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const guests = await listGuests();
  return NextResponse.json({ guests });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    const body = await request.json();
    const input = createGuestSchema.parse(body);
    const guest = await createGuest(input);
    return NextResponse.json({ guest }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al crear invitado." },
      { status: 400 },
    );
  }
}

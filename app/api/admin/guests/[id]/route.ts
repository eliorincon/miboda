import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteGuest, updateGuest } from "@/lib/guests";
import { updateGuestSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const input = updateGuestSchema.parse(body);
    const guest = await updateGuest(id, input);
    return NextResponse.json({ guest });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al actualizar invitado." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  try {
    await deleteGuest(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al eliminar invitado." },
      { status: 400 },
    );
  }
}

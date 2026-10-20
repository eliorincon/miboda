import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { deleteTestPhotos, photoErrorBody } from "@/lib/photos";

export const dynamic = "force-dynamic";

// Borra todas las fotos subidas con la sesión de admin (modo prueba)
export async function DELETE() {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    return NextResponse.json(await deleteTestPhotos());
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

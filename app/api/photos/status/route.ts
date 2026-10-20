import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getRemaining, photoErrorBody, remainingForClient, resolvePhotoAccess } from "@/lib/photos";
import { photoAccessSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// Cuántas fotos le quedan a quien sube (lo usa el modo QR tras escribir el nombre)
export async function POST(request: Request) {
  try {
    const parsed = photoAccessSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const access = await resolvePhotoAccess(parsed.data, await isAdminAuthenticated());
    if (!access) return NextResponse.json({ error: "Este enlace no es válido." }, { status: 403 });

    const remaining = await getRemaining(access);
    return NextResponse.json({
      remaining: remainingForClient(remaining),
      limit: Number.isFinite(access.limit) ? access.limit : null,
      displayName: access.displayName,
    });
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

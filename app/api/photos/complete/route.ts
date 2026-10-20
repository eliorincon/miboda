import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  assertUploadAllowed,
  COMPLETE_TOLERANCE_MINUTES,
  completeUpload,
  getRemaining,
  photoErrorBody,
  remainingForClient,
  resolvePhotoAccess,
} from "@/lib/photos";
import { photoCompleteSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// Confirma que la foto llegó a Storage y la marca como guardada
export async function POST(request: Request) {
  try {
    const parsed = photoCompleteSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "No encontramos esta foto. Vuelve a elegirla, por favor." }, { status: 400 });

    const access = await resolvePhotoAccess(parsed.data, await isAdminAuthenticated());
    if (!access) return NextResponse.json({ error: "Este enlace no es válido." }, { status: 403 });

    assertUploadAllowed(access, COMPLETE_TOLERANCE_MINUTES);
    await completeUpload(access, parsed.data);
    const remaining = await getRemaining(access);
    return NextResponse.json({ ok: true, remaining: remainingForClient(remaining) });
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  assertUploadAllowed,
  createPendingUpload,
  getRemaining,
  photoErrorBody,
  remainingForClient,
  resolvePhotoAccess,
} from "@/lib/photos";
import { photoUploadUrlSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// Entrega las URLs firmadas para que el celular suba la foto directo a Supabase.
// La foto nunca pasa por Vercel (límite de ~4,5 MB por petición).
export async function POST(request: Request) {
  try {
    const parsed = photoUploadUrlSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Por ahora solo podemos recibir fotos 📷" }, { status: 400 });

    const access = await resolvePhotoAccess(parsed.data, await isAdminAuthenticated());
    if (!access) return NextResponse.json({ error: "Este enlace no es válido." }, { status: 403 });

    assertUploadAllowed(access);
    const upload = await createPendingUpload(access, parsed.data);
    const remaining = await getRemaining(access);
    return NextResponse.json({ ...upload, remaining: remainingForClient(remaining) });
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

import { NextResponse } from "next/server";
import { listPublicPhotos, photoErrorBody } from "@/lib/photos";

export const dynamic = "force-dynamic";

// Galería abierta para los invitados: miniaturas y fotos para ver (sin descargas)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit")) || 30));

  try {
    return NextResponse.json(await listPublicPhotos({ offset, limit }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

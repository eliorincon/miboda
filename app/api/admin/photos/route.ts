import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listPhotos, photoErrorBody } from "@/lib/photos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const limit = Math.min(120, Math.max(1, Number(searchParams.get("limit")) || 60));
  const uploader = searchParams.get("uploader")?.trim() || undefined;

  try {
    return NextResponse.json(await listPhotos({ offset, limit, uploader }));
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

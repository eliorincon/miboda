import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listAllPhotosForDownload, photoErrorBody } from "@/lib/photos";

export const dynamic = "force-dynamic";

// Lista de { url, filename } para que el navegador arme los ZIP por partes
export async function GET() {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    return NextResponse.json({ files: await listAllPhotosForDownload() });
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

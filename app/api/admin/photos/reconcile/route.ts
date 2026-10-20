import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { photoErrorBody, reconcilePendingPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

// Recupera o limpia las subidas que nunca confirmaron
export async function POST() {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    return NextResponse.json(await reconcilePendingPhotos());
  } catch (e) {
    const { body, status } = photoErrorBody(e);
    return NextResponse.json(body, { status });
  }
}

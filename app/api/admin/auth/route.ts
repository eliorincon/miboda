import { NextResponse } from "next/server";
import { adminCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json();
  const adminPwd = process.env.ADMIN_PASSWORD;

  if (!adminPwd || password !== adminPwd) {
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const opts = adminCookieOptions(adminPwd);
  response.cookies.set(opts);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: "admin_session", value: "", maxAge: 0, path: "/" });
  return response;
}

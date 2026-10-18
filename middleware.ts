import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Deja pasar el login
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  const cookie = request.cookies.get("admin_session");
  const pwd = process.env.ADMIN_PASSWORD;

  if (!pwd || cookie?.value !== pwd) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

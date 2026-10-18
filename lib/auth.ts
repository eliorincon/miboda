import { cookies } from "next/headers";

const COOKIE = "admin_session";

export async function isAdminAuthenticated(): Promise<boolean> {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return false;
  const store = await cookies();
  return store.get(COOKIE)?.value === pwd;
}

export function adminCookieOptions(password: string) {
  return {
    name: COOKIE,
    value: password,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  };
}

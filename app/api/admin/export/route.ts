import { isAdminAuthenticated } from "@/lib/auth";
import { listGuests } from "@/lib/guests";
import { getInvitationUrl } from "@/lib/utils";
import { NextResponse } from "next/server";

const HEADERS = [
  "display_name",
  "group_name",
  "phone",
  "email",
  "max_guests",
  "members",
  "members_confirmed",
  "status",
  "confirmed_count",
  "message",
  "has_opened_invitation",
  "opened_at",
  "confirmed_at",
  "code",
  "invitation_url",
  "updated_at",
];

export async function GET() {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const guests = await listGuests();

  const rows = guests.map((g) =>
    [
      g.display_name,
      g.group_name,
      g.phone ?? "",
      g.email ?? "",
      g.max_guests,
      (g.members ?? []).map((m) => m.name).join("; "),
      (g.members ?? []).filter((m) => m.confirmed).map((m) => m.name).join("; "),
      g.status,
      g.confirmed_count,
      g.message,
      g.has_opened_invitation ? "Sí" : "No",
      g.opened_at ?? "",
      g.confirmed_at ?? "",
      g.code,
      getInvitationUrl(g.code),
      g.updated_at,
    ]
      .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
      .join(","),
  );

  return new Response([HEADERS.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invitados-zequelly-elio.csv"',
    },
  });
}

import { AdminDashboard } from "@/components/AdminDashboard";
import { listGuests } from "@/lib/guests";

// Siempre datos frescos desde Supabase (nunca prerenderizar/cachear el panel)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const guests = await listGuests();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return <AdminDashboard guests={guests} siteUrl={siteUrl} />;
}

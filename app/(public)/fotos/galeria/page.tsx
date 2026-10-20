import type { Metadata } from "next";
import { PublicGallery } from "@/components/PublicGallery";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "La galería de la noche · Zequelly & Elio",
  robots: { index: false, follow: false },
};

export default async function GaleriaPage() {
  return <PublicGallery isAdminPreview={await isAdminAuthenticated()} />;
}

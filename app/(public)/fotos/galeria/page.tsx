import type { Metadata } from "next";
import { PublicGallery } from "@/components/PublicGallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "La galería de la noche · Zequelly & Elio",
  robots: { index: false, follow: false },
};

export default function GaleriaPage() {
  return <PublicGallery />;
}

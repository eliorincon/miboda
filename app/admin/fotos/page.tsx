import type { Metadata } from "next";
import { AdminPhotoGallery } from "@/components/AdminPhotoGallery";

// Protegida por middleware.ts (/admin/:path*); siempre datos frescos
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Fotos de la noche · Panel",
  robots: { index: false, follow: false },
};

export default function AdminFotosPage() {
  return <AdminPhotoGallery />;
}

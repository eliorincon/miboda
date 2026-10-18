import type { Metadata } from "next";
import { Great_Vibes, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const OG_TITLE = "Zequelly & Elio · Nos casamos";
const OG_DESC =
  "¡Estás invitad@ a nuestra boda! 31 de octubre de 2026. Abre la invitación y confirma tu asistencia con cariño 💛";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: OG_TITLE,
  description: OG_DESC,
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    url: SITE_URL,
    siteName: "Zequelly & Elio",
    locale: "es_CL",
    type: "website",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Zequelly & Elio — Nos casamos el 31 de octubre de 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="es">
      <body className={`${inter.variable} ${playfair.variable} ${greatVibes.variable}`}>
        {children}
      </body>
    </html>
  );
}

"use client";

import { motion } from "framer-motion";
import { ImagePlus, Images } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

/** Código de la invitación personal recordado en este celular (lo guarda /fotos?code=) */
export const GUEST_CODE_STORAGE_KEY = "fotos-boda-code";

const noSubscribe = () => () => {};
function readStoredCode() {
  try {
    return window.localStorage.getItem(GUEST_CODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

type Props = {
  active: "share" | "gallery";
  /** Para mantener el link personal (?code=) al volver a "Subir fotos" */
  shareHref?: string;
};

/** Barra inferior tipo app: Subir fotos / Galería */
export function PhotoTabBar({ active, shareHref }: Props) {
  // Desde la galería no viene el código en la URL: se usa el recordado en el celular
  const storedCode = useSyncExternalStore(noSubscribe, readStoredCode, () => null);
  const uploadHref = shareHref ?? (storedCode ? `/fotos?code=${encodeURIComponent(storedCode)}` : "/fotos");
  const tabs = [
    { id: "share" as const, href: uploadHref, label: "Subir fotos", Icon: ImagePlus },
    { id: "gallery" as const, href: "/fotos/galeria", label: "Galería", Icon: Images },
  ];
  return (
    <nav
      aria-label="Secciones de la galería"
      className="photo-bar fixed inset-x-0 bottom-0 z-40 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5"
    >
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2 px-4">
        {tabs.map(({ id, href, label, Icon }) => {
          const isActive = id === active;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`focus-ring relative flex min-h-12 items-center justify-center gap-2 rounded-full text-[0.9rem] font-semibold transition-colors ${
                isActive ? "text-[#0C1D0E]" : "text-[#E8E4D6] hover:text-[#F7F3EA]"
              }`}
              href={href}
              key={id}
            >
              {isActive ? (
                <motion.span
                  className="absolute inset-0 rounded-full bg-[#F7F3EA] shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
                  layoutId="photo-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon className="relative" size={19} />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

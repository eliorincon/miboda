"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

type VideoSplashProps = {
  onComplete: () => void;
};

/**
 * Overlay UI para el video Save The Date.
 * El elemento <video> lo gestiona HomeClient directamente para que
 * .play() se pueda llamar síncronamente dentro del gesto del usuario
 * (requisito de la política de autoplay de los navegadores).
 */
export function VideoSplash({ onComplete }: VideoSplashProps) {
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowSkip(true), 3000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] pointer-events-none"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* Vignette suave en los bordes */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.38)_100%)]" />

      {/* Botón skip — aparece a los 3 s */}
      <AnimatePresence>
        {showSkip && (
          <motion.button
            animate={{ opacity: 1, y: 0 }}
            aria-label="Saltar intro"
            className="pointer-events-auto absolute bottom-8 right-6 flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md transition hover:bg-white/15 hover:text-white sm:bottom-10 sm:right-8"
            exit={{ opacity: 0, y: 6 }}
            initial={{ opacity: 0, y: 10 }}
            onClick={onComplete}
            transition={{ duration: 0.4 }}
            type="button"
          >
            <SkipForward size={14} />
            Saltar
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

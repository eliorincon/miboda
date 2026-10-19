"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Gift, Heart, X } from "lucide-react";
import { useState } from "react";
import { GiftDetails } from "./GiftDetails";
import type { Settings } from "@/lib/types";

type GiftModalProps = {
  settings: Settings;
};

export function GiftModal({ settings }: GiftModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Tarjeta única: abre el modal con transferencia + MercadoPago */}
      <button
        className="gift-card group mx-auto max-w-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        <div className="gift-card-icon">
          <Gift size={24} strokeWidth={1.4} />
        </div>
        <p className="gift-card-title">Regalar a los novios</p>
        <p className="gift-card-desc">Transferencia o MercadoPago, lo que más te acomode</p>
        <span className="gift-card-cta">Quiero regalar →</span>
      </button>

      {/* Modal popup de transferencia */}
      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            transition={{ duration: 0.22 }}
          >
            <motion.div
              animate={{ y: 0, opacity: 1, scale: 1 }}
              className="flex max-h-[calc(100dvh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] shadow-2xl"
              exit={{ y: 20, opacity: 0, scale: 0.96 }}
              initial={{ y: 20, opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Header verde — fijo, con X siempre visible */}
              <div className="relative flex-shrink-0 bg-[#154D35] px-7 pb-6 pt-7 text-center">
                <button
                  aria-label="Cerrar"
                  className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#F7F3EA]/12 text-[#F7F3EA] transition hover:bg-[#F7F3EA]/25"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <X size={17} />
                </button>
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-[#A39F88]/40 bg-[#0C1D0E]/30">
                  <Heart className="text-[#A39F88]" size={22} strokeWidth={1.4} />
                </div>
                <h3 className="font-display text-2xl text-[#F7F3EA]">Lluvia de amor</h3>
                <p className="mt-1 text-sm text-[#A39F88]">Transferencia o MercadoPago</p>
                <div className="gold-line mx-auto mt-4 w-24" />
              </div>

              {/* Cuerpo marfil — scrollable */}
              <div className="flex-1 overflow-y-auto bg-[#F7F3EA] px-7 py-6">
                <GiftDetails settings={settings} />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

const details = [
  "Si no nos acompañas en la ceremonia, llega a la celebración con 20 minutos de anticipación. La entrada al salón comienza a las 18:40 hrs.",
  "Respetar el dress code: elegante formal.",
  "Con cariño, hemos pensado esta celebración como una noche solo para adultos.",
  "Evitar publicar fotos o videos antes de que los novios compartan los suyos.",
];

// Número de contacto en formato internacional sin "+" (ej. 569XXXXXXXX).
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "56963434353";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Hola%2C%20tengo%20una%20consulta%20sobre%20la%20boda%20de%20Zequelly%20%26%20Elio%20%F0%9F%92%9B`;

export function InfoPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="focus-ring rounded-full border border-[#837E5E]/60 px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#F7F3EA] transition hover:bg-[#F7F3EA] hover:text-[#0C1D0E]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Información importante
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <motion.div
              animate={{ y: 0, opacity: 1, scale: 1 }}
              className="ivory-panel botanical w-full max-w-lg rounded-[1.6rem] p-7"
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              initial={{ y: 16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-start justify-between gap-6">
                <h3 className="font-display text-3xl text-[#154D35]">
                  Antes de acompañarnos
                </h3>
                <button
                  aria-label="Cerrar información"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#837E5E]/30 transition hover:bg-[#154D35]/5"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <ul className="mt-5 space-y-3 text-sm leading-6">
                {details.map((detail) => (
                  <li className="flex gap-3 text-left" key={detail}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#837E5E]" />
                    <span className="text-[#15351f]">{detail}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {WHATSAPP_NUMBER ? (
                <a
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5c]"
                  href={WHATSAPP_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  {/* WhatsApp icon SVG */}
                  <svg fill="currentColor" height="17" viewBox="0 0 24 24" width="17" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Escribirnos por WhatsApp
                </a>
                ) : null}
                <button
                  className="flex-1 rounded-full bg-[#154D35] px-5 py-3 text-sm font-semibold text-[#F7F3EA] transition hover:bg-[#0C1D0E]"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Gift, Heart, Sparkles, X } from "lucide-react";
import { useState } from "react";
import type { Settings } from "@/lib/types";

type GiftModalProps = {
  settings: Settings;
};

export function GiftModal({ settings }: GiftModalProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const bankDetails = [
    ["Titular", settings.bank_holder_name],
    ["Banco", settings.bank_name],
    ["Tipo de cuenta", settings.bank_account_type],
    ["N.° de cuenta", settings.bank_account_number],
    ["RUT", settings.bank_rut],
    ["Correo", settings.bank_email],
  ].filter(([, value]) => value);
  const hasMercadoPago = Boolean(
    settings.mercadopago_link_50k || settings.mercadopago_link_100k,
  );

  const copy = async () => {
    await navigator.clipboard.writeText(
      bankDetails.map(([label, value]) => `${label}: ${value}`).join("\n"),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  };

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
                <div className="divide-y divide-[#837E5E]/18">
                  {bankDetails.map(([label, value]) => (
                    <div className="flex items-center justify-between gap-4 py-3.5" key={label}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#837E5E]">
                        {label}
                      </span>
                      <span className="overflow-wrap-anywhere text-right text-sm font-medium text-[#15351f]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Botón copiar (solo si hay datos de transferencia) */}
                {bankDetails.length > 0 ? (
                <button
                  className="mt-6 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-full bg-[#154D35] px-5 py-3.5 font-semibold text-[#F7F3EA] transition active:scale-[0.98]"
                  onClick={copy}
                  type="button"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2"
                        exit={{ opacity: 0, y: -8 }}
                        initial={{ opacity: 0, y: 8 }}
                        key="copied"
                        transition={{ duration: 0.2 }}
                      >
                        <Check size={16} />
                        ¡Copiado con amor!
                      </motion.span>
                    ) : (
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2"
                        exit={{ opacity: 0, y: -8 }}
                        initial={{ opacity: 0, y: 8 }}
                        key="copy"
                        transition={{ duration: 0.2 }}
                      >
                        <Copy size={16} />
                        Copiar todos los datos
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                ) : null}

                {/* ── MercadoPago: montos sugeridos ── */}
                {hasMercadoPago ? (
                <>
                <div className="mt-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#837E5E]/20" />
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#837E5E]">
                    <Sparkles size={13} />
                    o regala con MercadoPago
                  </span>
                  <div className="h-px flex-1 bg-[#837E5E]/20" />
                </div>

                <p className="mt-4 text-center text-sm leading-6 text-[#15351f]">
                  Si prefieres aportar al instante con tarjeta o saldo, elige un monto
                  y completa el pago en segundos. ¡Cada gesto nos llena el corazón!
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <a
                    className="group flex flex-col items-center gap-1.5 rounded-2xl border border-[#154D35]/15 bg-white px-4 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[#154D35]/40 hover:shadow-md active:scale-[0.98]"
                    href={settings.mercadopago_link_50k}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Gift className="text-[#154D35] transition group-hover:scale-110" size={22} strokeWidth={1.5} />
                    <span className="font-display text-xl text-[#154D35]">$50.000</span>
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#837E5E]">
                      Un cariño dulce
                    </span>
                  </a>
                  <a
                    className="group flex flex-col items-center gap-1.5 rounded-2xl border border-[#154D35]/15 bg-white px-4 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[#154D35]/40 hover:shadow-md active:scale-[0.98]"
                    href={settings.mercadopago_link_100k}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Heart className="text-[#154D35] transition group-hover:scale-110" size={22} strokeWidth={1.5} />
                    <span className="font-display text-xl text-[#154D35]">$100.000</span>
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#837E5E]">
                      Un abrazo enorme
                    </span>
                  </a>
                </div>
                </>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

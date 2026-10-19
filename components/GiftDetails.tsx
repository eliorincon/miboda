"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Gift, Heart, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Settings } from "@/lib/types";

type GiftDetailsProps = {
  settings: Settings;
};

/** Datos de transferencia + links de MercadoPago (usado en el modal de regalo y en la tarjeta del invitado) */
export function GiftDetails({ settings }: GiftDetailsProps) {
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
    </>
  );
}

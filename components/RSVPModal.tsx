"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Guest, GuestMember } from "@/lib/types";

type RSVPModalProps = {
  guest: Guest | null;
  isOpen: boolean;
  onClose: () => void;
};

function buildGreeting(displayName: string): string {
  const name = displayName.trim();
  const lower = name.toLowerCase();
  if (lower.startsWith("familia")) return `¡Hola, ${name}!`;
  return `¡Hola, ${name}!`;
}

/** Genera la lista inicial de integrantes (usa los nombres si existen) */
function initialMembers(guest: Guest): GuestMember[] {
  if (guest.members && guest.members.length > 0) {
    return guest.members.map((m) => ({ name: m.name, confirmed: m.confirmed }));
  }
  // Fallback para invitaciones sin nombres cargados
  if (guest.max_guests <= 1) {
    return [{ name: guest.display_name, confirmed: guest.status === "confirmed" }];
  }
  return Array.from({ length: guest.max_guests }, (_, i) => ({
    name: `Invitado ${i + 1}`,
    confirmed: false,
  }));
}

// ─── Inner form (only mounted when modal is open) ─────────────────────────────
function RSVPFormInner({ guest, onClose }: { guest: Guest; onClose: () => void }) {
  const [members, setMembers] = useState<GuestMember[]>(() => initialMembers(guest));
  const [message, setMessage] = useState(guest.message ?? "");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalConfirmed, setFinalConfirmed] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const confirmedCount = useMemo(
    () => members.filter((m) => m.confirmed).length,
    [members],
  );
  const messageError = message.trim().length < 3;

  const toggle = (index: number) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, confirmed: !m.confirmed } : m)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (messageError) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: guest.code, members, message: message.trim() }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setServerError(payload.error ?? "No pudimos guardar tu confirmación.");
        setSubmitting(false);
        return;
      }
      setFinalConfirmed(confirmedCount);
      setSubmitted(true);
    } catch {
      setServerError("Hubo un problema de conexión. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  };

  // ── Pantalla de agradecimiento ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#154D35]/12">
          <Heart className="text-[#154D35]" size={28} strokeWidth={1.6} />
        </div>
        <p className="font-script text-4xl text-[#154D35]">¡Gracias de corazón!</p>
        <div className="gold-line mx-auto my-5 w-24" />
        <p className="leading-8 text-[#15351f]">
          {finalConfirmed >= 1
            ? "Nos llena de felicidad saber que estarán con nosotros en este día tan especial. ¡Su compañía lo es todo!"
            : "Gracias por avisarnos y por sus lindas palabras. Aunque nos habría encantado tenerlos, llevamos su cariño con nosotros."}
        </p>
        <p className="font-script mt-6 text-3xl text-[#154D35]">Con amor, Zequelly &amp; Elio</p>
        <button
          className="mt-8 rounded-full border border-[#837E5E]/40 px-6 py-3 text-sm font-semibold text-[#15351f] transition hover:bg-[#154D35]/5"
          onClick={onClose}
          type="button"
        >
          Cerrar
        </button>
      </div>
    );
  }

  // ── Formulario ──────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit}>
      {/* Saludo personalizado */}
      <p className="font-script text-4xl leading-snug text-[#154D35]">
        {buildGreeting(guest.display_name)}
      </p>
      <div className="gold-line mt-4 w-24" />
      <p className="mt-5 text-sm leading-7 text-[#15351f]">
        Los queremos muchísimo y nos haría inmensamente felices celebrar este día tan
        especial junto a ustedes. Su compañía es uno de los regalos más bonitos que
        podríamos recibir. 💛
      </p>

      {/* Confirmación por integrante */}
      <div className="mt-7">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#15351f]">
          <Sparkles className="text-[#837E5E]" size={15} />
          ¿Quiénes nos acompañarán?
        </p>
        <p className="mt-1 text-xs text-[#837E5E]">
          Toca cada nombre para confirmar. Pueden venir todos o solo algunos.
        </p>
        <div className="mt-3 space-y-2.5">
          {members.map((m, i) => {
            const active = m.confirmed;
            return (
              <button
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  active
                    ? "border-[#154D35] bg-[#154D35] text-[#F7F3EA]"
                    : "border-[#837E5E]/30 bg-white text-[#15351f] hover:border-[#154D35]/50"
                }`}
                key={`${m.name}-${i}`}
                onClick={() => toggle(i)}
                type="button"
              >
                <span className="font-medium">{m.name}</span>
                <span
                  className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border transition ${
                    active
                      ? "border-[#F7F3EA] bg-[#F7F3EA] text-[#154D35]"
                      : "border-[#837E5E]/40 text-transparent"
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-xs text-[#837E5E]">
          {confirmedCount === 0
            ? "Aún no has marcado a nadie."
            : confirmedCount === 1
              ? "1 persona confirmada."
              : `${confirmedCount} personas confirmadas.`}
        </p>
      </div>

      {/* Mensaje de amor — obligatorio */}
      <label className="mt-6 block text-sm font-semibold text-[#15351f]">
        Déjanos un mensaje de amor <span className="text-[#154D35]">*</span>
        <textarea
          className={`mt-2 min-h-28 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-[#15351f] outline-none transition focus:border-[#154D35] ${
            touched && messageError ? "border-red-400" : "border-[#837E5E]/30"
          }`}
          onBlur={() => setTouched(true)}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escríbeles unas palabras bonitas a los novios…"
          value={message}
        />
      </label>
      {touched && messageError && (
        <p className="mt-1.5 text-xs text-red-600">
          Por favor déjales un mensaje de amor a los novios 💛
        </p>
      )}

      {serverError && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <button
        className="mt-6 w-full rounded-full bg-[#154D35] px-6 py-4 text-sm font-semibold text-[#F7F3EA] transition hover:bg-[#0C1D0E] disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Guardando con cariño…" : "Confirmar"}
      </button>
    </form>
  );
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────
export function RSVPModal({ guest, isOpen, onClose }: RSVPModalProps) {
  // Bloquear scroll cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] bg-[#0C1D0E]/72 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            transition={{ duration: 0.3 }}
          />

          {/* Modal card */}
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="fixed inset-x-3 bottom-0 top-[env(safe-area-inset-top,12px)] z-[61] mx-auto my-auto flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-[#F7F3EA] shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2"
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header verde */}
            <div className="relative flex-shrink-0 bg-[#154D35] px-6 py-5 sm:px-8 sm:py-6">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full border border-[#F7F3EA]/30">
                  <Heart className="text-[#F7F3EA]" size={15} strokeWidth={1.5} />
                </div>
                <h2 className="font-display text-xl text-[#F7F3EA] sm:text-2xl">
                  Confirma tu asistencia
                </h2>
              </div>
              <div className="gold-line mt-3 w-32" />
              {/* X close */}
              <button
                aria-label="Cerrar"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#F7F3EA]/70 transition hover:bg-[#F7F3EA]/10 hover:text-[#F7F3EA] sm:right-5 sm:top-5"
                onClick={onClose}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
              {guest ? (
                <RSVPFormInner guest={guest} onClose={onClose} />
              ) : (
                /* Sin link personalizado */
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="mb-5 grid h-16 w-16 place-items-center rounded-full border border-[#837E5E]/30 bg-[#154D35]/6">
                    <Heart className="text-[#154D35]" size={28} strokeWidth={1.4} />
                  </div>
                  <p className="font-display text-xl text-[#154D35]">¡Nos alegra tu interés!</p>
                  <div className="gold-line mx-auto my-4 w-20" />
                  <p className="leading-7 text-[#15351f]">
                    Para confirmar asistencia, usa el{" "}
                    <strong>link personalizado</strong> que te enviamos por WhatsApp. Cada link
                    está preparado especialmente para ti.
                  </p>
                  <p className="mt-4 text-sm text-[#837E5E]">
                    ¿No lo encuentras? Escríbenos y con gusto te lo reenviamos con todo el cariño.
                  </p>
                  <button
                    className="mt-7 rounded-full bg-[#154D35] px-6 py-3 text-sm font-semibold text-[#F7F3EA] transition hover:bg-[#0C1D0E]"
                    onClick={onClose}
                    type="button"
                  >
                    Entendido
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

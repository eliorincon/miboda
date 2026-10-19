"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  Clock,
  Gift,
  Heart,
  Map,
  MessageSquareHeart,
  Moon,
  Shirt,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { GiftDetails } from "./GiftDetails";
import type { Guest, Settings } from "@/lib/types";

type GuestInfoCardProps = {
  guest: Guest;
  settings: Settings;
  hideGifts?: boolean;
  isOpen: boolean;
  onClose: () => void;
};

// Días de calendario (hora de Chile) entre hoy y la boda
function daysUntil(target: string) {
  const day = (d: Date) =>
    Date.parse(d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" }));
  return Math.round((day(new Date(target)) - day(new Date())) / 86_400_000);
}

function countdownLabel(days: number) {
  if (days <= 0) return "¡Hoy es el gran día!";
  if (days === 1) return "¡Mañana es el gran día!";
  return `¡Faltan ${days} días para el gran día!`;
}

function InfoBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="py-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#154D35]/8 text-[#154D35]">
          {icon}
        </span>
        <h4 className="font-display text-xl text-[#154D35]">{title}</h4>
      </div>
      <div className="mt-3 text-sm leading-6 text-[#15351f]">{children}</div>
    </div>
  );
}

export function GuestInfoCard({ guest, settings, hideGifts = false, isOpen, onClose }: GuestInfoCardProps) {
  const [message, setMessage] = useState(guest.message ?? "");
  const [savedMessage, setSavedMessage] = useState(guest.message ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const days = daysUntil(settings.wedding_date);

  const places = [
    {
      label: `Ceremonia: ${settings.ceremony_venue}`,
      time: settings.ceremony_time,
      address: settings.ceremony_address,
      maps: settings.ceremony_google_maps_url,
    },
    {
      label: `Celebración: ${settings.party_venue}`,
      time: `Inicio ${settings.party_start_time} · Puertas abiertas desde las ${settings.party_entry_time}`,
      address: settings.party_address,
      maps: settings.google_maps_url,
    },
  ];

  const sendMessage = async () => {
    setError("");
    if (message.trim().length < 3) {
      setError("Escríbenos unas palabras para los novios 💛");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: guest.code, message }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No pudimos guardar tu mensaje.");
      setSavedMessage(message.trim());
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar tu mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={onClose}
          transition={{ duration: 0.22 }}
        >
          <motion.div
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] shadow-2xl"
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header verde con cuenta regresiva y agradecimiento */}
            <div className="relative flex-shrink-0 bg-[#154D35] px-7 pb-6 pt-7 text-center">
              <button
                aria-label="Cerrar"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#F7F3EA]/12 text-[#F7F3EA] transition hover:bg-[#F7F3EA]/25"
                onClick={onClose}
                type="button"
              >
                <X size={17} />
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A39F88]">
                Hola, {guest.display_name}
              </p>
              <h3 className="font-display mt-2 text-2xl text-[#F7F3EA] sm:text-3xl">
                {countdownLabel(days)}
              </h3>
              <div className="gold-line mx-auto mt-4 w-24" />
              <p className="mt-4 text-sm leading-6 text-[#E2E5E2]">
                Gracias de corazón por acompañarnos. Que estés con nosotros hace este día
                todavía más especial.
              </p>
              <p className="mt-3 text-xs leading-5 text-[#A39F88]">
                Desliza hasta el final de la información: allí encontrarás un espacio para
                dejarnos un mensaje 💌
              </p>
            </div>

            {/* Cuerpo marfil — scrollable */}
            <div className="flex-1 divide-y divide-[#837E5E]/18 overflow-y-auto bg-[#F7F3EA] px-6 sm:px-7">
              <InfoBlock icon={<Map size={16} />} title="Dónde nos vemos">
                <div className="grid gap-3 sm:grid-cols-2">
                  {places.map((p) => (
                    <div className="flex flex-col gap-2 rounded-2xl border border-[#837E5E]/20 bg-white/70 p-4" key={p.label}>
                      <p className="font-semibold text-[#154D35]">{p.label}</p>
                      <p className="text-xs font-semibold text-[#837E5E]">{p.time}</p>
                      <p className="flex-1 text-sm leading-5">{p.address}</p>
                      <a
                        className="focus-ring mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#154D35] px-4 py-2.5 text-sm font-semibold text-[#F7F3EA] transition hover:bg-[#0C1D0E]"
                        href={p.maps}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Map size={15} />
                        Google Maps
                      </a>
                    </div>
                  ))}
                </div>
              </InfoBlock>

              <InfoBlock icon={<Clock size={16} />} title="Horario de llegada">
                <div className="rounded-2xl border border-[#154D35]/25 bg-[#154D35]/6 p-4">
                  <p>
                    La celebración comienza a las <strong>{settings.party_start_time}</strong>.
                    Si no nos acompañas en la ceremonia, te pedimos{" "}
                    <strong>llegar con 20 minutos de anticipación</strong>.
                  </p>
                  <p className="mt-2">
                    El salón abre sus puertas para el ingreso de los invitados a partir de las{" "}
                    <strong>{settings.party_entry_time}</strong>.
                  </p>
                </div>
              </InfoBlock>

              <InfoBlock icon={<Shirt size={16} />} title="Dress code: elegante formal">
                <p>
                  Queremos que todos luzcan increíbles en las fotos y en cada recuerdo. Te pedimos
                  con cariño respetar el código de vestimenta <strong>elegante formal</strong>.
                </p>
              </InfoBlock>

              <InfoBlock icon={<Moon size={16} />} title="Una noche para adultos">
                <p>
                  Con todo nuestro cariño, hemos pensado esta celebración como una noche solo para
                  adultos. Gracias por comprenderlo y por regalarte esta noche para disfrutar con
                  nosotros.
                </p>
              </InfoBlock>

              <InfoBlock icon={<Camera size={16} />} title="Fotos y videos">
                <p>
                  Te pedimos evitar publicar fotos o videos de la boda en redes sociales antes de
                  que nosotros compartamos los nuestros. ¡Gracias por cuidar este momento!
                </p>
              </InfoBlock>

              {!hideGifts && (
                <InfoBlock icon={<Gift size={16} />} title="Lluvia de amor">
                  <p className="mb-2">
                    Tu presencia es lo que más nos importa. Pero si deseas tener un detalle especial
                    con nosotros, puedes hacerlo así:
                  </p>
                  <GiftDetails settings={settings} />
                </InfoBlock>
              )}

              <InfoBlock icon={<MessageSquareHeart size={16} />} title="Un mensaje para los novios">
                <p>
                  Este mensaje es muy importante para nosotros:{" "}
                  <strong>lo proyectaremos en las pantallas del salón durante la celebración</strong>.
                  Escríbelo con todo el cariño 💛
                </p>
                <textarea
                  className="mt-3 min-h-28 w-full resize-y rounded-2xl border border-[#837E5E]/35 bg-white px-4 py-3 text-sm text-[#15351f] outline-none transition placeholder:text-[#A39F88] focus:border-[#154D35]/60"
                  maxLength={1000}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe aquí tus buenos deseos para Zequelly y Elio…"
                  value={message}
                />
                {error ? <p className="mt-2 text-sm text-[#a33a2b]">{error}</p> : null}
                <button
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#154D35] px-5 py-3.5 font-semibold text-[#F7F3EA] transition hover:bg-[#0C1D0E] active:scale-[0.98] disabled:opacity-60"
                  disabled={sending || message.trim() === savedMessage}
                  onClick={sendMessage}
                  type="button"
                >
                  {justSaved ? (
                    <>
                      <Check size={16} />
                      ¡Mensaje guardado con amor!
                    </>
                  ) : (
                    <>
                      <Heart size={16} />
                      {sending
                        ? "Enviando…"
                        : savedMessage
                          ? "Actualizar mi mensaje"
                          : "Enviar mi mensaje"}
                    </>
                  )}
                </button>
                {savedMessage && !justSaved ? (
                  <p className="mt-2 text-center text-xs text-[#837E5E]">
                    Ya recibimos tu mensaje. Puedes editarlo cuando quieras.
                  </p>
                ) : null}
              </InfoBlock>

              <div className="py-6 text-center">
                <p className="font-script text-3xl text-[#837E5E]">Con amor</p>
                <p className="font-script text-4xl text-[#154D35]">Zequelly y Elio</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

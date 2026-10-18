"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Heart, MailCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Countdown } from "./Countdown";
import { Footer } from "./Footer";
import { GiftModal } from "./GiftModal";
import { InfoPopup } from "./InfoPopup";
import { IntroScreen } from "./IntroScreen";
import { MapButtons } from "./MapButtons";
import { MusicPlayer } from "./MusicPlayer";
import { RSVPModal } from "./RSVPModal";
import { VideoSplash } from "./VideoSplash";
import { Section } from "./Section";
import { SpotifyPlaylist } from "./SpotifyPlaylist";
import { WeddingDetails } from "./WeddingDetails";
import type { Guest, Settings } from "@/lib/types";

type HomeClientProps = {
  settings: Settings;
  dateLabel: string;
  guest?: Guest | null;
};

const heroSlides = [
  {
    image: "/hero1.webp",
    bgPosition: "center 38%",
    title: "Una historia que comienza para siempre",
    phrase: "Cada momento compartido nos trajo hasta este día.",
  },
  {
    image: "/hero2.webp",
    bgPosition: "center 30%",
    title: "Dos vidas que se hacen una sola",
    phrase: "Un amor que eligió quedarse, crecer y celebrar.",
  },
  {
    image: "/antepag.webp",
    bgPosition: "center 36%",
    title: "Celebra con nosotros",
    phrase: "Una noche para abrazar la alegría y guardar recuerdos.",
  },
];

type Phase = "intro" | "video" | "entered";

export function HomeClient({ settings, dateLabel, guest = null }: HomeClientProps) {
  // Nuevo flujo: el video arranca de inmediato ("video"); al segundo 10
  // aparece la portada "Abrir nuestra historia" sobre el video ("intro");
  // al hacer click se entra a la web y suena la música ("entered").
  // Si no hay video configurado, empezamos directo en la portada.
  const [phase, setPhase] = useState<Phase>(
    settings.save_the_date_url ? "video" : "intro",
  );
  const [activeSlide, setActiveSlide] = useState(0);
  const [rsvpOpen, setRsvpOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const entered = phase === "entered";
  const videoVisible = phase === "video" || phase === "intro";

  // Autoplay del video al cargar la página. Al estar silenciado (muted),
  // los navegadores permiten la reproducción automática sin gesto previo.
  // El atributo autoPlay hace el trabajo principal; este play() es respaldo.
  // Un timer de 10s garantiza que la portada aparezca aunque el video
  // se demore en cargar o el navegador throttlee onTimeUpdate.
  useEffect(() => {
    if (phase !== "video") return;
    videoRef.current?.play().catch(() => {
      /* autoPlay + el timer se encargan; no saltamos por un rechazo transitorio */
    });
    const timer = window.setTimeout(() => {
      setPhase((p) => (p === "video" ? "intro" : p));
    }, 10_000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!entered) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [entered]);

  const slide = heroSlides[activeSlide];

  return (
    <>
      {/* ── Video Save The Date ─────────────────────────────────────────────
          Arranca solo al cargar (muted → autoplay permitido). Permanece como
          fondo durante la portada ("intro") y se oculta al entrar a la web.
          Al segundo 10 disparamos la aparición de la portada encima del video.
      ─────────────────────────────────────────────────────────────────── */}
      {settings.save_the_date_url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          autoPlay
          className={`fixed inset-0 z-[40] h-full w-full bg-black object-cover transition-opacity duration-700 ease-in-out ${
            videoVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          loop
          muted
          onError={() => setPhase((p) => (p === "video" ? "intro" : p))}
          // Al segundo 10 mostramos la portada sobre el video (sigue de fondo)
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime >= 10) {
              setPhase((p) => (p === "video" ? "intro" : p));
            }
          }}
          playsInline
          preload="auto"
          src={settings.save_the_date_url}
        />
      )}

      {/* Overlay durante el video (0–10s): botón "Saltar" para adelantar */}
      <AnimatePresence>
        {phase === "video" && (
          <VideoSplash onComplete={() => setPhase("intro")} />
        )}
      </AnimatePresence>

      {/* Portada "Abrir nuestra historia" — sobre el video de fondo */}
      <AnimatePresence>
        {phase === "intro" && (
          <IntroScreen
            dateLabel={dateLabel}
            onEnter={() => setPhase("entered")}
            overVideo={Boolean(settings.save_the_date_url)}
          />
        )}
      </AnimatePresence>

      <MusicPlayer enabled={entered} src={settings.main_song_url} />

      {/* RSVP Modal */}
      <RSVPModal guest={guest} isOpen={rsvpOpen} onClose={() => setRsvpOpen(false)} />

      <main>
        {entered ? (
          <button
            aria-label="Volver a la preinvitación"
            className="focus-ring fixed left-3 top-3 z-40 grid h-11 w-11 place-items-center rounded-full border border-[#F7F3EA]/24 bg-[#0C1D0E]/55 text-[#F7F3EA] shadow-2xl backdrop-blur-xl transition hover:bg-[#F7F3EA] hover:text-[#0C1D0E] sm:left-4 sm:top-4"
            onClick={() => setPhase("intro")}
            type="button"
          >
            <ArrowLeft size={17} />
          </button>
        ) : null}

        {/* Hero cinema */}
        <section className="hero-cinema-section relative overflow-hidden">
          <div className="hero-cinema">
            <div className="absolute inset-0 bg-black" />
            <AnimatePresence>
              <motion.div
                animate={{ opacity: 1, scale: 1.12 }}
                className="absolute inset-0 bg-cover"
                exit={{ opacity: 0, scale: 1.16 }}
                initial={{ opacity: 0, scale: 1 }}
                key={slide.image}
                style={{ backgroundImage: `url(${slide.image})`, backgroundPosition: slide.bgPosition }}
                transition={{
                  opacity: { duration: 1.35, ease: "easeInOut" },
                  scale: { duration: 7.8, ease: "easeOut" },
                }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-b from-black/28 via-transparent to-black/80" />
            <div className="hero-cinema-text">
              <AnimatePresence mode="wait">
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 18 }}
                  initial={{ opacity: 0, y: 18 }}
                  key={slide.title}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                >
                  <p className="responsive-kicker mb-4 inline-flex items-center gap-2 rounded-full border border-[#F7F3EA]/28 bg-[#0C1D0E]/34 px-3 py-2 text-[0.68rem] font-semibold uppercase text-[#F7F3EA] backdrop-blur-xl sm:px-4 sm:text-xs">
                    <Sparkles size={15} />
                    Zequelly & Elio
                  </p>
                  <h1 className="text-balance font-display text-4xl leading-tight text-[#F7F3EA] sm:text-6xl lg:text-7xl">
                    {slide.title}
                  </h1>
                  <p className="text-pretty mt-5 max-w-xl font-display text-xl leading-8 text-[#E2E5E2] sm:text-2xl sm:leading-9">
                    {slide.phrase}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="absolute bottom-5 right-5 z-[3] flex gap-2">
              {heroSlides.map((item, index) => (
                <button
                  aria-label={`Ver imagen ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    index === activeSlide ? "w-9 bg-[#F7F3EA]" : "w-4 bg-[#F7F3EA]/40"
                  }`}
                  key={item.image}
                  onClick={() => setActiveSlide(index)}
                  type="button"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Mensaje + CTA confirmar asistencia */}
        <section className="hero-message-band relative overflow-hidden py-14 sm:py-20">
          <div className="container-shell relative">
            {/* Ornamentos botánicos */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-50">
              <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full border border-[#837E5E]/25" />
              <div className="absolute left-1/2 top-0 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/4 rounded-full border border-[#F7F3EA]/10" />
              <div className="absolute -left-24 top-1/3 h-64 w-64 rounded-full border border-[#837E5E]/18" />
              <div className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full border border-[#837E5E]/15" />
            </div>
            <motion.div
              animate={{ y: 0, opacity: 1 }}
              className="liquid-glass mobile-tight-glass mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem]"
              initial={{ y: 28, opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12">
                {/* Badge invitado personalizado */}
                {guest && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex items-center justify-center gap-2 rounded-full border border-[#F7F3EA]/20 bg-[#F7F3EA]/10 px-4 py-2 text-sm text-[#F7F3EA] backdrop-blur-sm"
                    initial={{ opacity: 0, y: -8 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    <Heart size={13} strokeWidth={1.5} />
                    <span className="font-semibold">{guest.display_name}</span>
                    <span className="text-[#A39F88]">·</span>
                    <span className="text-[#A39F88]">
                      {guest.max_guests === 1 ? "1 cupo reservado" : `${guest.max_guests} cupos reservados`}
                    </span>
                  </motion.div>
                )}

                <p className="responsive-kicker text-center text-xs font-semibold uppercase text-[#A39F88]">
                  Zequelly & Elio
                </p>
                <div className="gold-line mx-auto mt-4 w-32" />
                <p className="hero-copy text-pretty mx-auto mt-8 max-w-2xl text-center leading-8 text-[#E2E5E2] sm:leading-9">
                  Después de tantos momentos compartidos, llegó el día de celebrar nuestro amor
                  junto a las personas que más queremos.
                </p>
                <p className="hero-copy text-pretty mx-auto mt-5 max-w-2xl text-center leading-8 text-[#E2E5E2] sm:leading-9">
                  Queremos que seas parte de esta noche especial, llena de alegría, música,
                  abrazos y recuerdos que guardaremos para siempre.
                </p>
                <div className="gold-line mx-auto mt-8 w-20" />
                <p className="font-script mt-6 text-center text-3xl text-[#A39F88] sm:text-4xl">
                  Con Amor
                </p>
                <p className="font-script text-center text-4xl text-[#F7F3EA] sm:text-5xl">
                  Zequelly y Elio
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        <Section eyebrow="Cuenta regresiva" title="Falta muy poco para nuestro gran día">
          <p className="mx-auto mb-8 max-w-2xl text-center leading-8 text-[#E2E5E2]">
            Cada día nos acerca más al momento en que diremos 'sí' y celebraremos junto a ustedes.
          </p>
          <Countdown target={settings.wedding_date} />
        </Section>

        <Section eyebrow="Celebra con nosotros" id="detalles" title="Detalles de la boda">
          <WeddingDetails settings={settings} />
        </Section>

        {/* ── Sección confirmar asistencia ── */}
        <section className="hero-message-band relative overflow-hidden py-16 sm:py-24" id="rsvp">
          {/* Ornamentos */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
            <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#837E5E]/22" />
            <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F7F3EA]/10" />
            <div className="absolute -left-20 top-1/3 h-56 w-56 rounded-full border border-[#837E5E]/16" />
            <div className="absolute -right-16 bottom-1/4 h-64 w-64 rounded-full border border-[#837E5E]/14" />
          </div>
          <div className="container-shell relative">
            <motion.div
              animate={{ y: 0, opacity: 1 }}
              className="liquid-glass mobile-tight-glass mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem]"
              initial={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.75 }}
            >
              <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 text-center">
                <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-[#F7F3EA]/30 bg-[#F7F3EA]/10">
                  <Heart className="text-[#F7F3EA]" size={20} strokeWidth={1.4} />
                </div>
                <p className="responsive-kicker text-xs font-semibold uppercase text-[#A39F88]">
                  Nos encantaría contar contigo
                </p>
                <div className="gold-line mx-auto mt-4 w-28" />
                <h2 className="font-display mt-6 text-3xl text-[#F7F3EA] sm:text-4xl">
                  Confirma tu asistencia
                </h2>
                <p className="hero-copy text-pretty mx-auto mt-5 max-w-lg text-center leading-8 text-[#E2E5E2] sm:leading-9">
                  Tu presencia significa muchísimo para nosotros. Para preparar cada detalle con cariño,
                  te pedimos confirmar antes del{" "}
                  <span className="font-semibold text-[#F7F3EA]">
                    {new Date(settings.rsvp_deadline).toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>.
                </p>
                <div className="gold-line mx-auto mt-7 w-16" />
                <button
                  className="focus-ring mt-8 inline-flex items-center gap-2.5 rounded-full bg-[#F7F3EA] px-7 py-4 font-semibold text-[#0C1D0E] shadow-xl transition hover:bg-[#E2E5E2] hover:scale-[1.02]"
                  onClick={() => setRsvpOpen(true)}
                  type="button"
                >
                  <MailCheck size={18} />
                  Confirmar asistencia
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        <Section eyebrow="Cómo llegar" title="Para llegar sin complicaciones">
          <p className="mx-auto mb-8 max-w-2xl text-center leading-8 text-[#E2E5E2]">
            Para que llegues sin complicaciones, te dejamos la ubicación exacta del lugar.
          </p>
          <MapButtons settings={settings} />
        </Section>

        <Section eyebrow="Detalles para disfrutar" title="Una noche especial">
          <div className="text-center">
            <InfoPopup />
          </div>
        </Section>

        <section className="gift-section-bg relative overflow-hidden py-20 sm:py-28" id="regalo">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(247,243,234,0.16),transparent)]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
            <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#837E5E]/30" />
            <div className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F7F3EA]/12" />
            <div className="absolute -left-16 top-1/4 h-56 w-56 rounded-full border border-[#837E5E]/20" />
            <div className="absolute -right-12 bottom-1/4 h-72 w-72 rounded-full border border-[#837E5E]/18" />
          </div>

          <div className="container-shell relative text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#837E5E]/40 bg-[#0C1D0E]/40 backdrop-blur-sm">
              <Heart className="text-[#A39F88]" size={24} strokeWidth={1.3} />
            </div>
            <h2 className="font-display mt-5 text-4xl text-[#F7F3EA] sm:text-5xl">
              Lluvia de amor
            </h2>
            <div className="gold-line mx-auto my-7 w-44" />
            <p className="mx-auto mb-10 max-w-lg leading-8 text-[#E2E5E2]">
              Tu presencia es lo que más nos importa. Pero si deseas tener un detalle especial
              con nosotros, aquí tienes cómo hacerlo.
            </p>
            <GiftModal settings={settings} />
          </div>
        </section>

        <Section eyebrow="Playlist" title="La música de nuestra historia">
          <p className="mx-auto mb-8 max-w-2xl text-center leading-8 text-[#E2E5E2]">
            Creamos una playlist especial para acompañar este momento. Puedes escucharla antes,
            durante o después de la boda y guardar un pedacito de esta celebración.
          </p>
          <SpotifyPlaylist url={settings.spotify_playlist_url} />
        </Section>

        <Footer />
      </main>
    </>
  );
}

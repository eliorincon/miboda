"use client";

import {
  AnimatePresence,
  motion,
  MotionConfig,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from "framer-motion";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import Link from "next/link";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PhotoTabBar } from "./PhotoTabBar";

type PublicPhoto = {
  id: string;
  uploaderName: string;
  createdAt: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  photoUrl: string | null;
};

type Uploader = { name: string; count: number };

const PAGE_SIZE = 30;
const POLL_MS = 30_000;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const timeFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Las fotos se muestran como fondo (no como <img>) y sin menú contextual:
// así el celular no ofrece "Guardar imagen" al mantenerlas presionadas.
// Un pantallazo no se puede impedir desde una página web.
const noSave: CSSProperties = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

const bg = (url: string | null, size: "cover" | "contain"): CSSProperties =>
  url
    ? {
        backgroundImage: `url("${url}")`,
        backgroundSize: size,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {};

/** Proporción de la foto (alto / ancho), acotada para que el mosaico respire */
function ratioOf(p: PublicPhoto) {
  if (!p.width || !p.height) return 1;
  return Math.min(1.6, Math.max(0.62, p.height / p.width));
}

// Columnas del mosaico según el ancho de pantalla
function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const getColumns = () => (window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2);

// Dirección del cambio: 1 = siguiente, -1 = anterior, 0 = recién abierta
const slideVariants: Variants = {
  enter: (dir: number) =>
    dir === 0 ? { x: 0, opacity: 0, scale: 0.88 } : { x: dir > 0 ? "104%" : "-104%", opacity: 1, scale: 1 },
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) =>
    dir === 0 ? { x: 0, opacity: 0, scale: 0.94 } : { x: dir > 0 ? "-104%" : "104%", opacity: 1, scale: 1 },
};
const fadeVariants: Variants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };

// ─── Miniatura del mosaico ───────────────────────────────────────────────────

function Tile({
  photo,
  order,
  onOpen,
}: {
  photo: PublicPhoto;
  order: number;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!photo.thumbUrl) return;
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = photo.thumbUrl;
    return () => {
      img.onload = null;
    };
  }, [photo.thumbUrl]);

  const ratio = ratioOf(photo);
  return (
    <motion.button
      aria-label={`Ver foto de ${photo.uploaderName}`}
      className="focus-ring group relative block w-full overflow-hidden rounded-[18px] bg-[#0f2414] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-[#F7F3EA]/[0.06]"
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      onClick={onOpen}
      style={{ aspectRatio: `1 / ${ratio}` }}
      transition={{ duration: 0.55, ease: EASE_OUT, delay: (order % 8) * 0.04 }}
      type="button"
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.965 }}
    >
      {!loaded ? <div aria-hidden="true" className="photo-skeleton absolute inset-0" /> : null}
      {photo.thumbUrl ? (
        <motion.div
          animate={loaded ? { opacity: 1, scale: 1, filter: "blur(0px)" } : { opacity: 0, scale: 1.06, filter: "blur(10px)" }}
          aria-hidden="true"
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]"
          initial={false}
          style={bg(photo.thumbUrl, "cover")}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[#154D35] text-[#F7F3EA]/70">
          <Camera size={26} strokeWidth={1.6} />
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className="pointer-events-none absolute bottom-2.5 left-3 right-3 truncate text-left text-xs font-semibold text-[#F7F3EA] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        {photo.uploaderName}
      </span>
    </motion.button>
  );
}

// ─── Foto dentro del visor (con zoom por doble toque) ───────────────────────

function PhotoStage({
  photo,
  zoomed,
  onToggleZoom,
  onSingleTap,
}: {
  photo: PublicPhoto;
  zoomed: boolean;
  onToggleZoom: () => void;
  onSingleTap: () => void;
}) {
  const boundsRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);

  function handleTap() {
    const now = performance.now();
    if (now - lastTap.current < 280) {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      lastTap.current = 0;
      onToggleZoom();
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      onSingleTap();
    }, 280);
  }

  useEffect(() => {
    return () => {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" ref={boundsRef}>
      <motion.div
        animate={zoomed ? { scale: 2.3 } : { scale: 1, x: 0, y: 0 }}
        aria-label={`Foto de ${photo.uploaderName}`}
        className={`absolute inset-0 ${zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        drag={zoomed}
        dragConstraints={boundsRef}
        dragElastic={0.12}
        onTap={handleTap}
        role="img"
        style={bg(photo.photoUrl ?? photo.thumbUrl, "contain")}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      />
    </div>
  );
}

// ─── Visor a pantalla completa ───────────────────────────────────────────────

function Viewer({
  photos,
  index,
  direction,
  total,
  onClose,
  onGo,
}: {
  photos: PublicPhoto[];
  index: number;
  direction: number;
  total: number;
  onClose: () => void;
  onGo: (next: number) => void;
}) {
  const reduceMotion = Boolean(useReducedMotion());
  const photo = photos[index];
  const [chrome, setChrome] = useState(true);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const zoomed = zoomedId === photo.id;
  const y = useMotionValue(0);
  const veilOpacity = useTransform(y, [-360, 0, 360], [0.15, 1, 0.15]);
  const dragScale = useTransform(y, [-360, 0, 360], [0.82, 1, 0.82]);
  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= photos.length) return;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(6);
      onGo(next);
    },
    [index, photos.length, onGo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Precargar vecinas y centrar la miniatura activa en la tira
  useEffect(() => {
    for (const i of [index - 1, index + 1]) {
      const url = photos[i]?.photoUrl;
      if (url) new Image().src = url;
    }
    thumbRefs.current.get(photo.id)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index, photos, photo.id]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (Math.abs(offset.y) > 140 || Math.abs(velocity.y) > 900) onClose();
      return;
    }
    const swipe = offset.x + velocity.x * 0.2;
    if (swipe < -80) go(1);
    else if (swipe > 80) go(-1);
  }

  const initial = photo.uploaderName.trim().charAt(0).toUpperCase() || "♡";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      style={noSave}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Fondo ambiente: la misma foto, muy desenfocada */}
      <motion.div className="absolute inset-0 bg-[#040a05]" style={{ opacity: veilOpacity }}>
        <AnimatePresence initial={false}>
          <motion.div
            animate={{ opacity: 0.6 }}
            aria-hidden="true"
            className="absolute inset-[-12%]"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={photo.id}
            style={{ ...bg(photo.thumbUrl, "cover"), filter: "blur(60px) saturate(1.4)" }}
            transition={{ duration: 0.6 }}
          />
        </AnimatePresence>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
      </motion.div>

      <div className="relative flex h-full flex-col">
        <AnimatePresence initial={false}>
          {chrome ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(env(safe-area-inset-top),16px)] sm:px-8"
              exit={{ opacity: 0, y: -12 }}
              initial={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#E9DFBF] to-[#837E5E] font-display text-lg text-[#0C1D0E] shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] font-semibold text-[#F7F3EA]">{photo.uploaderName}</p>
                  <p className="text-xs capitalize text-[#C9C5B2]">{timeFormatter.format(new Date(photo.createdAt))}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="btn-glass rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums text-[#E8E4D6]">
                  {index + 1} / {total}
                </span>
                <button
                  aria-label="Cerrar"
                  className="btn-glass focus-ring grid h-11 w-11 place-items-center rounded-full text-[#F7F3EA]"
                  onClick={onClose}
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative min-h-0 flex-1">
          <AnimatePresence custom={direction} initial>
            <motion.div
              animate="center"
              className="absolute inset-0"
              custom={direction}
              exit="exit"
              initial="enter"
              key={photo.id}
              transition={
                reduceMotion
                  ? { duration: 0.18 }
                  : {
                      x: { type: "spring", stiffness: 280, damping: 32 },
                      scale: { type: "spring", stiffness: 240, damping: 24 },
                      opacity: { duration: 0.22 },
                    }
              }
              variants={reduceMotion ? fadeVariants : slideVariants}
            >
              <motion.div
                className="absolute inset-0 touch-none"
                drag={!zoomed}
                dragDirectionLock
                dragElastic={0.55}
                dragSnapToOrigin
                onDragEnd={onDragEnd}
                style={{ y, scale: dragScale }}
              >
                <PhotoStage
                  onSingleTap={() => setChrome((c) => !c)}
                  onToggleZoom={() => setZoomedId((z) => (z === photo.id ? null : photo.id))}
                  photo={photo}
                  zoomed={zoomed}
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {chrome && !zoomed ? (
              <>
                <motion.button
                  animate={{ opacity: index === 0 ? 0.25 : 1 }}
                  aria-label="Foto anterior"
                  className="btn-glass focus-ring absolute left-4 top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full text-[#F7F3EA] sm:grid"
                  disabled={index === 0}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="prev"
                  onClick={() => go(-1)}
                  type="button"
                >
                  <ChevronLeft size={24} />
                </motion.button>
                <motion.button
                  animate={{ opacity: index === photos.length - 1 ? 0.25 : 1 }}
                  aria-label="Foto siguiente"
                  className="btn-glass focus-ring absolute right-4 top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full text-[#F7F3EA] sm:grid"
                  disabled={index === photos.length - 1}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="next"
                  onClick={() => go(1)}
                  type="button"
                >
                  <ChevronRight size={24} />
                </motion.button>
              </>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {chrome ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="pb-[max(env(safe-area-inset-bottom),14px)] pt-3"
              exit={{ opacity: 0, y: 16 }}
              initial={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.22 }}
            >
              <motion.p
                animate={{ opacity: [0, 1, 1, 0] }}
                className="mb-3 text-center text-[0.78rem] text-[#C9C5B2]"
                transition={{ duration: 5, times: [0, 0.08, 0.8, 1] }}
              >
                Desliza para pasar · hacia abajo para cerrar · doble toque para acercar
              </motion.p>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-[calc(50%-24px)] pb-1">
                {photos.map((p, i) => {
                  const active = i === index;
                  return (
                    <button
                      aria-label={`Ir a la foto ${i + 1}`}
                      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl transition-all duration-300 ${
                        active ? "scale-110 opacity-100 ring-2 ring-[#F7F3EA]" : "opacity-45 hover:opacity-80"
                      }`}
                      key={p.id}
                      onClick={() => i !== index && onGo(i)}
                      ref={(el) => {
                        if (el) thumbRefs.current.set(p.id, el);
                        else thumbRefs.current.delete(p.id);
                      }}
                      style={{ ...bg(p.thumbUrl, "cover"), backgroundColor: "#154D35" }}
                      type="button"
                    />
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Galería ─────────────────────────────────────────────────────────────────

export function PublicGallery({ isAdminPreview = false }: { isAdminPreview?: boolean }) {
  const reduceMotion = Boolean(useReducedMotion());
  const columns = useSyncExternalStore(subscribeResize, getColumns, () => 2);
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [uploaders, setUploaders] = useState<Uploader[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [direction, setDirection] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [compact, setCompact] = useState(false);
  const requestId = useRef(0);
  const totalRef = useRef(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (offset: number, who: string, people = false) => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
    if (who) params.set("uploader", who);
    if (people) params.set("people", "1");
    const res = await fetch(`/api/photos/gallery?${params}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "No pudimos cargar la galería.");
    return data as { total: number; photos: PublicPhoto[]; uploaders?: Uploader[] };
  }, []);

  const loadFirst = useCallback(
    (who: string) => {
      const id = ++requestId.current;
      fetchPage(0, who, true)
        .then((data) => {
          if (id !== requestId.current) return;
          setPhotos(data.photos);
          setTotal(data.total);
          if (data.uploaders) setUploaders(data.uploaders);
          setNewCount(0);
          setError(null);
        })
        .catch((e) => {
          if (id === requestId.current) setError(e instanceof Error ? e.message : "No pudimos cargar la galería.");
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    },
    [fetchPage],
  );

  useEffect(() => {
    loadFirst(filter);
  }, [loadFirst, filter]);

  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  const hasMore = photos.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const data = await fetchPage(photos.length, filter);
      if (id !== requestId.current) return;
      setTotal(data.total);
      setPhotos((prev) => [...prev, ...data.photos.filter((p) => !prev.some((q) => q.id === p.id))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar más fotos.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchPage, photos.length, filter]);

  // Carga infinita al acercarse al final
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  // Barra superior compacta cuando el encabezado sale de la vista
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setCompact(!entries[0]?.isIntersecting), {
      rootMargin: "-80px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Avisar cuando llegan fotos nuevas (sin recargar la grilla por sorpresa)
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const params = new URLSearchParams({ offset: "0", limit: "1" });
        if (filter) params.set("uploader", filter);
        const res = await fetch(`/api/photos/gallery?${params}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const diff = (data.total ?? 0) - totalRef.current;
        if (diff > 0) setNewCount(diff);
      } catch {
        // sin señal: se intenta en la próxima vuelta
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [filter]);

  function showNew() {
    setViewer(null);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    loadFirst(filter);
  }

  function chooseFilter(name: string) {
    if (name === filter) return;
    setLoading(true);
    setPhotos([]);
    setViewer(null);
    setFilter(name);
  }

  const goTo = useCallback(
    (next: number) => {
      setDirection(viewer === null ? 0 : next > viewer ? 1 : -1);
      setViewer(next);
      if (next >= photos.length - 3) void loadMore();
    },
    [viewer, photos.length, loadMore],
  );

  // Mosaico: cada foto va a la columna más corta (orden estable al cargar más)
  const masonry = useMemo(() => {
    const cols: { photo: PublicPhoto; index: number }[][] = Array.from({ length: columns }, () => []);
    const heights = new Array<number>(columns).fill(0);
    photos.forEach((photo, index) => {
      const target = heights.indexOf(Math.min(...heights));
      cols[target].push({ photo, index });
      heights[target] += ratioOf(photo);
    });
    return cols;
  }, [photos, columns]);

  const chips = [
    { name: "", label: "Todas", count: null as number | null },
    ...uploaders.map((u) => ({ name: u.name, label: u.name, count: u.count as number | null })),
  ];

  return (
    <MotionConfig reducedMotion="user">
    <div className="photo-app" onContextMenu={(e) => e.preventDefault()} style={noSave}>
      {/* Barra superior compacta */}
      <AnimatePresence>
        {compact ? (
          <motion.header
            animate={{ y: 0, opacity: 1 }}
            className="photo-bar fixed inset-x-0 top-0 z-30 border-b border-t-0 border-[#F7F3EA]/10"
            exit={{ y: -70, opacity: 0 }}
            initial={{ y: -70, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
              <p className="shrink-0 whitespace-nowrap font-script text-[1.45rem] leading-none text-[#A39F88]">
                Zequelly &amp; Elio
              </p>
              <p className="min-w-0 truncate text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#C9C5B2]">
                {filter || "La galería de la noche"} · {total}
              </p>
            </div>
          </motion.header>
        ) : null}
      </AnimatePresence>

      {/* Aviso de fotos nuevas */}
      <AnimatePresence>
        {newCount > 0 ? (
          <motion.div
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="fixed inset-x-0 top-16 z-40 flex justify-center"
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            initial={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <button
              className="btn-ivory focus-ring flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
              onClick={showNew}
              type="button"
            >
              <Sparkles size={16} />
              {newCount === 1 ? "1 foto nueva" : `${newCount} fotos nuevas`}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="mx-auto w-full max-w-6xl px-3.5 pb-32 pt-6 text-[#F7F3EA] sm:px-6">
        {isAdminPreview ? (
          <div className="mb-5 flex items-start gap-2 rounded-2xl bg-[#F7F3EA] px-3.5 py-2.5 text-[0.8rem] font-semibold leading-5 text-[#154D35]">
            <ShieldCheck className="mt-0.5 shrink-0" size={16} />
            <span>
              Vista de los novios: aquí también ven sus fotos de prueba (marcadas con &quot;(prueba)&quot;). Los
              invitados no las ven.
            </span>
          </div>
        ) : null}

        {/* Encabezado */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 pt-4 text-center"
          initial={{ opacity: 0, y: 14 }}
          ref={heroRef}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <p className="gold-text font-script text-[2.6rem] leading-none sm:text-[3.2rem]">Zequelly &amp; Elio</p>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-[#A39F88]">Nuestra noche en fotos</p>
          <h1 className="mt-1 text-balance font-display text-[2.2rem] leading-[1.1] sm:text-[3.4rem]">
            La galería de la noche
          </h1>
          <div className="gold-line w-44" />
          <p className="max-w-md text-pretty text-[0.95rem] leading-7 text-[#E8E4D6]">
            Cada recuerdo que compartieron nuestros invitados, en un solo lugar. Toca una foto para vivirla en grande.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span className="btn-glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#E8E4D6]">
              <Camera size={14} /> {total} {total === 1 ? "recuerdo" : "recuerdos"}
            </span>
            <span className="btn-glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#E8E4D6]">
              <Users size={14} /> {uploaders.length} {uploaders.length === 1 ? "persona" : "personas"}
            </span>
          </div>
        </motion.div>

        {/* Filtro por persona */}
        {uploaders.length > 1 ? (
          <div className="no-scrollbar -mx-3.5 mt-7 flex gap-2 overflow-x-auto px-3.5 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
            {chips.map((c) => {
              const active = c.name === filter;
              return (
                <button
                  className={`focus-ring relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[0.85rem] font-semibold transition-colors ${
                    active ? "text-[#0C1D0E]" : "btn-glass text-[#E8E4D6]"
                  }`}
                  key={c.name || "todas"}
                  onClick={() => chooseFilter(c.name)}
                  type="button"
                >
                  {active ? (
                    <motion.span
                      className="absolute inset-0 rounded-full bg-[#F7F3EA]"
                      layoutId="gallery-chip"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative max-w-[11rem] truncate">{c.label}</span>
                  {c.count !== null ? <span className="relative opacity-60">{c.count}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {error ? (
          <p className="mt-8 rounded-2xl border border-[#D6AA5A]/45 bg-[#D6AA5A]/14 px-4 py-3 text-center text-sm text-[#F3E6C8]">
            {error}
          </p>
        ) : null}

        {/* Estado vacío */}
        {!loading && !error && photos.length === 0 ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="photo-glass mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-[28px] px-6 py-12 text-center"
            initial={{ opacity: 0, y: 16 }}
          >
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
              className="grid h-16 w-16 place-items-center rounded-full border border-[#A39F88]/45 bg-[#0C1D0E]/50 text-[#A39F88]"
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Camera size={28} strokeWidth={1.6} />
            </motion.div>
            <p className="font-display text-2xl">Todavía no hay fotos</p>
            <p className="max-w-sm text-sm leading-6 text-[#E8E4D6]">
              Desde el sábado 31 de octubre a las 18:00 hrs, aquí irán apareciendo los recuerdos de la celebración.
            </p>
            <Link className="btn-ivory focus-ring mt-1 flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold" href="/fotos">
              <ImagePlus size={18} /> Compartir mis fotos
            </Link>
          </motion.div>
        ) : null}

        {/* Esqueleto mientras carga */}
        {loading && photos.length === 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div className="photo-skeleton rounded-[18px]" key={i} style={{ aspectRatio: i % 3 === 0 ? "3 / 4" : "1 / 1" }} />
            ))}
          </div>
        ) : null}

        {/* Mosaico */}
        {photos.length ? (
          <div className="mt-7 flex items-start gap-2.5 sm:gap-3.5">
            {masonry.map((col, c) => (
              <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:gap-3.5" key={c}>
                {col.map(({ photo, index }) => (
                  <Tile
                    key={photo.id}
                    onOpen={() => {
                      setDirection(0);
                      setViewer(index);
                    }}
                    order={index}
                    photo={photo}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div aria-hidden="true" className="h-4" ref={sentinelRef} />
        {loadingMore ? (
          <div className="flex justify-center py-4">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#F7F3EA]/25 border-t-[#F7F3EA]" />
          </div>
        ) : null}
        {!hasMore && photos.length > 12 ? (
          <p className="mt-8 text-center font-script text-3xl text-[#A39F88]">Gracias por cada recuerdo</p>
        ) : null}
      </main>

      <AnimatePresence>
        {viewer !== null && photos[viewer] ? (
          <Viewer
            direction={direction}
            index={viewer}
            key="viewer"
            onClose={() => setViewer(null)}
            onGo={goTo}
            photos={photos}
            total={total}
          />
        ) : null}
      </AnimatePresence>

      <PhotoTabBar active="gallery" />
    </div>
    </MotionConfig>
  );
}

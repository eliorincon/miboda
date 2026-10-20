"use client";

import { Camera, ChevronLeft, ChevronRight, ImagePlus, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

type PublicPhoto = {
  id: string;
  uploaderName: string;
  createdAt: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  photoUrl: string | null;
};

const PAGE_SIZE = 30;

const whenFormatter = new Intl.DateTimeFormat("es-CL", {
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

export function PublicGallery({ isAdminPreview = false }: { isAdminPreview?: boolean }) {
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const fetchPage = useCallback(async (offset: number) => {
    const res = await fetch(`/api/photos/gallery?offset=${offset}&limit=${PAGE_SIZE}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "No pudimos cargar la galería.");
    return data as { total: number; photos: PublicPhoto[] };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchPage(0)
      .then((data) => {
        if (!alive) return;
        setPhotos(data.photos);
        setTotal(data.total);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "No pudimos cargar la galería."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  async function loadMore() {
    setLoading(true);
    try {
      const data = await fetchPage(photos.length);
      setTotal(data.total);
      setPhotos((prev) => [...prev, ...data.photos.filter((p) => !prev.some((q) => q.id === p.id))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar más fotos.");
    } finally {
      setLoading(false);
    }
  }

  const move = useCallback(
    (delta: number) =>
      setViewer((v) => {
        if (v === null) return v;
        const next = v + delta;
        return next >= 0 && next < photos.length ? next : v;
      }),
    [photos.length],
  );

  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "Escape") setViewer(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [viewer, move]);

  const current = viewer !== null ? photos[viewer] : null;

  return (
    <main
      className="mx-auto flex min-h-[100svh] w-full max-w-5xl flex-col px-4 pb-10 pt-6 text-[#F7F3EA] sm:px-6"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={noSave}
    >
      {isAdminPreview ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-[#F7F3EA] px-3.5 py-2.5 text-[0.8rem] font-semibold leading-5 text-[#154D35]">
          <ShieldCheck className="mt-0.5 shrink-0" size={16} />
          <span>
            Vista de los novios: aquí también ven sus fotos de prueba (marcadas con &quot;(prueba)&quot;). Los
            invitados no las ven.
          </span>
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-0.5 text-center">
        <p className="font-script text-[2.1rem] leading-none text-[#A39F88]">Zequelly &amp; Elio</p>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#A39F88]">Nuestra noche en fotos</p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <h1 className="text-balance font-display text-[2rem] leading-tight sm:text-5xl">La galería de la noche</h1>
        <div className="gold-line w-44" />
        <p className="max-w-xl text-pretty leading-7 text-[#E8E4D6]">
          Los recuerdos que fueron compartiendo nuestros invitados. Toca una foto para verla en grande.
        </p>
        {total ? (
          <p className="text-sm text-[#C9C5B2]">
            {total} {total === 1 ? "foto compartida" : "fotos compartidas"}
          </p>
        ) : null}
        <Link
          className="focus-ring mt-1 flex min-h-12 items-center gap-2 rounded-full border border-[#F7F3EA]/40 px-6 text-[0.95rem] font-semibold"
          href="/fotos"
        >
          <ImagePlus size={18} /> Compartir mis fotos
        </Link>
      </div>

      {error ? (
        <p className="mt-8 rounded-2xl border border-[#D6AA5A]/45 bg-[#D6AA5A]/14 px-4 py-3 text-center text-sm text-[#F3E6C8]">
          {error}
        </p>
      ) : null}

      {!loading && !error && photos.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-[#F7F3EA]/16 bg-[#F7F3EA]/8 px-6 py-14 text-center">
          <Camera className="text-[#A39F88]" size={32} strokeWidth={1.6} />
          <p className="font-display text-2xl">Todavía no hay fotos</p>
          <p className="max-w-sm text-sm leading-6 text-[#E8E4D6]">
            Desde el sábado 31 de octubre a las 18:00 hrs, aquí irán apareciendo los recuerdos de la celebración.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-5">
        {photos.map((p, i) => (
          <button
            aria-label={`Ver foto de ${p.uploaderName}`}
            className="focus-ring aspect-square w-full overflow-hidden rounded-[10px] bg-[#154D35] sm:rounded-[14px]"
            key={p.id}
            onClick={() => setViewer(i)}
            style={bg(p.thumbUrl, "cover")}
            type="button"
          >
            {!p.thumbUrl ? <Camera className="mx-auto text-[#F7F3EA]/70" size={24} strokeWidth={1.6} /> : null}
          </button>
        ))}
      </div>

      {photos.length > 0 && photos.length < total ? (
        <div className="mt-6 flex justify-center">
          <button
            className="focus-ring min-h-12 rounded-full border border-[#F7F3EA]/40 px-7 text-[0.95rem] font-semibold disabled:opacity-60"
            disabled={loading}
            onClick={() => void loadMore()}
            type="button"
          >
            {loading ? "Cargando…" : "Ver más fotos"}
          </button>
        </div>
      ) : null}
      {loading && photos.length === 0 ? <p className="mt-10 text-center text-sm text-[#C9C5B2]">Cargando recuerdos…</p> : null}

      {current ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-[#08120A]/97 px-3 pb-5 pt-4 sm:px-8"
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
            touchStartX.current = null;
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          role="dialog"
          style={noSave}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display truncate text-xl">{current.uploaderName}</p>
              <p className="text-sm capitalize text-[#C9C5B2]">{whenFormatter.format(new Date(current.createdAt))}</p>
            </div>
            <button
              aria-label="Cerrar"
              className="focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#F7F3EA]/30"
              onClick={() => setViewer(null)}
              type="button"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative my-4 min-h-0 flex-1">
            <div
              aria-label={`Foto de ${current.uploaderName}`}
              className="absolute inset-0"
              role="img"
              style={bg(current.photoUrl ?? current.thumbUrl, "contain")}
            />
            <button
              aria-label="Foto anterior"
              className="focus-ring absolute left-0 top-1/2 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-[#F7F3EA]/30 bg-[#0C1D0E]/60 disabled:opacity-30 sm:grid"
              disabled={viewer === 0}
              onClick={() => move(-1)}
              type="button"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              aria-label="Foto siguiente"
              className="focus-ring absolute right-0 top-1/2 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-[#F7F3EA]/30 bg-[#0C1D0E]/60 disabled:opacity-30 sm:grid"
              disabled={viewer === photos.length - 1}
              onClick={() => move(1)}
              type="button"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <p className="text-center text-[0.8rem] text-[#A8A48E]">
            {viewer! + 1} de {total} · Desliza para ver la siguiente
          </p>
        </div>
      ) : null}
    </main>
  );
}

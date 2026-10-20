"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { AdminPhoto, PhotoUploaderCount } from "@/lib/types";
import { ZipWriter } from "@/lib/zip";

type Summary = {
  total: number;
  uploaders: PhotoUploaderCount[];
  people: { guest: number; qr: number };
  totalBytes: number;
  maxBytes: number;
  staleCount: number;
  testCount: number;
};

type Dialog =
  | { kind: "delete"; photo: AdminPhoto }
  | { kind: "test" }
  | { kind: "reconcile"; result?: { rescued: number; removed: number } }
  | null;

type ZipState = {
  part: number;
  parts: number;
  done: number;
  inPart: number;
  finishedParts: number;
  finished: boolean;
  error?: string;
};

const PAGE_SIZE = 60;
const ZIP_PART_SIZE = 150;

const MB = 1024 * 1024;
const formatMb = (bytes: number) => `${Math.round(bytes / MB)} MB`;

const whenFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  weekday: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const longFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatWhen(iso: string) {
  const parts = whenFormatter.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday").replace(".", "")} ${get("day")} · ${get("hour")}:${get("minute")}`;
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Algo no salió bien. Intenta de nuevo.");
  return data;
}

async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No pudimos descargar la foto.");
  const blob = await res.blob();
  saveBlob(blob, filename);
}

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        aria-modal="true"
        className="w-full max-w-lg rounded-[1.5rem] bg-[#F7F3EA] p-6 text-[#15351f] shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {children}
      </div>
    </div>
  );
}

function PhotoTile({ photo }: { photo: AdminPhoto }) {
  const [broken, setBroken] = useState(false);
  if (!photo.thumbUrl || broken) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-[14px] bg-[#154D35] text-[#F7F3EA]/70">
        <Camera size={28} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase
    <img
      alt={`Foto de ${photo.uploaderName}`}
      className="aspect-square w-full rounded-[14px] bg-[#E2E5E2] object-cover"
      loading="lazy"
      onError={() => setBroken(true)}
      src={photo.thumbUrl}
    />
  );
}

export function AdminPhotoGallery() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [uploader, setUploader] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [working, setWorking] = useState(false);
  const [zip, setZip] = useState<ZipState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const stopZipRef = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const fetchPage = useCallback(async (offset: number, who: string) => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
    if (who) params.set("uploader", who);
    const data = await readJson(await fetch(`/api/admin/photos?${params}`, { cache: "no-store" }));
    return data as Summary & { photos: AdminPhoto[] };
  }, []);

  const reload = useCallback(
    async (who: string) => {
      try {
        const data = await fetchPage(0, who);
        setSummary(data);
        setPhotos(data.photos);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos cargar las fotos.");
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    void reload(uploader);
  }, [reload, uploader]);

  async function loadMore() {
    setLoading(true);
    try {
      const data = await fetchPage(photos.length, uploader);
      setSummary(data);
      setPhotos((prev) => [...prev, ...data.photos.filter((p) => !prev.some((q) => q.id === p.id))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar más fotos.");
    } finally {
      setLoading(false);
    }
  }

  function changeUploader(value: string) {
    setLoading(true);
    setViewer(null);
    setUploader(value);
  }

  const current = viewer !== null ? photos[viewer] : null;
  const filteredTotal = uploader
    ? summary?.uploaders.find((u) => u.name === uploader)?.count ?? photos.length
    : summary?.total ?? 0;

  const move = useCallback(
    (delta: number) => {
      setViewer((v) => {
        if (v === null) return v;
        const next = v + delta;
        return next >= 0 && next < photos.length ? next : v;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    if (viewer === null || dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "Escape") setViewer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, dialog, move]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function downloadOne(photo: AdminPhoto) {
    if (!photo.photoUrl) return;
    try {
      const ext = photo.photoUrl.split("?")[0].split(".").pop() || "jpg";
      await downloadFromUrl(photo.photoUrl, `foto-boda-${photo.id.slice(0, 8)}.${ext}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "No pudimos descargar la foto.");
    }
  }

  async function confirmDelete(photo: AdminPhoto) {
    setWorking(true);
    try {
      await readJson(await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" }));
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setViewer((v) => {
        if (v === null) return v;
        const remaining = photos.length - 1;
        if (remaining <= 0) return null;
        return Math.min(v, remaining - 1);
      });
      setDialog(null);
      flash("La foto se eliminó.");
      void reload(uploader);
    } catch (e) {
      flash(e instanceof Error ? e.message : "No pudimos eliminar la foto.");
    } finally {
      setWorking(false);
    }
  }

  async function confirmDeleteTest() {
    setWorking(true);
    try {
      const data = await readJson(await fetch("/api/admin/photos/test", { method: "DELETE" }));
      setDialog(null);
      setViewer(null);
      flash(`Borramos ${data.removed ?? 0} fotos de prueba.`);
      await reload(uploader);
    } catch (e) {
      flash(e instanceof Error ? e.message : "No pudimos borrar las fotos de prueba.");
    } finally {
      setWorking(false);
    }
  }

  async function runReconcile() {
    setWorking(true);
    try {
      const data = await readJson(await fetch("/api/admin/photos/reconcile", { method: "POST" }));
      setDialog({ kind: "reconcile", result: data });
      await reload(uploader);
    } catch (e) {
      flash(e instanceof Error ? e.message : "No pudimos revisar las subidas incompletas.");
    } finally {
      setWorking(false);
    }
  }

  async function downloadAll() {
    stopZipRef.current = false;
    setZip({ part: 1, parts: 1, done: 0, inPart: 0, finishedParts: 0, finished: false });
    try {
      const data = await readJson(await fetch("/api/admin/photos/download", { cache: "no-store" }));
      const files = (data.files ?? []) as { url: string; filename: string }[];
      if (!files.length) {
        setZip(null);
        flash("Todavía no hay fotos para descargar.");
        return;
      }
      const parts = Math.ceil(files.length / ZIP_PART_SIZE);
      for (let p = 0; p < parts; p += 1) {
        const chunk = files.slice(p * ZIP_PART_SIZE, (p + 1) * ZIP_PART_SIZE);
        const writer = new ZipWriter();
        for (let i = 0; i < chunk.length; i += 1) {
          if (stopZipRef.current) {
            setZip(null);
            return;
          }
          setZip({ part: p + 1, parts, done: i, inPart: chunk.length, finishedParts: p, finished: false });
          try {
            const res = await fetch(chunk[i].url);
            if (res.ok) writer.add(chunk[i].filename, new Uint8Array(await res.arrayBuffer()));
          } catch {
            // una foto que falla no detiene la descarga de las demás
          }
        }
        saveBlob(writer.finish(), parts > 1 ? `fotos-boda-parte-${p + 1}.zip` : "fotos-boda.zip");
      }
      setZip({ part: parts, parts, done: 0, inPart: 0, finishedParts: parts, finished: true });
    } catch (e) {
      setZip((z) => (z ? { ...z, error: e instanceof Error ? e.message : "No pudimos preparar la descarga." } : z));
    }
  }

  const usedPct = summary ? Math.min(100, Math.round((summary.totalBytes / summary.maxBytes) * 100)) : 0;

  return (
    <main className="min-h-screen bg-[#F5F1E8] px-4 py-8 text-[#15351f]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6B6648]">Panel de los novios</p>
            <h1 className="font-display mt-1 text-4xl text-[#154D35]">Fotos de la noche</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="admin-btn-outline flex min-h-11 items-center gap-1.5" href="/admin">
              <ArrowLeft size={15} /> Volver a invitados
            </Link>
            <a
              className="admin-btn-outline flex min-h-11 items-center gap-1.5"
              href="/fotos/galeria"
              rel="noreferrer"
              target="_blank"
            >
              <Camera size={15} /> Ver galería de invitados
            </a>
            <button
              className="admin-btn-primary flex min-h-11 items-center gap-1.5 disabled:opacity-60"
              disabled={!summary?.total || Boolean(zip)}
              onClick={() => (summary?.staleCount ? setDialog({ kind: "reconcile" }) : void downloadAll())}
              type="button"
            >
              <Download size={15} /> Descargar todas (ZIP)
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#837E5E]/15 bg-white p-4">
            <p className="text-xs text-[#6B6648]">Fotos guardadas</p>
            <p className="font-display mt-1 text-3xl text-[#154D35]">{summary?.total ?? "–"}</p>
            {summary?.testCount ? <p className="text-xs text-[#6B6648]">{summary.testCount} de prueba</p> : null}
          </div>
          <div className="rounded-2xl border border-[#837E5E]/15 bg-white p-4">
            <p className="text-xs text-[#6B6648]">Personas que compartieron</p>
            <p className="font-display mt-1 text-3xl text-[#154D35]">
              {summary ? summary.people.guest + summary.people.qr : "–"}
            </p>
            {summary ? (
              <p className="text-xs text-[#6B6648]">
                {summary.people.guest} por invitación · {summary.people.qr} por QR
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[#837E5E]/15 bg-white p-4">
            <p className="text-xs text-[#6B6648]">Espacio usado</p>
            <p className="font-display mt-1 text-3xl text-[#154D35]">
              {summary ? formatMb(summary.totalBytes) : "–"}{" "}
              <span className="font-sans text-sm text-[#6B6648]">de {summary ? formatMb(summary.maxBytes) : "900 MB"}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#154D35]/12">
              <div className="h-1.5 rounded-full bg-[#154D35]" style={{ width: `${usedPct}%` }} />
            </div>
          </div>
          <div
            className={`rounded-2xl border p-4 ${summary?.staleCount ? "border-[#A06E1E]/35 bg-[#FBF3E2]" : "border-[#837E5E]/15 bg-white"}`}
          >
            <p className={`text-xs ${summary?.staleCount ? "text-[#6A4A1A]" : "text-[#6B6648]"}`}>Subidas incompletas</p>
            <p className={`font-display mt-1 text-3xl ${summary?.staleCount ? "text-[#7A4E0E]" : "text-[#154D35]"}`}>
              {summary?.staleCount ?? "–"}
            </p>
            {summary?.staleCount ? (
              <button
                className="text-xs font-semibold text-[#7A4E0E] underline underline-offset-2"
                onClick={() => setDialog({ kind: "reconcile" })}
                type="button"
              >
                Recuperar o limpiar
              </button>
            ) : null}
          </div>
        </div>

        {/* Filtros y mantenimiento */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-sm font-semibold" htmlFor="photo-uploader">
              Mostrar
            </label>
            <select
              className="admin-input min-h-11"
              id="photo-uploader"
              onChange={(e) => changeUploader(e.target.value)}
              value={uploader}
            >
              <option value="">Todas las personas ({summary?.total ?? 0})</option>
              {summary?.uploaders.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.name} ({u.count})
                </option>
              ))}
            </select>
            <span className="text-sm text-[#6B6648]">Más recientes primero</span>
          </div>
          {summary?.testCount ? (
            <button
              className="flex min-h-11 items-center gap-2 rounded-full border border-[#A63C30]/35 bg-white px-4 text-sm font-semibold text-[#8A2E24]"
              onClick={() => setDialog({ kind: "test" })}
              type="button"
            >
              <Trash2 size={15} /> Borrar fotos de prueba ({summary.testCount})
            </button>
          ) : null}
        </div>

        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {/* Grilla */}
        {!loading && !error && photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#837E5E]/40 bg-white/60 px-6 py-16 text-center">
            <Camera className="mx-auto text-[#837E5E]" size={32} strokeWidth={1.6} />
            <p className="font-display mt-3 text-2xl text-[#154D35]">Todavía no hay fotos</p>
            <p className="mt-1 text-sm text-[#6B6648]">
              Aquí aparecerán los recuerdos que compartan sus invitados desde el sábado 31 a las 18:00.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
          {photos.map((p, i) => (
            <button
              className="focus-ring flex min-w-0 flex-col gap-1.5 text-left"
              key={p.id}
              onClick={() => setViewer(i)}
              type="button"
            >
              <PhotoTile photo={p} />
              <span className="hidden truncate text-[0.8rem] font-semibold sm:block">{p.uploaderName}</span>
              <span className="-mt-1 hidden text-xs text-[#6B6648] sm:block">{formatWhen(p.createdAt)}</span>
            </button>
          ))}
        </div>

        {photos.length > 0 ? (
          <div className="flex flex-col items-center gap-2">
            {photos.length < filteredTotal ? (
              <button
                className="admin-btn-outline min-h-12 px-7 disabled:opacity-60"
                disabled={loading}
                onClick={() => void loadMore()}
                type="button"
              >
                {loading ? "Cargando…" : `Cargar ${PAGE_SIZE} fotos más`}
              </button>
            ) : null}
            <span className="text-sm text-[#6B6648]">
              Mostrando {photos.length} de {filteredTotal}
            </span>
          </div>
        ) : null}
        {loading && photos.length === 0 ? <p className="text-center text-sm text-[#6B6648]">Cargando fotos…</p> : null}
      </div>

      {/* Visor */}
      {current ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#08120A]/97 px-4 pb-5 pt-4 text-[#F7F3EA] sm:px-8"
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
            touchStartX.current = null;
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display truncate text-xl sm:text-2xl">{current.uploaderName}</p>
              <p className="text-sm capitalize text-[#C9C5B2]">
                {longFormatter.format(new Date(current.createdAt))}
                {current.accessMode === "qr" ? " · por QR" : current.accessMode === "guest" ? " · por invitación" : " · prueba"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-sm text-[#C9C5B2] sm:inline">
                {viewer! + 1} de {filteredTotal}
              </span>
              <button
                aria-label="Cerrar visor"
                className="focus-ring grid h-12 w-12 place-items-center rounded-full border border-[#F7F3EA]/30"
                onClick={() => setViewer(null)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="relative my-4 flex min-h-0 flex-1 items-center justify-center">
            {current.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase
              <img
                alt={`Foto de ${current.uploaderName}`}
                className="max-h-full max-w-full rounded-lg object-contain"
                src={current.photoUrl}
              />
            ) : (
              <div className="grid h-64 w-64 place-items-center rounded-lg bg-[#154D35] text-[#F7F3EA]/70">
                <Camera size={40} />
              </div>
            )}
            <button
              aria-label="Foto anterior"
              className="focus-ring absolute left-0 top-1/2 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-[#F7F3EA]/30 bg-[#F7F3EA]/6 disabled:opacity-30 sm:grid"
              disabled={viewer === 0}
              onClick={() => move(-1)}
              type="button"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              aria-label="Foto siguiente"
              className="focus-ring absolute right-0 top-1/2 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-[#F7F3EA]/30 bg-[#F7F3EA]/6 disabled:opacity-30 sm:grid"
              disabled={viewer === photos.length - 1}
              onClick={() => move(1)}
              type="button"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              className="focus-ring flex min-h-12 items-center gap-2 rounded-full bg-[#F7F3EA] px-6 text-[0.95rem] font-semibold text-[#0C1D0E]"
              onClick={() => void downloadOne(current)}
              type="button"
            >
              <Download size={18} /> Descargar
            </button>
            <button
              className="focus-ring flex min-h-12 items-center gap-2 rounded-full border border-[#E68C7D]/60 px-6 text-[0.95rem] font-semibold text-[#F6D3CC]"
              onClick={() => setDialog({ kind: "delete", photo: current })}
              type="button"
            >
              <Trash2 size={18} /> Eliminar
            </button>
            <span className="hidden text-[0.8rem] text-[#A8A48E] lg:inline">
              Flechas del teclado o deslizar para pasar de foto · Esc para cerrar
            </span>
          </div>
        </div>
      ) : null}

      {/* Diálogos */}
      {dialog?.kind === "delete" ? (
        <Modal onClose={() => !working && setDialog(null)}>
          <h2 className="font-display text-2xl text-[#154D35]">¿Eliminar esta foto?</h2>
          <p className="mt-3 leading-7 text-[#3D4A3F]">
            {dialog.photo.uploaderName} · {formatWhen(dialog.photo.createdAt)}. Se borrará para siempre y no se
            puede recuperar.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <button className="admin-btn-outline min-h-11 px-5" disabled={working} onClick={() => setDialog(null)} type="button">
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-full bg-[#9A3328] px-5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={working}
              onClick={() => void confirmDelete(dialog.photo)}
              type="button"
            >
              {working ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </div>
        </Modal>
      ) : null}

      {dialog?.kind === "test" ? (
        <Modal onClose={() => !working && setDialog(null)}>
          <h2 className="font-display text-2xl text-[#154D35]">¿Borrar las fotos de prueba?</h2>
          <p className="mt-3 leading-7 text-[#3D4A3F]">
            Se borrarán las {summary?.testCount ?? 0} fotos que subieron ustedes en modo prueba. Las fotos de los
            invitados no se tocan.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <button className="admin-btn-outline min-h-11 px-5" disabled={working} onClick={() => setDialog(null)} type="button">
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-full bg-[#9A3328] px-5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={working}
              onClick={() => void confirmDeleteTest()}
              type="button"
            >
              {working ? "Borrando…" : `Borrar ${summary?.testCount ?? 0} fotos de prueba`}
            </button>
          </div>
        </Modal>
      ) : null}

      {dialog?.kind === "reconcile" ? (
        <Modal onClose={() => !working && setDialog(null)}>
          <h2 className="font-display text-2xl text-[#154D35]">Subidas incompletas</h2>
          {dialog.result ? (
            <>
              <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#154D35]/8 px-4 py-3 font-semibold text-[#154D35]">
                <Check size={20} /> Recuperamos {dialog.result.rescued} {dialog.result.rescued === 1 ? "foto" : "fotos"} y
                limpiamos {dialog.result.removed}.
              </div>
              <div className="mt-6 flex justify-end">
                <button className="admin-btn-primary min-h-11 px-6" onClick={() => setDialog(null)} type="button">
                  Listo
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 leading-7 text-[#3D4A3F]">
                Encontramos {summary?.staleCount ?? 0} subidas que no terminaron, probablemente por la señal.
                Revisamos cada una: si la foto llegó, la recuperamos; si no, la limpiamos.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <button className="admin-btn-outline min-h-11 px-5" disabled={working} onClick={() => setDialog(null)} type="button">
                  Ahora no
                </button>
                <button
                  className="admin-btn-primary flex min-h-11 items-center gap-2 px-5 disabled:opacity-60"
                  disabled={working}
                  onClick={() => void runReconcile()}
                  type="button"
                >
                  <RefreshCw size={15} /> {working ? "Revisando…" : "Recuperar o limpiar"}
                </button>
              </div>
            </>
          )}
        </Modal>
      ) : null}

      {zip ? (
        <Modal>
          <h2 className="font-display text-2xl text-[#154D35]">
            {zip.finished ? "Sus fotos están listas" : "Preparando sus fotos"}
          </h2>
          {zip.error ? (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{zip.error}</p>
          ) : zip.finished ? (
            <p className="mt-3 leading-7 text-[#3D4A3F]">
              Descargamos {zip.parts} {zip.parts === 1 ? "archivo" : "partes"}. Revisen la carpeta de descargas.
            </p>
          ) : (
            <>
              <p className="mt-3 text-[#3D4A3F]">
                Parte {zip.part} de {zip.parts} · {zip.done} de {zip.inPart || "…"} fotos
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#154D35]/12">
                <div
                  className="h-2 rounded-full bg-[#154D35] transition-[width]"
                  style={{ width: `${zip.inPart ? Math.round((zip.done / zip.inPart) * 100) : 4}%` }}
                />
              </div>
              {zip.parts > 1 ? (
                <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                  {Array.from({ length: zip.parts }, (_, i) => (
                    <li className="flex justify-between" key={i}>
                      <span>fotos-boda-parte-{i + 1}.zip</span>
                      <span className={i < zip.finishedParts ? "font-semibold text-[#154D35]" : i === zip.part - 1 ? "font-semibold" : "text-[#6B6648]"}>
                        {i < zip.finishedParts ? "Descargada" : i === zip.part - 1 ? "Preparando…" : "En espera"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-4 text-[0.8rem] leading-5 text-[#6B6648]">
                No cierren esta pestaña. Cada parte se descarga sola al terminar.
              </p>
            </>
          )}
          <div className="mt-6 flex justify-end">
            {zip.finished || zip.error ? (
              <button className="admin-btn-primary min-h-11 px-6" onClick={() => setZip(null)} type="button">
                Listo
              </button>
            ) : (
              <button
                className="admin-btn-outline min-h-11 px-5"
                onClick={() => {
                  stopZipRef.current = true;
                }}
                type="button"
              >
                Detener
              </button>
            )}
          </div>
        </Modal>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[#0C1D0E] px-5 py-3 text-sm text-[#F7F3EA] shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

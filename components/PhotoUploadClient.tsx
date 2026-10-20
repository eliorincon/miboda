"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  Clock,
  Heart,
  ImagePlus,
  Images,
  Link2,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "./Countdown";
import { detectImageType, isImageFile, preparePhoto, type PreparedPhoto } from "@/lib/photo-prepare";
import type { PhotoWindowState } from "@/lib/settings";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export type PhotoPageMode = "guest" | "qr" | "admin" | "invalid";

type Props = {
  mode: PhotoPageMode;
  displayName: string;
  code: string | null;
  eventKey: string | null;
  windowState: PhotoWindowState;
  opensAt: string;
  closesAt: string;
  serverNow: number;
  isAdminTest: boolean;
  simular: string | null;
  initialRemaining: number | null;
  limit: number | null;
  maxPerUploader: number;
  seats: number;
  bucket: string;
};

type ItemStatus = "queued" | "preparing" | "uploading" | "retrying" | "saved" | "failed";

type Item = {
  id: string;
  label: string;
  preview: string;
  status: ItemStatus;
  retryIn?: number;
  message?: string;
};

type Work = {
  prepared?: PreparedPhoto;
  upload?: {
    photoId: string;
    photoPath: string;
    photoToken: string;
    thumbPath: string;
    thumbToken: string;
    at: number;
  };
  photoDone?: boolean;
  thumbDone?: boolean;
};

const NAME_STORAGE_KEY = "fotos-boda-nombre";
const RETRY_DELAYS = [2, 5, 10];
const MAX_PARALLEL = 2;
// Las URLs firmadas duran 2 horas; se renuevan antes por seguridad
const UPLOAD_URL_MAX_AGE_MS = 100 * 60 * 1000;
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "56963434353";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola, tengo más fotos de la boda para compartirles 💛",
)}`;

/** Error que no vale la pena reintentar (ventana cerrada, límite, foto ilegible…) */
class FatalUploadError extends Error {
  limitReached: boolean;
  constructor(message: string, limitReached = false) {
    super(message);
    this.limitReached = limitReached;
  }
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

// ─── Piezas visuales ─────────────────────────────────────────────────────────

function Shell({ children, isAdminTest, simular }: { children: ReactNode; isAdminTest: boolean; simular: string | null }) {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-5 pb-8 pt-6 text-[#F7F3EA]">
      {isAdminTest ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-[#F7F3EA] px-3.5 py-2.5 text-[0.8rem] font-semibold leading-5 text-[#154D35]">
          <ShieldCheck className="mt-0.5 shrink-0" size={16} />
          <span>
            Modo prueba (admin): la ventana horaria está desactivada para ti.
            {simular ? ` Simulando: ${simular}.` : ""}
          </span>
        </div>
      ) : null}
      {children}
    </main>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <p className={`font-script leading-none text-[#A39F88] ${compact ? "text-[1.75rem]" : "text-[2.1rem]"}`}>
        Zequelly &amp; Elio
      </p>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#A39F88]">
        Nuestra noche en fotos
      </p>
    </div>
  );
}

function IconBadge({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-16 w-16 place-items-center rounded-full border border-[#A39F88]/45 bg-[#0C1D0E]/40 text-[#A39F88]">
      {children}
    </div>
  );
}

function PrivacyNote({ plural }: { plural: boolean }) {
  return (
    <p className="flex items-center justify-center gap-2 text-[0.8rem] text-[#C9C5B2]">
      <Lock size={15} /> Solo Zequelly y Elio podrán ver {plural ? "sus" : "tus"} fotos
    </p>
  );
}

const primaryBtn =
  "focus-ring flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full bg-[#F7F3EA] px-6 text-base font-semibold text-[#0C1D0E] shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition active:scale-[0.99] disabled:opacity-60";
const secondaryBtn =
  "focus-ring flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full border border-[#F7F3EA]/40 px-6 text-[0.95rem] font-semibold text-[#F7F3EA] transition active:scale-[0.99]";
const glassCard = "rounded-3xl border border-[#F7F3EA]/16 bg-[#F7F3EA]/8";

const STATUS_STYLE: Record<ItemStatus, string> = {
  queued: "bg-[#F7F3EA]/12 text-[#E8E4D6]",
  preparing: "bg-[#F7F3EA]/12 text-[#E8E4D6]",
  uploading: "bg-[#154D35]/90 text-[#F7F3EA]",
  retrying: "bg-[#D6AA5A]/22 text-[#F3E6C8]",
  saved: "bg-[#F7F3EA]/92 text-[#0C1D0E]",
  failed: "bg-[#C45C4E]/22 text-[#F6D3CC]",
};

function statusLabel(item: Item) {
  switch (item.status) {
    case "queued":
      return "En cola";
    case "preparing":
      return "Preparando…";
    case "uploading":
      return "Subiendo…";
    case "retrying":
      return `Reintentando en ${item.retryIn ?? 0} s`;
    case "saved":
      return "Guardada";
    case "failed":
      return "No se pudo subir";
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export function PhotoUploadClient(props: Props) {
  const { mode, isAdminTest, simular, bucket } = props;
  const plural = mode === "guest" && props.seats > 1;

  const [windowState, setWindowState] = useState<PhotoWindowState>(props.windowState);
  const [name, setName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(mode !== "qr");
  const [nameError, setNameError] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(props.initialRemaining);
  const [limit, setLimit] = useState<number | null>(props.limit);
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const itemsRef = useRef<Item[]>([]);
  const filesRef = useRef(new Map<string, File>());
  const workRef = useRef(new Map<string, Work>());
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(0);
  const prepChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const nameRef = useRef("");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ── Ventana horaria: cambia sola al llegar la hora (con el reloj del servidor)
  useEffect(() => {
    if (isAdminTest) return;
    const offset = props.serverNow - Date.now();
    const timers: number[] = [];
    const schedule = (iso: string, next: PhotoWindowState) => {
      const ms = new Date(iso).getTime() - (Date.now() + offset);
      if (ms > 0 && ms < 2_147_000_000) timers.push(window.setTimeout(() => setWindowState(next), ms + 500));
    };
    schedule(props.opensAt, "open");
    schedule(props.closesAt, "after");
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [isAdminTest, props.serverNow, props.opensAt, props.closesAt]);

  // ── Nombre recordado (modo QR)
  useEffect(() => {
    if (mode !== "qr") return;
    try {
      const saved = window.localStorage.getItem(NAME_STORAGE_KEY);
      if (saved) window.setTimeout(() => setName(saved), 0);
    } catch {
      // sin almacenamiento disponible: se pedirá el nombre
    }
  }, [mode]);

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    itemsRef.current = itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it));
    setItems(itemsRef.current);
  }, []);

  const busy = items.some((it) => it.status !== "saved" && it.status !== "failed");

  // ── Aviso al cerrar la página con subidas en curso
  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  // ── Liberar las miniaturas locales al salir
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) URL.revokeObjectURL(it.preview);
    };
  }, []);

  const accessPayload = useCallback(() => {
    if (mode === "guest") return { code: props.code ?? undefined, simular: simular ?? undefined };
    if (mode === "qr")
      return { k: props.eventKey ?? undefined, uploaderName: nameRef.current, simular: simular ?? undefined };
    return { simular: simular ?? undefined };
  }, [mode, props.code, props.eventKey, simular]);

  async function postJson(url: string, body: unknown, { retryOn409 = false } = {}) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("network");
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const message: string = data?.error || "Parece que la señal está débil. Vamos a intentarlo de nuevo…";
    if (res.status >= 500 || (res.status === 409 && retryOn409)) throw new Error(message);
    throw new FatalUploadError(message, res.status === 409 && /compartiste|compartieron/.test(message));
  }

  function withPrepLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = prepChainRef.current.then(fn, fn);
    prepChainRef.current = run.catch(() => undefined);
    return run;
  }

  async function runSteps(id: string) {
    const file = filesRef.current.get(id);
    const work = workRef.current.get(id) ?? {};
    workRef.current.set(id, work);
    if (!file || !supabase) throw new FatalUploadError("La galería no está disponible en este momento.");

    if (!work.prepared) {
      updateItem(id, { status: "preparing", message: undefined });
      try {
        work.prepared = await withPrepLock(() => preparePhoto(file));
      } catch {
        throw new FatalUploadError("Esta foto no se pudo preparar.");
      }
    }
    const prepared = work.prepared;
    updateItem(id, { status: "uploading", message: undefined });

    if (!work.upload || Date.now() - work.upload.at > UPLOAD_URL_MAX_AGE_MS) {
      const res = await postJson("/api/photos/upload-url", {
        ...accessPayload(),
        contentType: prepared.contentType,
        size: prepared.photo.size,
        thumbSize: prepared.thumb.size,
      });
      work.upload = { ...res, at: Date.now() };
      work.photoDone = false;
      work.thumbDone = false;
      if ("remaining" in res) setRemaining(res.remaining);
    }
    const up = work.upload!;
    const storage = supabase.storage.from(bucket);

    if (!work.photoDone) {
      const { error } = await storage.uploadToSignedUrl(up.photoPath, up.photoToken, prepared.photo, {
        contentType: prepared.contentType,
      });
      if (error && !/exist|duplicate/i.test(error.message)) throw new Error(error.message);
      work.photoDone = true;
    }
    if (!work.thumbDone) {
      const { error } = await storage.uploadToSignedUrl(up.thumbPath, up.thumbToken, prepared.thumb, {
        contentType: "image/jpeg",
      });
      if (error && !/exist|duplicate/i.test(error.message)) throw new Error(error.message);
      work.thumbDone = true;
    }

    const done = await postJson(
      "/api/photos/complete",
      { ...accessPayload(), photoId: up.photoId, width: prepared.width, height: prepared.height },
      { retryOn409: true },
    );
    if ("remaining" in done) setRemaining(done.remaining);
    // Listo: soltar los archivos grandes de la memoria
    work.prepared = undefined;
    filesRef.current.delete(id);
  }

  async function processItem(id: string) {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
      try {
        await runSteps(id);
        updateItem(id, { status: "saved", retryIn: undefined, message: undefined });
        return;
      } catch (e) {
        if (e instanceof FatalUploadError) {
          updateItem(id, { status: "failed", message: e.message });
          if (e.limitReached) setRemaining(0);
          return;
        }
        if (attempt === RETRY_DELAYS.length) {
          updateItem(id, { status: "failed", message: "Parece que la señal está débil." });
          return;
        }
        for (let s = RETRY_DELAYS[attempt]; s > 0; s -= 1) {
          updateItem(id, { status: "retrying", retryIn: s });
          await sleep(1000);
        }
      }
    }
  }

  function pump() {
    while (runningRef.current < MAX_PARALLEL && queueRef.current.length) {
      const id = queueRef.current.shift()!;
      runningRef.current += 1;
      processItem(id).finally(() => {
        runningRef.current -= 1;
        pump();
      });
    }
  }

  function addFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const all = Array.from(list);
    const images = all.filter(isImageFile);
    const rejected = all.length - images.length;

    // Fotos ya elegidas que aún no reservaron su lugar en el servidor
    const unreserved = itemsRef.current.filter(
      (it) => (it.status === "queued" || it.status === "preparing") && !workRef.current.get(it.id)?.upload,
    ).length;
    const allowed = remaining === null ? images.length : Math.max(0, remaining - unreserved);
    const accepted = images.slice(0, allowed);

    const messages: string[] = [];
    if (rejected) messages.push("Por ahora solo podemos recibir fotos 📷");
    if (accepted.length < images.length && limit !== null)
      messages.push(
        accepted.length
          ? `${plural ? "Pueden" : "Puedes"} compartir hasta ${limit} fotos. Elegimos las primeras ${accepted.length} 💛`
          : `Ya ${plural ? "eligieron" : "elegiste"} todas las fotos que ${plural ? "pueden" : "puedes"} compartir 💛`,
      );
    setNotice(messages.length ? messages.join(" · ") : null);
    if (!accepted.length) return;

    const start = itemsRef.current.length;
    const newItems: Item[] = accepted.map((file, i) => {
      const id = `${Date.now().toString(36)}-${start + i}-${Math.random().toString(36).slice(2, 7)}`;
      filesRef.current.set(id, file);
      // HEIC no se puede mostrar en la mayoría de los navegadores: sin miniatura local
      const type = detectImageType(file);
      const preview = type === "image/heic" || type === "image/heif" ? "" : URL.createObjectURL(file);
      return { id, label: `Foto ${start + i + 1}`, preview, status: "queued" };
    });
    itemsRef.current = [...itemsRef.current, ...newItems];
    setItems(itemsRef.current);
    queueRef.current.push(...newItems.map((it) => it.id));
    pump();
  }

  function retry(id: string) {
    updateItem(id, { status: "queued", message: undefined });
    queueRef.current.push(id);
    pump();
  }

  async function confirmName(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2 || clean.length > 60) {
      setNameError("Cuéntanos tu nombre (entre 2 y 60 letras).");
      return;
    }
    setCheckingName(true);
    setNameError(null);
    try {
      nameRef.current = clean;
      const res = await fetch("/api/photos/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: props.eventKey, uploaderName: clean, simular: simular ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Parece que la señal está débil. Intenta de nuevo.");
      setRemaining(data.remaining ?? null);
      setLimit(data.limit ?? null);
      setName(clean);
      setNameConfirmed(true);
      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, clean);
      } catch {
        // sin almacenamiento: no pasa nada
      }
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Intenta de nuevo, por favor.");
    } finally {
      setCheckingName(false);
    }
  }

  // ─── Pantallas ───────────────────────────────────────────────────────────

  if (mode === "invalid") {
    return (
      <Shell isAdminTest={false} simular={null}>
        <Brand />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <IconBadge>
            <Link2 size={28} strokeWidth={1.6} />
          </IconBadge>
          <h1 className="text-balance font-display text-[2rem] leading-tight">Este enlace no es válido</h1>
          <p className="text-pretty leading-7 text-[#E8E4D6]">
            Para compartir tus fotos, escanea el código de tu mesa o abre el enlace de tu invitación.
          </p>
          <div className="mt-1 grid w-full grid-cols-2 gap-2.5">
            <div className={`${glassCard} flex flex-col items-center gap-2 px-3 py-4`}>
              <QrCode className="text-[#A39F88]" size={24} strokeWidth={1.6} />
              <span className="text-sm text-[#E8E4D6]">Código QR de tu mesa</span>
            </div>
            <div className={`${glassCard} flex flex-col items-center gap-2 px-3 py-4`}>
              <Mail className="text-[#A39F88]" size={24} strokeWidth={1.6} />
              <span className="text-sm text-[#E8E4D6]">Enlace de tu invitación</span>
            </div>
          </div>
        </div>
        <Link className={primaryBtn} href="/">
          Ir a la invitación
        </Link>
      </Shell>
    );
  }

  const backHref = mode === "guest" && props.code ? `/invitado/${props.code}` : "/";

  if (windowState === "before" || windowState === "disabled") {
    return (
      <Shell isAdminTest={isAdminTest} simular={simular}>
        <Brand />
        <div className="mt-10 flex flex-col items-center gap-6 text-center">
          <IconBadge>
            <Clock size={28} strokeWidth={1.6} />
          </IconBadge>
          <div className="flex flex-col gap-3.5">
            <h1 className="text-balance font-display text-[2rem] leading-tight">Este rincón se abrirá muy pronto</h1>
            <p className="text-pretty leading-7 text-[#E8E4D6]">
              Se abrirá el sábado 31 de octubre a las 18:00 hrs, cuando comience nuestra celebración.
            </p>
          </div>
          <div className="w-full">
            <Countdown target={props.opensAt} variant="compact" />
          </div>
          <div className="w-full rounded-[1.25rem] border border-[#837E5E]/45 px-5 py-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A39F88]">Guarda esta idea</p>
            <p className="mt-1.5 text-[0.95rem] leading-6 text-[#E8E4D6]">
              Toma todas las fotos que quieras. Podrás subirlas hasta el lunes 2 de noviembre a las 23:59,
              incluso desde tu casa con WiFi.
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <Link className={`${secondaryBtn} mt-8`} href={backHref}>
          <ArrowLeft size={18} /> Volver a mi invitación
        </Link>
      </Shell>
    );
  }

  if (windowState === "after") {
    return (
      <Shell isAdminTest={isAdminTest} simular={simular}>
        <p className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#A39F88]">
          Nuestra noche en fotos
        </p>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <h1 className="text-balance font-display text-[2.25rem] leading-tight">Gracias por regalarnos tu mirada</h1>
          <div className="gold-line w-44" />
          <p className="text-pretty leading-7 text-[#E8E4D6]">
            La subida de fotos cerró el lunes 2 de noviembre. Cada imagen que nos compartiste es un recuerdo que
            vamos a guardar para siempre.
          </p>
          <p className="mt-2 font-script text-[2.5rem] leading-tight text-[#A39F88]">
            Con amor,
            <br />
            Zequelly &amp; Elio
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-[#837E5E]/45 px-4 py-4">
          <span className="text-sm text-[#E8E4D6]">¿Te quedaron fotos sin compartir?</span>
          <a className={secondaryBtn} href={WHATSAPP_URL} rel="noreferrer" target="_blank">
            <MessageCircle size={20} /> Escríbenos por WhatsApp
          </a>
        </div>
      </Shell>
    );
  }

  if (mode === "qr" && !nameConfirmed) {
    return (
      <Shell isAdminTest={isAdminTest} simular={simular}>
        <Brand />
        <form className="mt-12 flex flex-col items-center gap-6 text-center" onSubmit={confirmName}>
          <div className="flex flex-col gap-3.5">
            <h1 className="text-balance font-display text-[2rem] leading-tight">Qué alegría tenerte aquí</h1>
            <p className="text-pretty leading-7 text-[#E8E4D6]">
              Antes de compartir tus fotos, cuéntanos quién eres para saber de quién es cada recuerdo.
            </p>
          </div>
          <div className={`${glassCard} flex w-full flex-col gap-2.5 px-5 py-6 text-left`}>
            <label className="font-display text-[1.375rem]" htmlFor="uploader-name">
              ¿Cómo te llamas?
            </label>
            <input
              autoComplete="name"
              className="min-h-14 w-full rounded-2xl border border-[#F7F3EA]/35 bg-[#0C1D0E]/55 px-[18px] text-[1.0625rem] text-[#F7F3EA] outline-none placeholder:text-[#8E8A74] focus:border-[#F7F3EA]/70"
              id="uploader-name"
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: Tía Carmen"
              type="text"
              value={name}
            />
            <span className="text-[0.8rem] leading-5 text-[#C9C5B2]">
              Puede ser tu nombre o el de tu familia. Lo recordaremos en este celular.
            </span>
            {nameError ? <span className="text-sm text-[#F6D3CC]">{nameError}</span> : null}
          </div>
          <button className={primaryBtn} disabled={checkingName} type="submit">
            {checkingName ? "Un momento…" : "Continuar"}
          </button>
        </form>
        <div className="flex-1" />
        <div className="mt-8">
          <PrivacyNote plural={false} />
        </div>
      </Shell>
    );
  }

  const savedItems = items.filter((it) => it.status === "saved");
  const saved = savedItems.length;
  const total = items.length;
  const retrying = items.some((it) => it.status === "retrying");
  const shared = limit !== null && remaining !== null ? Math.max(0, limit - remaining) : null;
  const greetingName = mode === "qr" ? name : props.displayName;

  // Límite alcanzado y nada pendiente
  if (remaining === 0 && !busy) {
    return (
      <Shell isAdminTest={isAdminTest} simular={simular}>
        <Brand />
        <div className="mt-8 flex flex-col items-center gap-5 text-center">
          <IconBadge>
            <Heart size={28} strokeWidth={1.6} />
          </IconBadge>
          <div className="flex flex-col gap-3">
            <h1 className="text-balance font-display text-[1.9rem] leading-tight">
              {plural ? `Ya compartieron sus ${limit} fotos` : `Ya compartiste tus ${limit} fotos`}
            </h1>
            <p className="text-pretty leading-7 text-[#E8E4D6]">
              {plural
                ? "Gracias por regalarnos tantos recuerdos. Si les quedaron más que quieran compartirnos, escríbannos."
                : "Gracias por regalarnos tantos recuerdos. Si te quedaron más que quieras compartirnos, escríbenos."}
            </p>
          </div>
          {savedItems.length ? (
            <div className="flex w-full flex-col gap-2.5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A39F88]">
                Las fotos de esta visita
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {savedItems.slice(0, 7).map((it) => (
                  <Thumb item={it} key={it.id} />
                ))}
                {savedItems.length > 7 ? (
                  <div className="grid aspect-square place-items-center rounded-[10px] bg-[#F7F3EA]/10 text-sm text-[#E8E4D6]">
                    +{savedItems.length - 7}
                  </div>
                ) : null}
              </div>
              <p className="text-[0.8rem] text-[#C9C5B2]">Todas quedaron guardadas con cariño.</p>
            </div>
          ) : null}
        </div>
        <div className="flex-1" />
        <div className="mt-8 flex flex-col gap-3">
          <a className={primaryBtn} href={WHATSAPP_URL} rel="noreferrer" target="_blank">
            <MessageCircle size={20} /> Escribirnos por WhatsApp
          </a>
          <Link className={secondaryBtn} href={backHref}>
            Volver a la invitación
          </Link>
        </div>
      </Shell>
    );
  }

  const fileInputs = (
    <>
      <input
        accept="image/*"
        className="hidden"
        multiple
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
        ref={galleryInputRef}
        type="file"
      />
      <input
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
        ref={cameraInputRef}
        type="file"
      />
    </>
  );

  const counterText =
    mode === "admin"
      ? `${saved} ${saved === 1 ? "foto de prueba" : "fotos de prueba"} en esta visita`
      : shared !== null && limit !== null
        ? `${plural ? "Han" : "Has"} compartido ${shared} de ${limit} fotos`
        : null;

  // Abierta, todavía sin fotos elegidas
  if (!total) {
    return (
      <Shell isAdminTest={isAdminTest} simular={simular}>
        {fileInputs}
        <Brand />
        <div className="mt-6 flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-3.5">
            <h1 className="font-display text-[2.1rem] leading-tight">Hola, {greetingName}</h1>
            <p className="text-pretty leading-7 text-[#E8E4D6]">
              {plural
                ? "Cada foto que tomen será un recuerdo para siempre. Súbanlas aquí: solo nosotros podremos verlas."
                : "Cada foto que tomes será un recuerdo para siempre. Súbelas aquí: solo nosotros podremos verlas."}
            </p>
          </div>
          {limit !== null && remaining !== null ? (
            <p className="flex items-center gap-2 rounded-full border border-[#F7F3EA]/18 bg-[#F7F3EA]/10 px-4 py-2 text-sm text-[#E8E4D6]">
              <Heart size={16} />
              {remaining === limit
                ? `${plural ? "Pueden" : "Puedes"} compartir hasta ${limit} fotos`
                : `${plural ? "Les" : "Te"} quedan ${remaining} de ${limit} fotos`}
            </p>
          ) : null}
          <div className="flex w-full flex-col gap-3">
            <button className={`${primaryBtn} min-h-16 text-[1.0625rem]`} onClick={() => galleryInputRef.current?.click()} type="button">
              <Images size={22} /> Elegir fotos
            </button>
            <button className={secondaryBtn} onClick={() => cameraInputRef.current?.click()} type="button">
              <Camera size={20} /> Tomar una foto ahora
            </button>
            <span className="text-[0.8rem] text-[#C9C5B2]">
              {plural ? "Pueden" : "Puedes"} elegir varias a la vez desde la galería.
            </span>
            {notice ? <p className="text-sm text-[#F3E6C8]">{notice}</p> : null}
          </div>
        </div>
        <div className="flex-1" />
        <div className="mt-8 flex flex-col gap-4">
          <div className="flex gap-3 rounded-[1.25rem] border border-[#837E5E]/45 px-4 py-4 text-left">
            <Wifi className="mt-0.5 shrink-0 text-[#A39F88]" size={20} />
            <span className="text-sm leading-6 text-[#E8E4D6]">
              ¿Poca señal en el salón? No pasa nada: {plural ? "pueden" : "puedes"} subirlas mañana con WiFi.{" "}
              {plural ? "Tienen" : "Tienes"} hasta el lunes 2 de noviembre a las 23:59.
            </span>
          </div>
          <PrivacyNote plural={plural} />
        </div>
      </Shell>
    );
  }

  // Subiendo / con fotos de esta visita
  const canAddMore = remaining === null || remaining > 0;
  return (
    <Shell isAdminTest={isAdminTest} simular={simular}>
      {fileInputs}
      <div className="flex items-center justify-between">
        <p className="font-script text-[1.75rem] leading-none text-[#A39F88]">Zequelly &amp; Elio</p>
        <p className="max-w-[55%] truncate text-[0.8rem] text-[#C9C5B2]">{greetingName}</p>
      </div>

      <div className={`${glassCard} mt-4 flex flex-col gap-2.5 px-[18px] py-4`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-[1.375rem]">
            {busy ? "Subiendo tus recuerdos" : "Tus fotos quedaron guardadas"}
          </span>
          <span className="shrink-0 text-[0.8rem] text-[#C9C5B2]">
            {saved} de {total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#F7F3EA]/14">
          <div
            className="h-1.5 rounded-full bg-[#F7F3EA] transition-[width] duration-500"
            style={{ width: `${total ? Math.round((saved / total) * 100) : 0}%` }}
          />
        </div>
        <span className="text-[0.8rem] text-[#C9C5B2]">
          {busy ? "Mantén esta página abierta hasta que terminen." : "Tu foto quedó guardada con cariño."}
        </span>
      </div>

      {retrying ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#D6AA5A]/45 bg-[#D6AA5A]/14 px-3.5 py-3">
          <WifiOff className="shrink-0 text-[#E6C98C]" size={20} />
          <span className="text-sm leading-5 text-[#F3E6C8]">
            Parece que la señal está débil. Vamos a intentarlo de nuevo…
          </span>
        </div>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {items.map((it) => (
          <li
            className="flex items-center gap-3 rounded-2xl border border-[#F7F3EA]/10 bg-[#F7F3EA]/5 p-2"
            key={it.id}
          >
            <div className="h-[52px] w-[52px] shrink-0">
              <Thumb item={it} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-[#E8E4D6]">{it.label}</span>
                <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[it.status]}`}>
                  {it.status === "saved" ? (
                    <span className="inline-flex items-center gap-1">
                      <Check size={12} strokeWidth={3} /> Guardada
                    </span>
                  ) : (
                    statusLabel(it)
                  )}
                </span>
              </div>
              {it.status === "uploading" || it.status === "preparing" ? (
                <div className="h-1 overflow-hidden rounded-full bg-[#F7F3EA]/14">
                  <div className={`h-1 rounded-full bg-[#F7F3EA] ${it.status === "uploading" ? "w-2/3 animate-pulse" : "w-1/5"}`} />
                </div>
              ) : null}
              {it.status === "failed" ? (
                <div className="flex flex-wrap items-center gap-2">
                  {it.message ? <span className="text-xs text-[#F6D3CC]">{it.message}</span> : null}
                  {filesRef.current.has(it.id) && it.message !== "Esta foto no se pudo preparar." ? (
                    <button
                      className="focus-ring flex min-h-8 items-center gap-1.5 rounded-full border border-[#F7F3EA]/45 px-3.5 text-[0.8rem] font-semibold"
                      onClick={() => retry(it.id)}
                      type="button"
                    >
                      <RotateCcw size={14} /> Reintentar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex-1" />
      <div className="mt-6 flex flex-col items-center gap-2.5">
        {counterText ? <span className="text-sm text-[#E8E4D6]">{counterText}</span> : null}
        {notice ? <p className="text-center text-sm text-[#F3E6C8]">{notice}</p> : null}
        {canAddMore ? (
          <div className="grid w-full grid-cols-[1fr_auto] gap-2">
            <button className={secondaryBtn} onClick={() => galleryInputRef.current?.click()} type="button">
              <Plus size={20} /> Elegir más fotos
            </button>
            <button
              aria-label="Tomar una foto ahora"
              className="focus-ring grid min-h-[52px] w-[52px] place-items-center rounded-full border border-[#F7F3EA]/40"
              onClick={() => cameraInputRef.current?.click()}
              type="button"
            >
              <Camera size={20} />
            </button>
          </div>
        ) : null}
        <div className="mt-2">
          <PrivacyNote plural={plural} />
        </div>
      </div>
    </Shell>
  );
}

function Thumb({ item }: { item: Item }) {
  if (!item.preview) {
    return (
      <div className="grid aspect-square h-full w-full place-items-center rounded-[10px] bg-[#154D35] text-[#F7F3EA]/70">
        <ImagePlus size={20} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:), no pasa por next/image
    <img alt="" className="aspect-square h-full w-full rounded-[10px] object-cover" src={item.preview} />
  );
}

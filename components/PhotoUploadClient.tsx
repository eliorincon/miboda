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
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "./Countdown";
import { GUEST_CODE_STORAGE_KEY, PhotoTabBar } from "./PhotoTabBar";
import { detectImageType, isImageFile, preparePhoto, type PreparedPhoto } from "@/lib/photo-prepare";
import type { PhotoWindowState } from "@/lib/settings";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export type PhotoPageMode = "guest" | "qr" | "admin" | "invalid";

type Props = {
  mode: PhotoPageMode;
  displayName: string;
  code: string | null;
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
  /** Si falló, ¿vale la pena ofrecer "Reintentar"? */
  retryable?: boolean;
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

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Shell({
  children,
  isAdminTest,
  simular,
  shareHref,
}: {
  children: ReactNode;
  isAdminTest: boolean;
  simular: string | null;
  shareHref: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
    <div className="photo-app">
      <motion.main
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-5 pb-32 pt-6 text-[#F7F3EA]"
        initial={{ opacity: 0, y: 14 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
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
      </motion.main>
      <PhotoTabBar active="share" shareHref={shareHref} />
    </div>
    </MotionConfig>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <p className={`gold-text font-script leading-none ${compact ? "text-[1.75rem]" : "text-[2.4rem]"}`}>
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
    <div className="relative grid h-[72px] w-[72px] place-items-center">
      <motion.span
        animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-[#A39F88]/50"
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="photo-glass grid h-16 w-16 place-items-center rounded-full text-[#E9DFBF]">{children}</div>
    </div>
  );
}

/** Ilustración: pila de fotos que flota suavemente */
function PhotoStack() {
  const cards = [
    { rotate: -11, x: -34, y: 6, tone: "from-[#2E4A3A] to-[#154D35]" },
    { rotate: 9, x: 34, y: 2, tone: "from-[#6B5E45] to-[#3E5A44]" },
    { rotate: -2, x: 0, y: -4, tone: "from-[#E9DFBF] to-[#A39F88]" },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto h-32 w-44">
      {cards.map((c, i) => (
        <motion.div
          animate={{ rotate: c.rotate, x: c.x, y: [c.y, c.y - 5, c.y], opacity: 1 }}
          className="absolute left-1/2 top-1/2 -ml-[46px] -mt-[56px] h-28 w-[92px] rounded-[14px] bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          initial={{ rotate: 0, x: 0, y: 30, opacity: 0 }}
          key={i}
          transition={{
            delay: 0.1 + i * 0.08,
            y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut" },
            default: { type: "spring", stiffness: 160, damping: 16 },
          }}
        >
          <div className={`grid h-full w-full place-items-center rounded-[9px] bg-gradient-to-br ${c.tone}`}>
            {i === 2 ? <Heart className="text-[#0C1D0E]/70" size={22} /> : null}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** Aviso de que las fotos se ven en la galería abierta, con su enlace */
function GalleryNote({ plural }: { plural: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <p className="text-pretty text-[0.8rem] leading-5 text-[#C9C5B2]">
        {plural ? "Las fotos que compartan" : "Las fotos que compartas"} se verán en la galería de la noche, junto a
        las de todos los invitados.
      </p>
      <Link
        className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[#F7F3EA] underline underline-offset-4"
        href="/fotos/galeria"
      >
        <Images size={16} /> Ver la galería de la noche
      </Link>
    </div>
  );
}

const primaryBtn =
  "btn-ivory focus-ring flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 text-base font-semibold disabled:opacity-60";
const secondaryBtn =
  "btn-glass focus-ring flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-6 text-[0.95rem] font-semibold text-[#F7F3EA]";
const glassCard = "photo-glass rounded-3xl";

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
  const shareHref = mode === "guest" && props.code ? `/fotos?code=${encodeURIComponent(props.code)}` : "/fotos";

  const [windowState, setWindowState] = useState<PhotoWindowState>(props.windowState);
  const [name, setName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(mode !== "qr");
  const [nameError, setNameError] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  // Mientras se revisa si este celular ya recuerda el nombre (modo QR)
  const [restoring, setRestoring] = useState(mode === "qr");
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

  /** Consulta el cupo de esta persona y la deja lista para subir */
  const checkName = useCallback(
    async (clean: string) => {
      nameRef.current = clean;
      const res = await fetch("/api/photos/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploaderName: clean, simular: simular ?? undefined }),
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
    },
    [simular],
  );

  // ── Nombre recordado (modo QR): si ya lo dio antes, entra directo a subir
  useEffect(() => {
    if (mode !== "qr") return;
    let alive = true;
    void (async () => {
      await Promise.resolve();
      let saved = "";
      try {
        saved = (window.localStorage.getItem(NAME_STORAGE_KEY) ?? "").trim().replace(/\s+/g, " ");
      } catch {
        // sin almacenamiento disponible: se pedirá el nombre
      }
      if (saved.length >= 2 && saved.length <= 60) {
        try {
          await checkName(saved);
        } catch {
          // sin señal: se muestra el formulario con el nombre ya escrito
          if (alive) setName(saved);
        }
      }
      if (alive) setRestoring(false);
    })();
    return () => {
      alive = false;
    };
  }, [mode, checkName]);

  // ── Link personal: recordarlo para volver aquí desde la galería
  useEffect(() => {
    if (mode !== "guest" || !props.code) return;
    try {
      window.localStorage.setItem(GUEST_CODE_STORAGE_KEY, props.code);
    } catch {
      // sin almacenamiento: no pasa nada
    }
  }, [mode, props.code]);

  function changeName() {
    try {
      window.localStorage.removeItem(NAME_STORAGE_KEY);
    } catch {
      // sin almacenamiento: no pasa nada
    }
    nameRef.current = "";
    setName("");
    setNameError(null);
    setNameConfirmed(false);
  }

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
    if (mode === "qr") return { uploaderName: nameRef.current, simular: simular ?? undefined };
    return { simular: simular ?? undefined };
  }, [mode, props.code, simular]);

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
          updateItem(id, {
            status: "failed",
            message: e.message,
            retryable: e.message !== "Esta foto no se pudo preparar.",
          });
          if (e.limitReached) setRemaining(0);
          return;
        }
        if (attempt === RETRY_DELAYS.length) {
          updateItem(id, { status: "failed", message: "Parece que la señal está débil.", retryable: true });
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
      await checkName(clean);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Intenta de nuevo, por favor.");
    } finally {
      setCheckingName(false);
    }
  }

  // ─── Pantallas ───────────────────────────────────────────────────────────

  if (mode === "invalid") {
    return (
      <Shell isAdminTest={false} shareHref={shareHref} simular={null}>
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
      <Shell isAdminTest={isAdminTest} shareHref={shareHref} simular={simular}>
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
        <div className="mt-8 flex flex-col gap-3">
          <Link className={secondaryBtn} href="/fotos/galeria">
            <Images size={18} /> Ver la galería de la noche
          </Link>
          <Link className="focus-ring flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-[#E8E4D6]" href={backHref}>
            <ArrowLeft size={16} /> Volver a mi invitación
          </Link>
        </div>
      </Shell>
    );
  }

  if (windowState === "after") {
    return (
      <Shell isAdminTest={isAdminTest} shareHref={shareHref} simular={simular}>
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
        <Link className={`${primaryBtn} mt-4`} href="/fotos/galeria">
          <Images size={20} /> Ver la galería de la noche
        </Link>
      </Shell>
    );
  }

  if (mode === "qr" && restoring) {
    return (
      <Shell isAdminTest={isAdminTest} shareHref={shareHref} simular={simular}>
        <Brand />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#F7F3EA]/25 border-t-[#F7F3EA]" />
          <p className="text-sm text-[#C9C5B2]">Preparando tu rincón de fotos…</p>
        </div>
      </Shell>
    );
  }

  if (mode === "qr" && !nameConfirmed) {
    return (
      <Shell isAdminTest={isAdminTest} shareHref={shareHref} simular={simular}>
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
          <GalleryNote plural={false} />
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
      <Shell isAdminTest={isAdminTest} shareHref={shareHref} simular={simular}>
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
          <Link className={secondaryBtn} href="/fotos/galeria">
            <Images size={18} /> Ver la galería de la noche
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
      <Shell isAdminTest={isAdminTest} shareHref={shareHref} simular={simular}>
        {fileInputs}
        <Brand />
        <div className="mt-6 flex flex-col items-center gap-6 text-center">
          <PhotoStack />
          <div className="flex flex-col gap-3.5">
            <h1 className="font-display text-[2.1rem] leading-tight">Hola, {greetingName}</h1>
            {mode === "qr" ? (
              <button
                className="focus-ring -mt-2 self-center rounded-full px-3 py-1 text-[0.8rem] text-[#C9C5B2] underline underline-offset-4"
                onClick={changeName}
                type="button"
              >
                ¿No eres {greetingName}? Cambiar nombre
              </button>
            ) : null}
            <p className="text-pretty leading-7 text-[#E8E4D6]">
              {plural
                ? "Cada foto que tomen será un recuerdo para siempre. Súbanlas aquí y disfrútenlas en la galería de la noche."
                : "Cada foto que tomes será un recuerdo para siempre. Súbela aquí y disfrútala en la galería de la noche."}
            </p>
          </div>
          {limit !== null && remaining !== null ? (
            <p className="btn-glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[#E8E4D6]">
              <Heart className="text-[#E9DFBF]" size={16} />
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
          <div className="photo-glass flex gap-3 rounded-[1.25rem] px-4 py-4 text-left">
            <Wifi className="mt-0.5 shrink-0 text-[#E9DFBF]" size={20} />
            <span className="text-sm leading-6 text-[#E8E4D6]">
              ¿Poca señal en el salón? No pasa nada: {plural ? "pueden" : "puedes"} subirlas mañana con WiFi.{" "}
              {plural ? "Tienen" : "Tienes"} hasta el lunes 2 de noviembre a las 23:59.
            </span>
          </div>
          <GalleryNote plural={plural} />
        </div>
      </Shell>
    );
  }

  // Subiendo / con fotos de esta visita
  const canAddMore = remaining === null || remaining > 0;
  const failedMessage = items.find((it) => it.status === "failed" && it.message)?.message;
  return (
    <Shell isAdminTest={isAdminTest} shareHref={shareHref} simular={simular}>
      {fileInputs}
      <div className="flex items-center justify-between">
        <p className="gold-text font-script text-[1.9rem] leading-none">Zequelly &amp; Elio</p>
        {mode === "qr" && !busy ? (
          <button
            className="focus-ring max-w-[55%] truncate rounded-full px-2 py-1 text-[0.8rem] text-[#C9C5B2] underline underline-offset-4"
            onClick={changeName}
            title="Cambiar nombre"
            type="button"
          >
            {greetingName} · cambiar
          </button>
        ) : (
          <p className="max-w-[55%] truncate text-[0.8rem] text-[#C9C5B2]">{greetingName}</p>
        )}
      </div>

      <AnimatePresence mode="wait">
        {busy ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={`${glassCard} mt-4 flex flex-col gap-2.5 px-[18px] py-4`}
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key="progress"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[1.375rem]">Subiendo tus recuerdos</span>
              <span className="shrink-0 text-[0.8rem] tabular-nums text-[#C9C5B2]">
                {saved} de {total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F7F3EA]/12">
              <motion.div
                animate={{ width: `${total ? Math.max(4, Math.round((saved / total) * 100)) : 0}%` }}
                className="h-2 rounded-full bg-gradient-to-r from-[#A39F88] via-[#F7F3EA] to-[#E9DFBF]"
                initial={false}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="text-[0.8rem] text-[#C9C5B2]">Mantén esta página abierta hasta que terminen.</span>
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className={`${glassCard} relative mt-4 flex flex-col items-center gap-2 overflow-hidden px-5 py-6 text-center`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0, scale: 0.94 }}
            key="done"
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span
                animate={{ opacity: [0, 1, 0], y: [-4, -26 - (i % 3) * 8], x: (i - 2.5) * 22, scale: [0.6, 1, 0.8] }}
                aria-hidden="true"
                className="absolute left-1/2 top-12 text-[#E9DFBF]"
                key={i}
                transition={{ duration: 1.6, delay: 0.15 + i * 0.07, ease: "easeOut" }}
              >
                <Sparkles size={i % 2 ? 12 : 16} />
              </motion.span>
            ))}
            <motion.span
              animate={{ scale: 1, rotate: 0 }}
              className="grid h-12 w-12 place-items-center rounded-full bg-[#F7F3EA] text-[#154D35] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              initial={{ scale: 0, rotate: -30 }}
              transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.1 }}
            >
              <Check size={24} strokeWidth={3} />
            </motion.span>
            <span className="font-display text-[1.45rem] leading-tight">
              {saved === 1 ? "Tu foto quedó guardada con cariño" : `¡Gracias! ${saved} recuerdos guardados`}
            </span>
            <span className="text-sm text-[#E8E4D6]">
              {saved === 1 ? "Ya está en la galería de la noche." : "Ya están en la galería de la noche."}
            </span>
            <Link
              className="btn-ivory focus-ring mt-2 flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
              href="/fotos/galeria"
            >
              <Images size={17} /> Verlas en la galería
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {retrying ? (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
          >
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#D6AA5A]/45 bg-[#D6AA5A]/14 px-3.5 py-3">
              <WifiOff className="shrink-0 text-[#E6C98C]" size={20} />
              <span className="text-sm leading-5 text-[#F3E6C8]">
                Parece que la señal está débil. Vamos a intentarlo de nuevo…
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ul className="mt-4 grid grid-cols-3 gap-2">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.li
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-label={`${it.label}: ${statusLabel(it)}`}
              className="relative aspect-square overflow-hidden rounded-2xl bg-[#0f2414] shadow-[0_8px_22px_rgba(0,0,0,0.35)] ring-1 ring-[#F7F3EA]/[0.06]"
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              key={it.id}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 24, delay: Math.min(i, 8) * 0.03 }}
            >
              <Thumb item={it} />
              <TileStatus
                canRetry={it.retryable === true}
                item={it}
                onRetry={() => retry(it.id)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {failedMessage ? <p className="mt-2 text-center text-xs text-[#F6D3CC]">{failedMessage}</p> : null}

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
          <GalleryNote plural={plural} />
        </div>
      </div>
    </Shell>
  );
}

function Thumb({ item }: { item: Item }) {
  if (!item.preview) {
    return (
      <div className="grid aspect-square h-full w-full place-items-center bg-[#154D35] text-[#F7F3EA]/70">
        <ImagePlus size={20} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:), no pasa por next/image
    <img alt="" className="aspect-square h-full w-full object-cover" src={item.preview} />
  );
}

/** Capa de estado sobre cada miniatura: anillo de progreso, check o reintento */
function TileStatus({ item, canRetry, onRetry }: { item: Item; canRetry: boolean; onRetry: () => void }) {
  const reduceMotion = useReducedMotion();
  const active = item.status === "preparing" || item.status === "uploading";
  return (
    <>
      <AnimatePresence>
        {item.status !== "saved" ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={`absolute inset-0 grid place-items-center ${
              item.status === "failed" ? "bg-[#3a0f0a]/65" : item.status === "queued" ? "bg-black/45" : "bg-black/35"
            }`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            {active ? (
              <div className="relative grid h-11 w-11 place-items-center">
                <svg aria-hidden="true" className="absolute inset-0" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" fill="none" r="18" stroke="rgba(247,243,234,0.22)" strokeWidth="3.5" />
                </svg>
                <motion.svg
                  animate={reduceMotion ? undefined : { rotate: 360 }}
                  aria-hidden="true"
                  className="absolute inset-0"
                  transition={{ duration: item.status === "preparing" ? 1.6 : 0.9, repeat: Infinity, ease: "linear" }}
                  viewBox="0 0 44 44"
                >
                  <circle
                    cx="22"
                    cy="22"
                    fill="none"
                    r="18"
                    stroke="#F7F3EA"
                    strokeDasharray={item.status === "preparing" ? "22 92" : "52 62"}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </motion.svg>
              </div>
            ) : null}
            {item.status === "queued" ? (
              <span className="rounded-full bg-black/40 px-2.5 py-1 text-[0.7rem] font-semibold text-[#E8E4D6]">En cola</span>
            ) : null}
            {item.status === "retrying" ? (
              <span className="flex flex-col items-center gap-1 text-[#F3E6C8]">
                <WifiOff size={18} />
                <span className="text-[0.7rem] font-semibold tabular-nums">{item.retryIn ?? 0} s</span>
              </span>
            ) : null}
            {item.status === "failed" ? (
              canRetry ? (
                <button
                  aria-label="Reintentar esta foto"
                  className="btn-glass focus-ring grid h-11 w-11 place-items-center rounded-full text-[#F7F3EA]"
                  onClick={onRetry}
                  type="button"
                >
                  <RotateCcw size={18} />
                </button>
              ) : (
                <span className="px-2 text-center text-[0.7rem] font-semibold text-[#F6D3CC]">No se pudo preparar</span>
              )
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {item.status === "saved" ? (
          <motion.span
            animate={{ scale: 1, opacity: 1 }}
            aria-hidden="true"
            className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#F7F3EA] text-[#154D35] shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            initial={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <Check size={15} strokeWidth={3.2} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </>
  );
}

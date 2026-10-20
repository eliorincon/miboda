import type { Metadata } from "next";
import { PhotoUploadClient, type PhotoPageMode } from "@/components/PhotoUploadClient";
import { isAdminAuthenticated } from "@/lib/auth";
import { getRemaining, remainingForClient, resolvePhotoAccess } from "@/lib/photos";
import { getPhotoWindowState, settings, type PhotoWindowState } from "@/lib/settings";
import { photoAccessSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comparte tus fotos · Zequelly & Elio",
  robots: { index: false, follow: false },
};

type FotosPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Hora del servidor, para corregir celulares con el reloj desfasado */
function serverClock() {
  return Date.now();
}

export default async function FotosPage({ searchParams }: FotosPageProps) {
  const params = await searchParams;
  // `k` (clave de la versión anterior) ya no se usa: esos enlaces siguen funcionando
  const parsed = photoAccessSchema.safeParse({
    code: first(params.code) || undefined,
    simular: first(params.simular) || undefined,
  });
  const input = parsed.success ? parsed.data : {};
  const isAdmin = await isAdminAuthenticated();

  let mode: PhotoPageMode = "invalid";
  let displayName = "";
  let seats = 1;
  let remaining: number | null = null;
  let limit: number | null = null;

  try {
    if (input.code) {
      const access = await resolvePhotoAccess({ code: input.code, simular: input.simular }, isAdmin);
      if (access) {
        mode = "guest";
        displayName = access.displayName;
        seats = access.seats;
        limit = access.limit;
        remaining = remainingForClient(await getRemaining(access));
      }
    }
    // Acceso abierto: sin link personal válido, la página pide el nombre
    // y luego consulta el cupo de esa persona.
    if (mode === "invalid") mode = "qr";
  } catch {
    mode = "invalid";
  }

  // Con sesión de admin la ventana no aplica; `simular` deja ver cada pantalla
  let windowState: PhotoWindowState = getPhotoWindowState();
  if (isAdmin) {
    const sim = input.simular;
    windowState = sim === "before" || sim === "after" ? sim : "open";
  }

  return (
    <PhotoUploadClient
      bucket={settings.photos_bucket}
      closesAt={settings.photos_open_until}
      code={mode === "guest" ? input.code ?? null : null}
      displayName={displayName}
      initialRemaining={remaining}
      isAdminTest={isAdmin}
      limit={limit !== null && Number.isFinite(limit) ? limit : null}
      maxPerUploader={settings.photos_max_per_uploader}
      mode={mode}
      opensAt={settings.photos_open_from}
      seats={seats}
      serverNow={serverClock()}
      simular={isAdmin ? input.simular ?? null : null}
      windowState={windowState}
    />
  );
}

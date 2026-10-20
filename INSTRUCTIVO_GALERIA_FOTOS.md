# Instructivo para Claude Code — "Nuestra noche en fotos"
## Galería privada de fotos subidas por los invitados · Boda Zequelly & Elio

> **Para Claude Code:** este documento es la especificación completa de una funcionalidad nueva para este proyecto. Léelo entero antes de escribir código. Respeta las decisiones ya tomadas (sección 2): no las cambies ni las "mejores" sin preguntar. Si algo no está cubierto, elige lo más simple y coherente con el código existente y dilo al terminar.

**Versión 2 · 19-10-2026.** Cambios respecto de la v1:
- La ventana de subida se amplía hasta el **lunes 2 de noviembre a las 23:59 hrs**.
- Límite de **30 fotos por persona** (en una invitación: 30 × cupos) y nuevo **tope total de almacenamiento** (~900 MB).
- La clave del QR pasa a una **variable de entorno solo de servidor** (`PHOTOS_EVENT_KEY`).
- Cada foto se registra como **"pendiente"** al pedir la subida y se marca **"lista"** al confirmar (se acaban las fotos fantasma).
- **Todas las pruebas se hacen en producción** (Vercel), con un despliegue por fases y un plan de vuelta atrás.
- **Nueva Fase 0 de diseño UX/UI**: todas las pantallas, módulos, estados y acciones quedan diseñados antes de escribir código (sección 9.1).
- Compresión más liviana (2048 px), SQL idempotente y simulación de estados solo para admin.

---

## 0. Contexto rápido

- **Proyecto a modificar:** carpeta `miboda/` (es la enlazada a Vercel, proyecto `mibodaelioyzequelly`). **No** trabajes en `elioyquelly/`, que es una copia anterior.
- **Fecha de la boda:** sábado **31 de octubre de 2026**. La funcionalidad debe quedar terminada, probada en celulares reales y desplegada **a más tardar el 27 de octubre**. Después de esa fecha la web se congela.
- **Stack existente (no cambiar):** Next.js 16 App Router + TypeScript, Tailwind CSS v4, Framer Motion, React Hook Form + Zod 4, `lucide-react`, Supabase (`@supabase/supabase-js` 2.108), hosting en Vercel.
- **El sitio está en vivo** y los invitados lo usan para confirmar asistencia. Ningún cambio puede romper la invitación, el RSVP, los regalos ni el admin de invitados (ver sección 10).
- **Lee antes de empezar:** `contexto.md` (estilo, paleta, voz), `lib/supabase.ts`, `lib/guests.ts`, `lib/settings.ts`, `lib/types.ts`, `lib/validations.ts`, `lib/auth.ts`, `middleware.ts`, `supabase/schema.sql`, `components/HomeClient.tsx`, `components/AdminDashboard.tsx`, `app/(public)/invitado/[code]/page.tsx`, `vercel.json`.

---

## 1. Objetivo

Que los invitados puedan **subir desde su celular** las fotos que tomen durante la boda, y que **solo los novios** puedan verlas y descargarlas todas desde el panel de administración.

---

## 2. Decisiones ya tomadas (obligatorias)

| Tema | Decisión |
|---|---|
| Quién ve las fotos | **Solo los novios**, desde `/admin`. Los invitados **solo suben**: no ven las fotos de nadie, ni siquiera las suyas después de subirlas (solo una confirmación con miniaturas locales de la sesión actual). |
| Moderación | **Ninguna.** Las fotos quedan guardadas apenas se suben. |
| Ventana de subida | Desde el **sábado 31-10-2026 a las 18:00 hrs** hasta el **lunes 02-11-2026 a las 23:59 hrs**, hora de Chile. En esas fechas rige el horario de verano (UTC−3): `2026-10-31T18:00:00-03:00` → `2026-11-02T23:59:00-03:00`. |
| Límite por persona | **30 fotos por persona.** Con link personal, la invitación recibe **30 × `max_guests`** (cupos de la invitación; ej. familia de 4 → 120 fotos). Con QR, 30 por nombre. Ver sección 6.3. |
| Tope total | El servidor deja de aceptar fotos cuando el total guardado llega a **~900 MB** (margen bajo el 1 GB del plan Free). |
| Tipo de archivo | **Solo fotos.** Nada de videos. |
| Fuera de la ventana | Antes: mensaje de "pronto se abrirá". Después: mensaje de agradecimiento y subida cerrada. **El servidor debe rechazar** cualquier subida fuera de la ventana; no basta con ocultar el botón. |
| Clave del QR | Vive en la variable de entorno **`PHOTOS_EVENT_KEY`** (solo servidor, **sin** prefijo `NEXT_PUBLIC_`). **Nunca** en `lib/settings.ts`. |
| Pruebas | **Todas en producción**, en Vercel, con la sesión admin. No se prueba en local (ver sección 10). |

---

## 3. Restricciones técnicas que definen la arquitectura

1. **Vercel limita el cuerpo de una petición a ~4,5 MB** en las rutas API. Una foto de celular pesa entre 3 y 10 MB. Por eso **la foto NUNCA pasa por el servidor de Next.js**: el navegador la sube **directo a Supabase Storage** usando una **URL firmada de subida** que entrega el servidor (válida 2 horas).
2. **Supabase plan Free:** 1 GB de almacenamiento, 5 GB de transferencia al mes, máx. 50 MB por archivo. Las transformaciones de imágenes (miniaturas automáticas) **no** están en el plan Free, así que **la miniatura se genera en el celular** y se sube como segundo archivo.
3. **El cliente con service role** (`createSupabaseAdminClient`) solo se usa en el servidor. En el navegador solo se usa el cliente con anon key (`createSupabaseBrowserClient`), y únicamente para `uploadToSignedUrl`.
4. **El objeto `settings` se envía completo al navegador.** `app/(public)/page.tsx` y `app/(public)/invitado/[code]/page.tsx` le pasan `settings` como prop a `HomeClient` (componente cliente), así que todo lo que esté en `lib/settings.ts` termina en el HTML público. Por eso ahí solo van datos no secretos (fechas, límites, nombre del bucket). La clave del QR va en `PHOTOS_EVENT_KEY`.
5. **No agregues dependencias nuevas** salvo que sea imprescindible. Compresión de imágenes: con `canvas` / `createImageBitmap` nativos. ZIP: con un escritor ZIP mínimo en modo *store* (sin compresión, porque los JPG no se comprimen más) escrito en TypeScript, **o** `jszip` si prefieres no escribirlo. Si agregas una dependencia, fija la versión exacta (no `latest`).
6. **No ejecutes `npm update`** ni regeneres el `package-lock.json` desde cero. El `package.json` usa `"latest"` en todo; actualizar a días de la boda puede romper la web.
7. **No renombres `middleware.ts` a `proxy.ts`** aunque Next 16 lo marque como obsoleto: sigue funcionando y no es momento de tocarlo.

---

## 4. Flujo completo

### 4.1 Subida (invitado)

```
Celular                         Next.js (Vercel)                     Supabase
───────                         ────────────────                     ────────
1. Elige 1..N fotos (se recortan a las que le quedan disponibles)
2. Por cada foto, en cola:
   a) comprime a JPG (máx. 2048 px, calidad 0,82)
   b) genera miniatura (máx. 480 px, calidad 0,7)
   c) POST /api/photos/upload-url ──► valida acceso + ventana horaria
                                      + límite (30 × cupos / 30 QR)
                                      + tope total (~900 MB)
                                      crea 2 URLs firmadas ───────────► createSignedUploadUrl()
                                      inserta fila status='pending' ──► tabla photos
                                 ◄──  { photoId, photoPath, photoToken,
                                        thumbPath, thumbToken, remaining }
   d) uploadToSignedUrl(foto) ─────────────────────────────────────────► bucket privado
   e) uploadToSignedUrl(miniatura) ────────────────────────────────────► bucket privado
   f) POST /api/photos/complete ──►   busca la fila por photoId
        { photoId, ... }              verifica que es de esta persona
                                      verifica que la foto existe
                                      status='ready', ready_at=now() ─► tabla photos
                                 ◄──  { ok: true, remaining }
3. Muestra "✓ Guardada" en la foto
```

- Las fotos se suben **de a una o dos en paralelo como máximo** (cola), no todas a la vez. En un salón lleno la señal es mala.
- Si un paso falla: **reintentar automáticamente hasta 3 veces** con espera creciente (2 s, 5 s, 10 s). Si sigue fallando, marcar la foto con "No se pudo subir · Reintentar" (botón manual).
  - Si falla `complete` pero la subida ya terminó, el reintento **solo repite `complete`** con el mismo `photoId` (no pide URLs nuevas ni vuelve a subir).
  - Si fallan `d` o `e`, el reintento repite la subida con los mismos tokens mientras no hayan pasado 2 horas; si pasaron, pide URLs nuevas.
- Mientras haya subidas en curso, avisar con `beforeunload` si el invitado intenta cerrar la página.

### 4.2 Estados de una foto en la base de datos

| `status` | Significado | ¿Cuenta para el límite y el tope? | ¿Se ve en el admin? |
|---|---|---|---|
| `pending` (menos de 2 h) | Subida en curso | Sí | No (solo en el contador de "incompletas") |
| `pending` (más de 2 h) | Subida abandonada o `complete` que nunca llegó | No | En "Subidas incompletas" (sección 7.9) |
| `ready` | Foto guardada | Sí | Sí |

### 4.3 Visualización (solo novios)

`/admin/fotos` → `GET /api/admin/photos` → devuelve filas `ready` paginadas con **URLs firmadas temporales** (1 hora) de la miniatura y de la foto completa. Grilla de miniaturas; al tocar se abre la foto grande; botón de descargar una, eliminar una y **descargar todas en ZIP**.

---

## 5. Formas de acceso a `/fotos`

Hay **dos** formas válidas para invitados, más el modo prueba. La página debe soportar las tres.

### A) Con el link personal del invitado
- URL: `/fotos?code=<codigo-del-invitado>` (el mismo `code` de `/invitado/[code]`).
- El servidor busca al invitado con `getGuestByCode`. Si existe, la foto queda asociada a su `guest_id` y su `display_name`. **No se le pide nombre.**
- Desde la invitación personal (`HomeClient` con `guest`) se agrega un botón que lleva a esta URL (sección 7.11).

### B) Con el QR de las mesas
- URL: `/fotos?k=<clave-del-evento>`.
- La clave se lee **solo en el servidor** desde `process.env.PHOTOS_EVENT_KEY`. No es un secreto fuerte (va impresa en las mesas); solo evita que cualquiera que adivine `/fotos` suba cosas.
- Comparar con `crypto.timingSafeEqual` (o comparación directa; no es crítico) y **nunca** devolver la clave al cliente salvo el mismo valor que ya vino en la URL.
- Si `PHOTOS_EVENT_KEY` no está definida, el modo QR queda **desactivado** (pantalla de enlace no válido); el modo con link personal sigue funcionando.
- En este modo se pide **solo el nombre** ("¿Cómo te llamas?", 2–60 caracteres) una vez y se recuerda en `localStorage` (siempre envuelto en `try/catch`).
- Si la clave no coincide o no viene `code` ni `k` válidos → pantalla elegante de "Este enlace no es válido. Escanea el código de tu mesa o abre el enlace de tu invitación."

### C) Modo prueba para los novios
- Si la petición trae la cookie de admin válida (`isAdminAuthenticated()`), **se ignora la ventana horaria**. Así los novios prueban la subida en producción antes del 31. Mostrar una franja discreta: "Modo prueba (admin): la ventana horaria está desactivada para ti."
- El modo admin **no** tiene límite de 30 fotos (para poder probar con varios celulares), pero **sí** respeta el tope total.
- **Simulación de estados (solo admin):** `/fotos?...&simular=before|open|after|limite`.
  - `before` / `after` / `open`: fuerzan la pantalla correspondiente (solo la interfaz; el servidor sigue aplicando sus reglas).
  - `limite`: aplica un límite de 3 fotos al modo admin para probar el mensaje de límite alcanzado.
  - Sin cookie admin, el parámetro `simular` se ignora por completo.
- Las fotos de prueba quedan con `access_mode = 'admin'` y se borran luego desde `/admin/fotos` (botón "Borrar fotos de prueba").

---

## 6. Base de datos y almacenamiento

### 6.1 SQL

Agregar al final de `supabase/schema.sql`. **Ejecutar en Supabase → SQL Editor solo este bloque, no el archivo completo**: el `create policy` de `guests` que ya está en el archivo no es idempotente y fallaría si se vuelve a correr.

```sql
-- ─── Fotos de invitados ─────────────────────────────────────────────────────
create table if not exists photos (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid references guests(id) on delete set null,
  uploader_name    text not null,
  uploader_key     text not null,                    -- 'guest:<uuid>' | 'qr:<nombre-normalizado>' | 'admin'
  access_mode      text not null default 'guest'
                   check (access_mode in ('guest', 'qr', 'admin')),
  status           text not null default 'pending'
                   check (status in ('pending', 'ready')),
  storage_path     text not null unique,             -- foto principal
  thumb_path       text not null unique,             -- miniatura
  content_type     text not null default 'image/jpeg',
  size_bytes       int  not null default 0,
  thumb_size_bytes int  not null default 0,
  width            int,
  height           int,
  taken_at         timestamptz,                      -- si se pudo leer del archivo (opcional)
  created_at       timestamptz not null default now(),
  ready_at         timestamptz
);

create index if not exists photos_status_created_idx on photos (status, created_at desc);
create index if not exists photos_uploader_key_idx   on photos (uploader_key);
create index if not exists photos_guest_idx          on photos (guest_id);

alter table photos enable row level security;

drop policy if exists "service role full access photos" on photos;
create policy "service role full access photos"
  on photos to service_role using (true) with check (true);

-- Total de bytes ocupados (fotos listas + subidas en curso de las últimas 2 horas)
create or replace function photos_total_bytes()
returns bigint
language sql
stable
as $$
  select coalesce(sum(size_bytes + thumb_size_bytes), 0)::bigint
  from photos
  where status = 'ready'
     or created_at > now() - interval '2 hours';
$$;

revoke all on function photos_total_bytes() from public, anon, authenticated;
grant execute on function photos_total_bytes() to service_role;

-- Bucket PRIVADO para las fotos (máx. 15 MB, solo imágenes)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-photos', 'wedding-photos', false, 15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
```

- **No** crees políticas de lectura pública sobre `storage.objects` para este bucket. Las URLs firmadas de subida no necesitan políticas extra; la lectura se hace solo con URLs firmadas generadas por el servidor con service role.
- El conteo total se obtiene con `supabase.rpc("photos_total_bytes")` (las funciones de agregado de PostgREST vienen desactivadas por defecto).

### 6.2 Rutas en el bucket
- Foto: `photos/<YYYY-MM-DD>/<uuid>.<ext>` (fecha en hora de Chile; `ext` = `jpg` salvo en el plan B de HEIC/PNG/WebP original).
- Miniatura: `thumbs/<YYYY-MM-DD>/<uuid>.jpg` (mismo `uuid`).
- Nombre de archivo siempre generado por el servidor (`crypto.randomUUID()`). Nunca uses el nombre original del archivo del usuario.

### 6.3 Identidad y límite de fotos (`uploader_key`)
- Link personal → `guest:<guest_id>`. **Límite = `photos_max_per_uploader × max(1, guest.max_guests)`** (30 × cupos de la invitación). Toda la familia comparte ese total desde el mismo link; no hace falta identificar a cada integrante. Se usa `max_guests` (cupos asignados), no `confirmed_count`, para no castigar a quien no alcanzó a confirmar.
- QR → `qr:<nombre normalizado>` (minúsculas, sin tildes, espacios colapsados). Límite = 30. Quien cambie su nombre puede subir más; es aceptable porque el tope total protege el almacenamiento.
- Admin → `admin` (sin límite por persona, ver 5.C).
- Fotos que cuentan: `status = 'ready'` **o** `status = 'pending'` creadas hace menos de 2 horas.
- Con 2 subidas en paralelo puede pasarse por 1 foto en una carrera; es aceptable.

---

## 7. Archivos a crear o modificar

### 7.1 `lib/settings.ts` (modificar)
Agregar al objeto `settings` (y al tipo `Settings` en `lib/types.ts`). **Solo datos no secretos:**

```ts
photos_enabled: true,                               // interruptor general
photos_show_in_invitation: false,                   // sección en la invitación: se activa en la Fase 3 (sección 10)
photos_open_from: "2026-10-31T18:00:00-03:00",
photos_open_until: "2026-11-02T23:59:00-03:00",
photos_max_per_uploader: 30,                       // por persona; en modo guest se multiplica por max_guests
photos_max_total_bytes: 943718400,                  // 900 MB
photos_bucket: "wedding-photos",
```

Y una función helper:

```ts
export type PhotoWindowState = "disabled" | "before" | "open" | "after";
export function getPhotoWindowState(now = new Date()): PhotoWindowState
```

**Prohibido** agregar aquí la clave del QR (ver sección 3.4).

### 7.2 `lib/types.ts` (modificar)
Agregar el tipo `Photo` con los campos de la tabla (incluidos `status` y `uploader_key`) y los campos nuevos de `Settings`.

### 7.3 `lib/validations.ts` (modificar)
```ts
export const photoAccessSchema = z.object({
  code: z.string().min(2).max(120).optional(),
  k: z.string().min(4).max(64).optional(),
  uploaderName: z.string().trim().min(2).max(60).optional(),
}).refine((v) => v.code || v.k, { message: "Acceso no válido." });

export const photoUploadUrlSchema = photoAccessSchema.and(z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  size: z.number().int().positive().max(15 * 1024 * 1024),
  thumbSize: z.number().int().positive().max(1 * 1024 * 1024),
}));

export const photoCompleteSchema = photoAccessSchema.and(z.object({
  photoId: z.string().uuid(),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  takenAt: z.string().datetime({ offset: true }).optional(),
}));

export const photoStatusSchema = photoAccessSchema;
```
- En modo admin no viene `code` ni `k`: permite que el `refine` pase si hay cookie admin (valídalo en la ruta, no en el schema), o separa el schema como prefieras. Lo importante son las reglas.
- `complete` ya **no** recibe rutas del cliente: las toma de la fila por `photoId`.

### 7.4 `lib/photos.ts` (crear) — solo servidor
No importar este archivo desde componentes `"use client"`.

Funciones:
- `getPhotosEventKey()` → `process.env.PHOTOS_EVENT_KEY?.trim() || null`.
- `resolvePhotoAccess(input)` → `{ mode: "guest" | "qr" | "admin", guestId: string | null, uploaderName: string, uploaderKey: string } | null`
  - `code` válido → modo `guest`, nombre = `guest.display_name`, key `guest:<id>`.
  - `k === getPhotosEventKey()` y `uploaderName` válido → modo `qr`, key `qr:<nombre-normalizado>`.
  - Cookie admin válida → modo `admin` (nombre "Novios (prueba)" si no hay otro), key `admin`.
  - Si no → `null`.
- `assertUploadAllowed(access, { toleranceMinutes = 0 })` → lanza un error con mensaje amable si `photos_enabled` es `false` o si la ventana está cerrada (salvo admin).
- `getLimit(access)` → `30 × max(1, max_guests)` en modo guest, `30` en modo QR, `Infinity` en admin (3 con `simular=limite`). Para esto `resolvePhotoAccess` también devuelve `maxGuests` en modo guest.
- `getRemaining(access)` → `getLimit(access)` menos las fotos que ya cuentan (sección 6.3).
- `assertCapacity(incomingBytes)` → llama `rpc("photos_total_bytes")`; si `total + incomingBytes > photos_max_total_bytes`, lanza "Ya recibimos todas las fotos que podemos guardar. ¡Gracias por tanto cariño! 💛".
- `createPendingUpload(access, { contentType, size, thumbSize })` → genera `uuid` y rutas, llama dos veces a `createSignedUploadUrl(path)` e **inserta la fila `pending`**. Devuelve `{ photoId, photoPath, photoToken, thumbPath, thumbToken }`.
- `completeUpload(access, { photoId, width, height, takenAt })`:
  - Busca la fila; si no existe → error.
  - Si ya está `ready` → devolver `ok` (idempotente: los reintentos no fallan).
  - Verifica que `uploader_key` de la fila coincide con el de `access` (nadie puede completar fotos de otro).
  - Verifica que la foto principal existe en Storage (`.exists(path)` si está disponible en storage-js; si no, `.list(carpeta, { search: nombreArchivo })`). La miniatura es deseable pero no obligatoria: si falta, el admin muestra un placeholder.
  - Actualiza `status = 'ready'`, `ready_at = now()`, `width`, `height`, `taken_at` y, si es posible, `size_bytes` con el tamaño real del objeto.
- `listPhotos({ offset, limit, uploader? })` → filas `ready` + `createSignedUrls` (en lote) para miniaturas y fotos, expiración 3600 s. También devuelve `total`, la lista de nombres de quienes subieron con su conteo, `totalBytes` y la cantidad de `pending` con más de 2 horas.
- `deletePhoto(id)` → borra ambos objetos de Storage y la fila.
- `deleteTestPhotos()` → borra todas las fotos con `access_mode = 'admin'` (objetos y filas).
- `reconcilePendingPhotos()` → para cada fila `pending` con más de 2 horas: si la foto principal existe en Storage → marcarla `ready` (rescatada); si no → borrar los objetos que existan y la fila. Devuelve `{ rescued, removed }`.
- `listAllPhotoPathsForDownload()` → todas las filas `ready` con URL firmada de la foto completa, para el ZIP.

Si `createSupabaseAdminClient()` devuelve `null`, las funciones deben fallar con un mensaje claro ("La galería no está configurada"). **No** hagas modo demo en memoria para fotos.

### 7.5 Rutas API públicas (crear)
- `app/api/photos/status/route.ts` → `POST`. Valida → `resolvePhotoAccess` → devuelve `{ windowState, remaining }`. Lo usa el cliente en modo QR después de que la persona escribe su nombre.
- `app/api/photos/upload-url/route.ts` → `POST`. Valida con Zod → `resolvePhotoAccess` → `assertUploadAllowed` → `getRemaining` (> 0) → `assertCapacity(size + thumbSize)` → `createPendingUpload`. Devuelve también `remaining`.
- `app/api/photos/complete/route.ts` → `POST`. Valida → `resolvePhotoAccess` → `assertUploadAllowed` con **15 minutos de tolerancia** después del cierre (para fotos que se empezaron a subir justo antes de las 23:59 del lunes) → `completeUpload`.
- Todas: `export const dynamic = "force-dynamic"`. Nunca devuelvas rutas de otras fotos ni datos de otros invitados.
- Mensajes de error en español cálido:
  - Antes: "La subida de fotos se abrirá el sábado 31 de octubre a las 18:00 hrs 💛"
  - Después: "La subida de fotos cerró el lunes 2 de noviembre. ¡Gracias por tu cariño! 💛"
  - Límite: "Ya compartiste tus {límite} fotos 💛 Si te quedaron más que quieras regalarnos, escríbenos por WhatsApp." (usar el límite real de esa invitación, no un 30 fijo).
  - Tope total: el de `assertCapacity`.

### 7.6 Rutas API de admin (crear)
Todas comienzan con `if (!(await isAdminAuthenticated())) return 401`, igual que `app/api/admin/guests/[id]/route.ts` (el `middleware.ts` solo protege `/admin/*`, no `/api/admin/*`).
- `app/api/admin/photos/route.ts` → `GET ?offset=&limit=&uploader=` → `listPhotos`.
- `app/api/admin/photos/[id]/route.ts` → `DELETE` → `deletePhoto`.
- `app/api/admin/photos/test/route.ts` → `DELETE` → `deleteTestPhotos`.
- `app/api/admin/photos/reconcile/route.ts` → `POST` → `reconcilePendingPhotos`.
- `app/api/admin/photos/download/route.ts` → `GET` → lista de `{ url, filename }` para que el navegador arme el ZIP. Nombre de archivo: `<NNNN>_<nombre-invitado-slug>_<DD>-<HHmm>.jpg` (día y hora de Chile; el día hace falta porque la ventana dura tres días).

### 7.7 Página pública `app/(public)/fotos/page.tsx` (crear)
- Server component, `export const dynamic = "force-dynamic"`.
- Lee `searchParams` (`code`, `k`, `simular`), resuelve el acceso, calcula `getPhotoWindowState()`, si hay cookie admin y, en modo guest, `remaining`.
- Renderiza `<PhotoUploadClient />` con: `mode`, `guestName` (si hay), `code`/`k`, `windowState` (o el simulado, solo admin), `opensAt`, `closesAt`, `serverNow` (para corregir relojes de celulares desfasados), `isAdminTest`, `remaining`, `limit` (límite real de esa persona o invitación), `bucket`.
- **No** pases `settings` completo ni `PHOTOS_EVENT_KEY` como prop.
- `metadata`: título "Comparte tus fotos · Zequelly & Elio", `robots: { index: false }`.

### 7.8 `components/PhotoUploadClient.tsx` (crear) — `"use client"`
Estados de pantalla:
1. **Enlace inválido** → mensaje y botón "Volver a la invitación".
2. **`before`** → "Este rincón se abrirá el sábado 31 de octubre a las 18:00 hrs, cuando comience nuestra celebración." + cuenta regresiva simple (puede reutilizar el estilo de `Countdown`). Si llega la hora con la página abierta, pasa sola a `open`.
3. **`open`**:
   - Saludo: "Hola, {nombre}" (modo guest) o pedir nombre (modo QR; luego llamar a `/api/photos/status`).
   - Texto: "Cada foto que tomes será un recuerdo para siempre. Súbelas aquí hasta el lunes 2 de noviembre: solo nosotros podremos verlas."
   - Botón grande: **"Elegir fotos"** → `<input type="file" accept="image/*" multiple>`. **Sin** el atributo `capture`, para que el celular permita elegir de la galería o tomar una foto.
   - Opcional: segundo botón "Tomar una foto ahora" con `accept="image/*" capture="environment"`.
   - **Si elige más fotos de las que le quedan**, tomar solo las primeras `remaining` y avisar: "Puedes compartir hasta {limit} fotos. Elegimos las primeras {N} 💛".
   - Lista/grilla de las fotos de la sesión actual con miniatura local (`URL.createObjectURL`), barra de progreso y estado por foto: "En cola", "Preparando…", "Subiendo…", "✓ Guardada", "No se pudo subir · Reintentar".
   - Contador: "Han compartido N de {limit} fotos 💛" en modo guest con más de un cupo (la familia comparte el total), "Has compartido N de {limit} fotos 💛" con un cupo o en modo QR; en modo admin, solo "N fotos de prueba".
   - Al llegar a 0 disponibles: ocultar "Elegir fotos" y mostrar el mensaje de límite con el enlace a WhatsApp (`NEXT_PUBLIC_WHATSAPP_NUMBER`, ya existe).
   - Rechazar en el cliente archivos que no sean `image/*` con mensaje amable: "Por ahora solo podemos recibir fotos 📷".
4. **`after`** → "Gracias por regalarnos tu mirada. La subida de fotos cerró el lunes 2 de noviembre." + enlace a WhatsApp para quien se quedó con fotos sin subir.

**Preparación de cada imagen (en el cliente):**
```ts
// 1. Decodificar respetando la orientación
const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
// 2. Escalar a máx. 2048 px por el lado largo → canvas → toBlob("image/jpeg", 0.82)
// 3. Miniatura: máx. 480 px → toBlob("image/jpeg", 0.7)
// 4. Si createImageBitmap falla (p. ej. HEIC en un navegador que no lo decodifica):
//    - Si file.size <= 15 MB y el tipo es image/heic|heif|jpeg|png|webp → subir el ORIGINAL
//      tal cual, y como miniatura un JPG placeholder generado en canvas (fondo #154D35
//      con un ícono de cámara). En el admin se mostrará el placeholder; la foto se puede descargar.
//    - Si no → marcar error "Esta foto no se pudo preparar".
// 5. Liberar memoria: bitmap.close(), soltar el canvas (width = height = 0),
//    revocar object URLs, no mantener blobs grandes en estado.
```
- Al recodificar en canvas se pierden los datos EXIF, **incluido el GPS** (deseable por privacidad). Si es fácil, lee antes la fecha de captura (`DateTimeOriginal`) para `taken_at`; si complica, omítelo.
- Procesar en cola **de a una** para no reventar la memoria de celulares de gama baja con varias fotos de 48 MP.

**Subida a Supabase desde el navegador:**
```ts
const supabase = createSupabaseBrowserClient();          // ya existe en lib/supabase.ts
await supabase!.storage.from(bucket)
  .uploadToSignedUrl(photoPath, photoToken, photoBlob, { contentType: "image/jpeg" });
await supabase!.storage.from(bucket)
  .uploadToSignedUrl(thumbPath, thumbToken, thumbBlob, { contentType: "image/jpeg" });
```
(El nombre del bucket viene como prop desde la página.)

### 7.9 Galería privada `app/admin/fotos/page.tsx` (crear)
- Queda protegida automáticamente por `middleware.ts` (matcher `/admin/:path*`). Igual, agregar `export const dynamic = "force-dynamic"`.
- Renderiza `<AdminPhotoGallery />` (`components/AdminPhotoGallery.tsx`, `"use client"`).

**`AdminPhotoGallery` debe tener:**
- Encabezado con total de fotos, cantidad de personas que subieron, **espacio usado** ("620 MB de 900 MB") y botón "← Volver a invitados" (a `/admin`).
- Filtro por persona que subió (select con conteo, ej.: "Familia Rojas (23)").
- Grilla responsiva de miniaturas (3 columnas en celular, 5–6 en computador), con carga paginada ("Cargar más" o scroll infinito, de 60 en 60). Si la miniatura no carga, mostrar el placeholder de cámara.
- Al tocar una miniatura: visor a pantalla completa con la foto grande, nombre de quien la subió, día y hora, flechas/gestos para anterior/siguiente, botón **Descargar** y botón **Eliminar** (con confirmación propia en un modal, **no** `window.confirm`).
- Aviso **"Subidas incompletas: N"** cuando haya `pending` de más de 2 horas, con botón "Recuperar o limpiar" → `POST /api/admin/photos/reconcile` → mostrar "Recuperamos X fotos y limpiamos Y".
- Botón **"Borrar fotos de prueba"** (con modal de confirmación) → `DELETE /api/admin/photos/test`.
- Botón **"Descargar todas (ZIP)"**:
  - Antes de empezar, si hay subidas incompletas, sugerir "Recuperar o limpiar" primero.
  - Pide al servidor la lista completa (`/api/admin/photos/download`).
  - Arma ZIPs **por partes de máx. ~150 fotos** (`fotos-boda-parte-1.zip`, `-parte-2.zip`, …) para no agotar la memoria del navegador.
  - Muestra progreso ("Preparando parte 2 de 5 · 87/150 fotos").
  - Descarga cada parte con un `<a download>` creado por código.
- Estilo del admin existente (`AdminDashboard.tsx`): funcional y limpio, misma paleta.

### 7.10 `components/AdminDashboard.tsx` (modificar, mínimo)
- Agregar en el encabezado un botón/enlace **"Fotos de la noche"** que lleve a `/admin/fotos`. No reorganizar nada más del panel.

### 7.11 `components/HomeClient.tsx` (modificar, mínimo)
- **Solo cuando hay `guest` y `settings.photos_show_in_invitation` es `true`**, agregar una sección nueva **después de la Playlist y antes del `<Footer />`**, usando el componente `Section` existente:
  - `eyebrow`: "Nuestra noche en fotos"
  - `title`: "Comparte tus recuerdos con nosotros"
  - Texto: "Desde el sábado 31 de octubre a las 18:00 hrs y hasta el lunes 2 de noviembre, podrás subir aquí las fotos que tomes durante la celebración. Solo nosotros podremos verlas 💛"
  - Botón: "Subir mis fotos" → `/fotos?code=${guest.code}`.
- Opcional: en `InfoPopup.tsx`, agregar a la lista un ítem tipo "Si tomas fotos, compártelas con nosotros desde tu invitación o el código QR de tu mesa." (también condicionado a `photos_show_in_invitation`).

### 7.12 Variables de entorno
- **Nueva:** `PHOTOS_EVENT_KEY` → agregarla en Vercel, entorno **Production**, tipo *Sensitive*. Valor: clave corta legible de 8 caracteres sin `0/O/1/l/I` (ej. generada con `crypto.randomBytes`). Agregarla también a `.env.example` (vacía) con un comentario.
- Las de Supabase ya existen en Vercel (Production y Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. `ADMIN_PASSWORD` existe solo en Production, por eso el modo prueba solo funciona en producción.
- Un cambio de variable en Vercel **solo aplica en el siguiente deploy**.

### 7.13 `vercel.json` (modificar, en un deploy aparte)
- Cambiar `"installCommand": "npm install"` por `"installCommand": "npm ci"`, para que Vercel instale exactamente las versiones del `package-lock.json` y no las `latest` del día.
- Hacerlo como **deploy independiente** (Fase 1, sección 10). Si el build falla, se revierte el cambio; un build fallido no reemplaza la versión que está en vivo.

---

## 8. Seguridad (checklist obligatorio)

- [ ] El servidor valida la ventana horaria en `upload-url` **y** en `complete` (no confiar en el reloj del celular).
- [ ] La subida exige `code` válido, o `k` correcta + nombre, o cookie admin.
- [ ] `PHOTOS_EVENT_KEY` solo se lee en el servidor; no aparece en `settings`, ni en props, ni en el HTML (verificar con "ver código fuente" de una invitación).
- [ ] Límite (30 × cupos en modo guest, 30 en QR) y tope total aplicados en el servidor; `max_guests` se lee de la base, nunca del cliente.
- [ ] `complete` solo acepta un `photoId` cuya fila pertenece a la misma persona (`uploader_key`).
- [ ] Tipos permitidos solo de imagen; tamaño máx. 15 MB (también reforzado por el bucket).
- [ ] Rutas de archivo generadas por el servidor con UUID; el cliente nunca elige rutas.
- [ ] Bucket **privado**; ninguna URL pública; URLs firmadas de lectura solo desde rutas `/api/admin/*` con `isAdminAuthenticated()`.
- [ ] Ninguna ruta pública devuelve listados de fotos ni datos de otros invitados.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca llega al navegador (solo en archivos de servidor).
- [ ] El parámetro `simular` solo tiene efecto con cookie admin.
- [ ] `/fotos` con `robots: noindex`.

---

## 9. Diseño y voz

- Reutiliza las clases y componentes existentes (`ivory-panel`, `Section`, botones redondeados `rounded-full bg-[#154D35] text-[#F7F3EA]`, tipografías `font-display` y `font-script`).
- Paleta: `#0C1D0E` verde noche, `#154D35` esmeralda, `#837E5E` dorado antiguo, `#A39F88` champagne, `#F7F3EA` marfil, `#E2E5E2` blanco floral.
- Mobile first: botones grandes (mín. 48 px de alto), texto legible a oscuras (la fiesta es de noche), sin animaciones pesadas.
- **Voz:** romántica, cercana. Usar: "Comparte tus recuerdos", "Gracias por regalarnos tu mirada", "Tu foto quedó guardada con cariño". **Evitar:** "usuario", "upload", "archivo", "error 400", "proceso completado", "registro", "límite excedido".
- Los mensajes de error siempre humanos: "Parece que la señal está débil. Vamos a intentarlo de nuevo…".

### 9.1 Diseño de referencia (Fase 0)

El diseño completo está en el lienzo **"Galería de fotos · Diseño UX/UI"**: https://claude.ai/artifact/GFqxvpU6NLCLnNo46EsgA2 (privado de la cuenta del usuario). Es la referencia visual y de comportamiento para implementar; si algo de este documento y el lienzo no coinciden, preguntar.

| Página del lienzo | Pantallas |
|---|---|
| Estructura y flujos | Mapa de la plataforma (entradas, módulos I1–I6 y N1–N6, mapa de pantallas, principios) · Flujos (camino de cada foto, estados de `/fotos`, quién puede hacer qué, frases clave) |
| Invitado (celular, 390 px) | G1 Sección en la invitación · G2 Antes de abrir · G3 QR: ¿cómo te llamas? · G4 Abierta · G5 Subiendo · G6 Límite alcanzado · G7 Subida cerrada · G8 Enlace no válido |
| Novios (admin) | A1 Galería en computador · A2 Visor · A3 Diálogos (eliminar, borrar fotos de prueba, ZIP por partes, subidas incompletas) · A4 Galería en el celular |
| Componentes y QR | Tipografía, botones, estados de foto, avisos, paleta con contrastes, miniaturas, tarjetas de resumen · Tarjeta QR para las mesas |

Decisiones de experiencia que el diseño agrega a lo de arriba:
- **Lado invitado oscuro, lado novios claro.** El invitado usa el fondo verde noche de la invitación (se lee en la fiesta); el admin usa el marfil del panel actual.
- **Un solo botón principal por pantalla**, marfil sobre verde, de 56–64 px de alto. Los secundarios van con contorno.
- **"Solo Zequelly y Elio podrán ver tus fotos"** con ícono de candado, visible en las pantallas de subida.
- **Aviso de WiFi** en G2 y G4: "¿Poca señal en el salón? Pueden subirlas mañana con WiFi. Tienen hasta el lunes 2 de noviembre a las 23:59".
- **G5 lista por filas** (no grilla): miniatura local, nombre "Foto N", estado en una etiqueta y barra de progreso; resumen arriba ("Subiendo 3 de 8 · 2 guardadas") y aviso de señal débil cuando hay reintentos.
- **Texto en plural** cuando la invitación tiene más de un cupo ("Hola, Familia Rojas", "Pueden compartir hasta 120 fotos"); en singular con un cupo o en modo QR.
- **G6 muestra las miniaturas de la visita actual** (solo locales, del mismo celular) para cerrar con una sensación de logro.
- **A1:** tarjetas de resumen (fotos, personas con desglose invitación/QR, espacio con barra, subidas incompletas en color de atención), filtro por persona, "Más recientes primero", botón "Borrar fotos de prueba (N)" en tono delicado y "Cargar 60 fotos más".
- **A2:** el visor muestra "23 de 486", acepta flechas del teclado, deslizar y Esc.
- **A3:** el ZIP muestra cada parte con su estado y un botón "Detener"; los borrados usan rojo solo en el botón que confirma.
- **Contraste:** los textos chicos sobre marfil van en `#6B6648` (el dorado `#837E5E` no alcanza 4,5:1 en letra chica); sobre verde noche, en champagne `#A39F88` o más claro.
- **Íconos de línea** (los de `lucide-react` equivalentes); los emojis de los mensajes se mantienen solo en textos, nunca como íconos.

---

## 10. Despliegue y pruebas en producción

**Todas las pruebas se hacen en vivo en producción** (`vercel --prod` desde `miboda/`), con la sesión admin abierta. No se monta entorno local. Como el sitio ya lo usan los invitados, se trabaja en fases: primero el diseño, y luego un despliegue por etapas para que nada visible cambie hasta que la galería esté probada.

> Antes de cada deploy se puede correr `npm run build` y `npm run lint` en local solo como chequeo de compilación (no es una prueba funcional). Un build que falla en Vercel **no** reemplaza la versión en vivo.

### Plan de vuelta atrás (tenerlo listo antes de empezar)
- Anotar la URL del deploy de producción actual (Vercel → Deployments).
- Si algo se rompe después de un deploy: Vercel → Deployments → último deploy bueno → **"Promote to Production"** (o *Instant Rollback*). Toma segundos y no requiere tocar código.
- Las tablas y el bucket nuevos no afectan a la invitación; no hace falta revertir el SQL.

### Fase 0 — Diseño UX/UI (sin código)
- Diseñar la plataforma completa en un lienzo: estructura, módulos, flujos, estados, acciones, pantallas del invitado y de los novios, componentes y tarjeta QR (sección 9.1).
- **Sale de esta fase cuando los novios aprueban el diseño.** Desde ahí, la implementación debe seguir esas pantallas; cualquier cambio de diseño se hace primero en el lienzo.

### Fase 1 — Preparación (sin cambios visibles)
1. Ejecutar en Supabase (proyecto de producción) **solo** el bloque SQL de la sección 6.1. Confirmar que existen la tabla `photos`, la función `photos_total_bytes` y el bucket `wedding-photos` (privado).
2. Crear `PHOTOS_EVENT_KEY` en Vercel (Production).
3. Deploy solo con el cambio de `vercel.json` (`npm ci`). Verificar que el build pasa y hacer la prueba de humo (paso 9). Si falla, revertir `vercel.json` y seguir con `npm install`.

### Fase 2 — Galería desplegada pero oculta para los invitados
4. Deploy con todo el código y `photos_show_in_invitation: false`. Las invitaciones se ven exactamente igual que antes.
5. **Con sesión admin** (iniciar sesión en `/admin/login` en cada celular), abrir `/fotos?k=<clave>` y probar en:
   - iPhone con Safari (fotos HEIC de la galería y foto tomada en el momento).
   - Android con Chrome.
   - Un celular de gama baja si es posible.
   - Con datos móviles (no WiFi), seleccionando 20–30 fotos de una vez.
   - Cortar la señal a mitad de una subida (modo avión unos segundos) y confirmar que reintenta.
6. Probar estados y límites con `simular`: `before`, `open`, `after` y `limite` (debe frenar en 3 fotos y mostrar el mensaje). Abrir además `/fotos?code=<code>` de una invitación con varios cupos (con sesión admin) y confirmar que el límite mostrado es 30 × cupos.
7. **Sin sesión admin** (ventana privada): abrir `/fotos?k=<clave>` → debe mostrar "se abrirá el sábado 31…" y el servidor debe rechazar subidas. Abrir `/fotos?k=clave-mala` y `/fotos` solo → "Este enlace no es válido".
8. En `/admin/fotos`: miniaturas, visor, descarga individual, borrado, "Recuperar o limpiar", contador de espacio y ZIP por partes. Ver el código fuente de una invitación y confirmar que la clave del QR **no** aparece.
9. **Prueba de humo de lo existente** (después de cada deploy): portada e invitación general, una invitación personal `/invitado/<code>`, confirmar asistencia (RSVP) con un invitado de prueba, modal de regalos, `/admin` con la lista de invitados y la exportación.

### Fase 3 — Mostrar la sección en las invitaciones
10. Cambiar `photos_show_in_invitation: true` y desplegar.
11. Abrir la invitación personal de un invitado real (o de prueba) y comprobar que la sección aparece después de la Playlist y que el botón lleva a `/fotos?code=...` con su nombre.
12. Repetir la prueba de humo (paso 9).
13. "Borrar fotos de prueba" desde `/admin/fotos` y confirmar que el contador queda en 0.
14. **Todo esto antes del 27 de octubre.** Después, congelar la web.

---

## 11. Entregables extra

- **QR para las mesas:** generar un PNG (y un PDF tamaño carta con 4–6 tarjetas por hoja) con el QR a `https://<dominio-de-producción>/fotos?k=<PHOTOS_EVENT_KEY>`, el texto "Comparte tus fotos de esta noche 📷", "Zequelly & Elio · 31.10.2026", una línea pequeña "Puedes subirlas hasta el lunes 2 de noviembre" y la paleta de la boda. El dominio está en `NEXT_PUBLIC_SITE_URL` (Production); si no, preguntar al usuario. Generarlo con un script aparte (`scripts/generate-qr.mjs`) que reciba la clave como argumento o variable de entorno al ejecutarlo (**no** escribirla en el script), y sin agregar la librería (ej. `qrcode`) a las dependencias de la web. Los archivos generados no deben quedar dentro de `public/`.
- **Mensajes sugeridos de WhatsApp:**
  - Sábado 31 a las 18:00: recordatorio de que pueden subir fotos desde su invitación o el QR de su mesa.
  - Domingo 1 en la tarde: "Tienes hasta el lunes 2 a las 23:59 para compartirnos tus fotos 💛".

---

## 12. Capacidad y costos (para informar al usuario al terminar)

- Cada foto comprimida (2048 px, 0,82) pesa ~0,4–0,8 MB + miniatura ~40 KB. Con el tope de 900 MB caben aprox. **1.200–2.000 fotos**. Las fotos HEIC subidas como original (plan B) pesan más (2–5 MB).
- Con 30 fotos por persona (30 × cupos por invitación), el tope de 900 MB se alcanza con ~1.200–2.000 fotos en total, es decir, si más de ~40–60 personas suben sus 30 fotos. Si eso pasa, el servidor deja de aceptar fotos con un mensaje amable; si se quiere más margen, la única opción es Supabase Pro por un mes.
- Como los invitados no ven la galería, la transferencia la gastan solo los novios al ver y descargar. Descargar todo una o dos veces cabe en los 5 GB mensuales.
- Todo funciona en los planes gratuitos actuales (Vercel Hobby + Supabase Free). Solo si se quisiera más espacio o calidad completa convendría Supabase Pro (~25 USD/mes) por un mes.
- **Importante:** Supabase pausa los proyectos Free tras ~1 semana sin actividad (no borra los datos y se pueden reactivar desde el panel). Igual, los novios deben **descargar el ZIP durante la semana siguiente al lunes 2 de noviembre**.

---

## 13. Checklist de despliegue (Vercel)

- [ ] URL del deploy de producción actual anotada (para volver atrás).
- [ ] SQL de la sección 6.1 ejecutado en el Supabase **de producción** (solo ese bloque).
- [ ] `PHOTOS_EVENT_KEY` creada en Vercel (Production) y la misma clave usada en el QR.
- [ ] Variables de Supabase y `ADMIN_PASSWORD` presentes en Vercel (Production) — ya lo están.
- [ ] Fechas reales en `lib/settings.ts` (`2026-10-31T18:00:00-03:00` → `2026-11-02T23:59:00-03:00`).
- [ ] `photos_max_per_uploader: 30` (× `max_guests` en modo guest) y `photos_max_total_bytes: 943718400`.
- [ ] Fase 0 (diseño) aprobada por los novios.
- [ ] Fases 1, 2 y 3 completas, con prueba de humo después de cada deploy.
- [ ] Fotos de prueba borradas.
- [ ] **Congelar la web después del 27 de octubre**: no más cambios ni deploys salvo emergencia.

---

## 14. Criterios de aceptación

- [ ] Un invitado con su link personal puede subir varias fotos a la vez desde iPhone y Android entre el sábado 31-10 18:00 y el lunes 02-11 23:59 (hora Chile).
- [ ] Un invitado del QR puede subir indicando solo su nombre.
- [ ] Una invitación no puede subir más de 30 × sus cupos, y un nombre del QR no más de 30 (salvo admin).
- [ ] El servidor deja de aceptar fotos al llegar al tope total, con un mensaje amable.
- [ ] Fuera de la ventana, el servidor rechaza la subida con un mensaje amable (salvo sesión admin).
- [ ] Ningún invitado puede ver fotos de otros.
- [ ] La clave del QR no aparece en el HTML ni en el JavaScript públicos.
- [ ] No quedan fotos fantasma: toda foto subida aparece en el admin o se puede recuperar/limpiar desde ahí.
- [ ] Los novios ven todas las fotos en `/admin/fotos`, con nombre de quien subió, día y hora, y pueden eliminar y descargar (una o todas en ZIP).
- [ ] No se aceptan videos.
- [ ] Las fotos no pasan por el servidor de Vercel (subida directa a Supabase con URL firmada).
- [ ] La web existente (invitación, RSVP, regalos, admin de invitados) sigue funcionando igual.
- [ ] Build y lint sin errores.

---

## 15. Al terminar, informa al usuario

1. Lista de archivos creados y modificados.
2. El SQL que debe ejecutar en Supabase (o confirmación de que ya se ejecutó).
3. Que debe crear `PHOTOS_EVENT_KEY` en Vercel, el valor sugerido y dónde quedó el QR.
4. Cómo probar en producción en modo admin (incluido el parámetro `simular`).
5. En qué fase quedó el despliegue y qué falta para la siguiente.
6. Cualquier decisión que hayas tomado por tu cuenta.

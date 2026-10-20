// Preparación de fotos en el celular (solo navegador): achica la foto, crea la
// miniatura y, de paso, elimina los datos EXIF (incluido el GPS).

export type PreparedPhoto = {
  photo: Blob;
  thumb: Blob;
  contentType: string;
  width?: number;
  height?: number;
};

const MAX_SIDE = 2048;
const PHOTO_QUALITY = 0.82;
const THUMB_SIDE = 480;
const THUMB_QUALITY = 0.7;
const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
const ORIGINAL_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Tipo real del archivo; algunos Android lo dejan vacío */
export function detectImageType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png" || ext === "webp" || ext === "heic" || ext === "heif") return `image/${ext}`;
  return "";
}

export function isImageFile(file: File) {
  return detectImageType(file).startsWith("image/");
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
      "image/jpeg",
      quality,
    );
  });
}

async function drawScaled(source: CanvasImageSource, w: number, h: number, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await canvasToJpeg(canvas, quality);
  // Soltar la memoria del canvas cuanto antes (celulares de gama baja)
  canvas.width = 0;
  canvas.height = 0;
  return { blob, width, height };
}

/** Miniatura de reemplazo cuando el navegador no sabe leer la foto (p. ej. HEIC) */
async function placeholderThumb(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIDE;
  canvas.height = THUMB_SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#154D35";
  ctx.fillRect(0, 0, THUMB_SIDE, THUMB_SIDE);
  ctx.strokeStyle = "rgba(247,243,234,0.75)";
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  const c = THUMB_SIDE / 2;
  ctx.strokeRect(c - 90, c - 55, 180, 125);
  ctx.beginPath();
  ctx.arc(c, c + 8, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(c - 40, c - 80, 80, 25);
  return canvasToJpeg(canvas, THUMB_QUALITY);
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = null;
  }

  if (bitmap) {
    try {
      const photo = await drawScaled(bitmap, bitmap.width, bitmap.height, MAX_SIDE, PHOTO_QUALITY);
      const thumb = await drawScaled(bitmap, bitmap.width, bitmap.height, THUMB_SIDE, THUMB_QUALITY);
      return {
        photo: photo.blob,
        thumb: thumb.blob,
        contentType: "image/jpeg",
        width: photo.width,
        height: photo.height,
      };
    } finally {
      bitmap.close();
    }
  }

  // Plan B: el navegador no pudo leerla; se sube el original tal cual
  const type = detectImageType(file);
  if (ORIGINAL_TYPES.includes(type) && file.size <= MAX_ORIGINAL_BYTES) {
    return { photo: file, thumb: await placeholderThumb(), contentType: type };
  }
  throw new Error("Esta foto no se pudo preparar");
}

// Escritor ZIP mínimo en modo "store" (sin compresión: los JPG no se comprimen
// más). Solo navegador. Suficiente para partes de ~150 fotos (< 4 GB).

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

type Entry = { name: Uint8Array; crc: number; size: number; offset: number; time: number; day: number };

export class ZipWriter {
  private parts: BlobPart[] = [];
  private entries: Entry[] = [];
  private offset = 0;
  private encoder = new TextEncoder();

  add(filename: string, data: Uint8Array, date = new Date()) {
    const name = this.encoder.encode(filename);
    const crc = crc32(data);
    const { time, day } = dosDateTime(date);

    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true); // versión necesaria
    header.setUint16(6, 0x0800, true); // nombres en UTF-8
    header.setUint16(8, 0, true); // store
    header.setUint16(10, time, true);
    header.setUint16(12, day, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);

    this.parts.push(header.buffer, name as BlobPart, data as BlobPart);
    this.entries.push({ name, crc, size: data.length, offset: this.offset, time, day });
    this.offset += 30 + name.length + data.length;
  }

  finish(): Blob {
    const start = this.offset;
    let size = 0;
    for (const e of this.entries) {
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, e.time, true);
      cd.setUint16(14, e.day, true);
      cd.setUint32(16, e.crc, true);
      cd.setUint32(20, e.size, true);
      cd.setUint32(24, e.size, true);
      cd.setUint16(28, e.name.length, true);
      cd.setUint32(42, e.offset, true);
      this.parts.push(cd.buffer, e.name as BlobPart);
      size += 46 + e.name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, start, true);
    this.parts.push(end.buffer);
    return new Blob(this.parts, { type: "application/zip" });
  }
}

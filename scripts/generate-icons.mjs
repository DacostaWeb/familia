// Gera icon-192.png e icon-512.png (quadrado amarelo com contorno preto) sem dependências.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size) {
  const { width: w, height: h } = { width: size, height: size };
  const raw = Buffer.alloc(h * (1 + w * 4));
  const margin = Math.round(size * 0.12);
  const inner = Math.round(size * 0.76);
  const x0 = margin, x1 = margin + inner;
  const y0 = margin, y1 = margin + inner;
  const band = Math.round(size * 0.05);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4);
    raw[rowStart] = 0; // filtro none
    for (let x = 0; x < w; x++) {
      const o = rowStart + 1 + x * 4;
      const inOuter = x >= x0 - band && x < x1 + band && y >= y0 - band && y < y1 + band;
      const inInner = x >= x0 && x < x1 && y >= y0 && y < y1;
      const inTopBand = x >= x0 + Math.round(inner * 0.2) && x < x0 + Math.round(inner * 0.5) && y >= y0 - band * 3 && y < y0;
      if (inInner) {
        raw[o] = 0xff; raw[o + 1] = 0xeb; raw[o + 2] = 0x3b; raw[o + 3] = 0xff;
      } else if (inOuter || inTopBand) {
        raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 0; raw[o + 3] = 0xff;
      } else {
        raw[o] = 0xff; raw[o + 1] = 0xff; raw[o + 2] = 0xff; raw[o + 3] = 0xff;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/icon-192.png", png(192));
writeFileSync("public/icon-512.png", png(512));
console.log("icons written");

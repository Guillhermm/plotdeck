'use strict';

/** Generates the icons: a plotted curve on a dark card. No image dependency. */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BG = [13, 17, 23, 255];
const AXIS = [44, 58, 74, 255];
const CURVE = [79, 157, 253, 255];
const SIZES = [16, 48, 128];
const OUT_DIR = path.join(__dirname, '..', 'src', 'images');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  const table = CRC_TABLE;
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function draw(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) pixels.set(BG, i * 4);

  const put = (x, y, color) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= size || py >= size) return;
    pixels.set(color, (py * size + px) * 4);
  };

  const mid = Math.round(size / 2);
  for (let x = 0; x < size; x += 1) put(x, mid, AXIS);

  // A logistic curve, which is what the extension draws best.
  const weight = Math.max(1, Math.round(size / 14));
  for (let step = 0; step < size * 4; step += 1) {
    const x = (step / (size * 4)) * size;
    const t = (x / size) * 12 - 6;
    const y = size - (1 / (1 + Math.exp(-t))) * (size * 0.78) - size * 0.11;
    for (let w = 0; w < weight; w += 1) {
      put(x, y + w, CURVE);
      put(x + w, y, CURVE);
    }
  }
  return pixels;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, png(size, draw(size)));
  process.stdout.write(`wrote ${path.relative(process.cwd(), file)}\n`);
}

#!/usr/bin/env node
/**
 * Generates extension icons (16, 32, 48, 128px PNG) using only Node.js built-ins.
 * Run once: node generate_icons.js
 */

'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk ──────────────────────────────────────────────────────────
function makeChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(d.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([lenBuf, t, d, crcBuf]);
}

// ── Build RGBA PNG ─────────────────────────────────────────────────────
function buildPNG(size, rgba) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type

  // Scanlines: 1 filter byte (0 = None) + row of RGBA bytes
  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw[dst]     = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon renderer ──────────────────────────────────────────────────────
function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4); // all transparent

  const set = (x, y, r, g, b, a) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
  };

  const corner = size * 0.22; // corner radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded rectangle: check corner exclusion zones
      const dx = Math.max(0, corner - x, x - (size - 1 - corner));
      const dy = Math.max(0, corner - y, y - (size - 1 - corner));
      if (dx * dx + dy * dy > corner * corner) continue;

      // Background: indigo → purple gradient (top → bottom)
      const t  = y / Math.max(size - 1, 1);
      const bg = [
        Math.round(79  + t * (124 - 79)),   // R
        Math.round(70  + t * (58  - 70)),   // G
        Math.round(229 + t * (237 - 229)),  // B
      ];

      // Normalized icon coords (0..1)
      const nx = x / size;
      const ny = y / size;

      // Speaker body (left rectangle)
      const inBody = nx >= 0.20 && nx <= 0.42 && ny >= 0.36 && ny <= 0.64;

      // Speaker cone (right triangle)
      const coneX   = nx - 0.38;
      const halfH   = coneX * 0.65;
      const inCone  = coneX >= 0 && nx <= 0.70 && Math.abs(ny - 0.50) <= halfH + 0.02;

      // Sound wave arcs centered at (0.62, 0.50)
      const wd  = Math.sqrt((nx - 0.62) ** 2 + (ny - 0.50) ** 2);
      const inW1 = nx >= 0.62 && wd >= 0.11 && wd <= 0.17;
      const inW2 = nx >= 0.62 && wd >= 0.22 && wd <= 0.28;

      if (inBody || inCone || inW1 || inW2) {
        set(x, y, 255, 255, 255, 220);
      } else {
        set(x, y, bg[0], bg[1], bg[2], 255);
      }
    }
  }

  return Buffer.from(pixels.buffer);
}

// ── Main ───────────────────────────────────────────────────────────────
const iconsDir = path.join(__dirname, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const rgba = renderIcon(size);
  const png  = buildPNG(size, rgba);
  const out  = path.join(iconsDir, `${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`  icons/${size}.png  (${png.length} bytes)`);
}

console.log('\nDone. Load the extension at chrome://extensions');

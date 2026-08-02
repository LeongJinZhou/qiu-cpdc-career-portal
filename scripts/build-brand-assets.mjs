/**
 * Derive the QIU brand asset set from the two official masters.
 *
 * The university supplied exactly two files, and they are *different lockups*,
 * not colour variants of one another:
 *
 *   public/QIU Logo - Black.png   4320x1982  black ink   — stacked lockup
 *   public/QIU Logo.png           4320x917   white ink   — horizontal lockup
 *
 * So a light-background header (which is what this platform is) had no
 * horizontal black mark to use, and a dark surface had no stacked white one.
 * Both files are pure monochrome over transparency, which means the alpha
 * channel alone carries the artwork — recolouring is exact, not an
 * approximation, and it is the only way to get the missing two variants
 * without asking QIU for a re-export.
 *
 * This also trims and downscales. The masters carry ~10% dead margin (the
 * horizontal one is 33% empty vertically), and a 4320px-wide PNG behind a 36px
 * header is ~220KB of waste on every page load.
 *
 * Run: node scripts/build-brand-assets.mjs
 *
 * Regenerating is idempotent. Re-run it if QIU ever supplies new masters;
 * do not hand-edit anything in public/brand/.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.join(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'brand');

const MASTERS = {
  stacked: path.join(ROOT, 'public', 'QIU Logo - Black.png'),
  horizontal: path.join(ROOT, 'public', 'QIU Logo.png'),
};

/** QIU ink on light surfaces. Matches --color-ink so the mark sits with the type. */
const INK_DARK = [0x1d, 0x1d, 0x1f];
const INK_LIGHT = [0xff, 0xff, 0xff];

// ---------------------------------------------------------------- PNG codec

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
  let r = 0xffffffff;
  for (let i = 0; i < buf.length; i++) r = table[(r ^ buf[i]) & 0xff] ^ (r >>> 8);
  return (r ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Decode an 8-bit RGBA, non-interlaced PNG into a flat pixel buffer. */
function decodePng(file) {
  const data = fs.readFileSync(file);
  let idx = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  let depth = 8;
  let interlace = 0;
  const idat = [];

  while (idx < data.length) {
    const len = data.readUInt32BE(idx);
    const type = data.toString('ascii', idx + 4, idx + 8);
    const body = data.subarray(idx + 8, idx + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    idx += 12 + len;
  }

  if (depth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `${path.basename(file)}: expected 8-bit non-interlaced RGBA, got depth=${depth} colorType=${colorType} interlace=${interlace}`,
    );
  }

  const bpp = 4;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let p = 0;

  // Undo the per-scanline filters (PNG spec §9).
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pred = a + b - c;
        const pa = Math.abs(pred - a);
        const pb = Math.abs(pred - b);
        const pc = Math.abs(pred - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }

  return { width, height, data: out };
}

function encodePng({ width, height, data }) {
  const stride = width * 4;
  const rows = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rows[y * (stride + 1)] = 0; // filter: none
    data.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- transforms

/** Tight bounding box of everything that is not fully transparent. */
function inkBounds(img, threshold = 8) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('image is fully transparent');
  return { minX, minY, maxX, maxY };
}

function crop(img, { minX, minY, maxX, maxY }) {
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    img.data.copy(
      data,
      y * width * 4,
      ((minY + y) * img.width + minX) * 4,
      ((minY + y) * img.width + minX + width) * 4,
    );
  }
  return { width, height, data };
}

/**
 * Box-filter downscale.
 *
 * Averaging in *premultiplied* space matters here: naive per-channel averaging
 * would blend the RGB of fully transparent pixels into the edges and fringe the
 * letterforms. We only ever emit flat-colour ink anyway, so this stays exact.
 */
function resize(img, targetWidth) {
  if (targetWidth >= img.width) return img;
  const scale = img.width / targetWidth;
  const width = targetWidth;
  const height = Math.max(1, Math.round(img.height / scale));
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * img.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * img.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * img.width + sx) * 4;
          const alpha = img.data[i + 3] / 255;
          r += img.data[i] * alpha;
          g += img.data[i + 1] * alpha;
          b += img.data[i + 2] * alpha;
          a += img.data[i + 3];
          n++;
        }
      }
      const avgA = a / n;
      const un = avgA > 0 ? 255 / avgA : 0;
      const o = (y * width + x) * 4;
      data[o] = Math.min(255, Math.round((r / n) * un));
      data[o + 1] = Math.min(255, Math.round((g / n) * un));
      data[o + 2] = Math.min(255, Math.round((b / n) * un));
      data[o + 3] = Math.round(avgA);
    }
  }
  return { width, height, data };
}

/** Repaint the ink a flat colour, keeping the alpha mask untouched. */
function recolour(img, [r, g, b]) {
  const data = Buffer.from(img.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return { width: img.width, height: img.height, data };
}

/** Centre the artwork on a transparent square canvas of `size` px. */
function squareCanvas(img, size, margin = 0.14) {
  const inner = Math.round(size * (1 - margin * 2));
  const scaled = img.width >= img.height
    ? resize(img, inner)
    : resize(img, Math.max(1, Math.round((img.width / img.height) * inner)));
  const data = Buffer.alloc(size * size * 4);
  const ox = Math.round((size - scaled.width) / 2);
  const oy = Math.round((size - scaled.height) / 2);
  for (let y = 0; y < scaled.height; y++) {
    scaled.data.copy(
      data,
      ((y + oy) * size + ox) * 4,
      y * scaled.width * 4,
      (y + 1) * scaled.width * 4,
    );
  }
  return { width: size, height: size, data };
}

/** Transparent padding, as a fraction of the shorter side. */
function pad(img, fraction) {
  const p = Math.round(Math.min(img.width, img.height) * fraction);
  if (p <= 0) return img;
  const width = img.width + p * 2;
  const height = img.height + p * 2;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < img.height; y++) {
    img.data.copy(data, ((y + p) * width + p) * 4, y * img.width * 4, (y + 1) * img.width * 4);
  }
  return { width, height, data };
}

/**
 * Split the horizontal lockup at its widest internal gutter.
 *
 * The lockup is "QIU" + a gap + the "QUEST INTERNATIONAL UNIVERSITY" block.
 * Finding the gap by scanning for the longest run of empty columns beats
 * hardcoding a pixel offset — it survives a re-export at a different size.
 */
function splitAtWidestGutter(img) {
  const empty = [];
  for (let x = 0; x < img.width; x++) {
    let ink = false;
    for (let y = 0; y < img.height && !ink; y++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 8) ink = true;
    }
    empty.push(!ink);
  }

  let best = { start: 0, len: 0 };
  let run = 0;
  for (let x = 0; x < empty.length; x++) {
    if (empty[x]) {
      run++;
      if (run > best.len) best = { start: x - run + 1, len: run };
    } else {
      run = 0;
    }
  }
  if (best.len === 0) throw new Error('no gutter found in horizontal lockup');
  return best.start + Math.floor(best.len / 2);
}

// ------------------------------------------------------------------ build

function write(name, img) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, encodePng(img));
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`  ${name.padEnd(34)} ${String(img.width).padStart(5)}x${String(img.height).padEnd(5)} ${kb.padStart(7)} KB`);
}

function main() {
  for (const [key, file] of Object.entries(MASTERS)) {
    if (!fs.existsSync(file)) {
      throw new Error(`missing ${key} master: ${file}`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Building QIU brand assets from the official masters…\n');

  // --- horizontal lockup: the primary mark for headers and nav bars.
  const horizontal = pad(resize(crop(decodePng(MASTERS.horizontal), inkBounds(decodePng(MASTERS.horizontal))), 1200), 0.02);
  write('qiu-logo-horizontal-dark.png', recolour(horizontal, INK_DARK));
  write('qiu-logo-horizontal-light.png', recolour(horizontal, INK_LIGHT));

  // --- stacked lockup: for the login card, footer and anywhere with height.
  const stackedSrc = decodePng(MASTERS.stacked);
  const stacked = pad(resize(crop(stackedSrc, inkBounds(stackedSrc)), 800), 0.02);
  write('qiu-logo-stacked-dark.png', recolour(stacked, INK_DARK));
  write('qiu-logo-stacked-light.png', recolour(stacked, INK_LIGHT));

  // --- the QIU glyph alone: favicon, compact chrome, avatar fallbacks.
  const horizSrc = decodePng(MASTERS.horizontal);
  const horizTight = crop(horizSrc, inkBounds(horizSrc));
  const gutter = splitAtWidestGutter(horizTight);
  const glyphRaw = crop(horizTight, { minX: 0, minY: 0, maxX: gutter - 1, maxY: horizTight.height - 1 });
  const glyph = pad(resize(crop(glyphRaw, inkBounds(glyphRaw)), 512), 0.06);
  write('qiu-mark-dark.png', recolour(glyph, INK_DARK));
  write('qiu-mark-light.png', recolour(glyph, INK_LIGHT));

  // --- favicon. Next's App Router serves app/icon.png automatically, and a
  // browser tab needs a square: the 1.81:1 glyph would otherwise be letterboxed
  // into something unreadable at 16px.
  const iconTight = crop(glyphRaw, inkBounds(glyphRaw));
  const icon = squareCanvas(recolour(iconTight, INK_DARK), 512);
  fs.writeFileSync(path.join(ROOT, 'app', 'icon.png'), encodePng(icon));
  console.log(`  ${'app/icon.png'.padEnd(34)} ${String(icon.width).padStart(5)}x${String(icon.height).padEnd(5)} ${(fs.statSync(path.join(ROOT, 'app', 'icon.png')).size / 1024).toFixed(1).padStart(7)} KB`);

  console.log('\nDone. Assets in public/brand/ — regenerate with `node scripts/build-brand-assets.mjs`.');
}

main();

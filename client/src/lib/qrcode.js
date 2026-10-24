/*
 * Minimal QR Code encoder (ISO/IEC 18004) for the demo QR page — byte mode, error-correction
 * level M, versions 1–10 (up to 213 bytes), automatic mask selection. Written in-house so the
 * app needs no QR dependency; it only ever encodes app-generated URLs. Algorithm follows the
 * public-domain reference by Project Nayuki.
 */

// Error-correction level M, indexed by version (index 0 unused).
const ECC_CODEWORDS_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_ERROR_CORRECTION_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;
const FORMAT_BITS_LEVEL_M = 0;

const getBit = (value, index) => ((value >>> index) & 1) !== 0;

function numRawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(version) {
  return Math.floor(numRawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[version] * NUM_ERROR_CORRECTION_BLOCKS[version];
}

/* ---- Reed–Solomon over GF(2^8), polynomial 0x11D ---- */
function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, i) => {
      result[i] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

/* ---- Data encoding ---- */
function encodeData(bytes) {
  let version = 1;
  for (; version <= MAX_VERSION; version += 1) {
    const needed = 4 + (version <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= numDataCodewords(version) * 8) break;
  }
  if (version > MAX_VERSION) throw new RangeError('Text is too long for this QR encoder.');

  const bits = [];
  const append = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  append(0b0100, 4); // byte mode
  append(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((byte) => append(byte, 8));

  const capacity = numDataCodewords(version) * 8;
  append(0, Math.min(4, capacity - bits.length)); // terminator
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  return { version, codewords };
}

function addEccAndInterleave(version, data) {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[version];
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const divisor = rsDivisor(blockEccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const block = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += block.length;
    const ecc = rsRemainder(block, divisor);
    if (i < numShortBlocks) block.push(0);
    blocks.push(block.concat(ecc));
  }

  const result = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

/* ---- Matrix construction ---- */
function createMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };
  return { version, size, modules, isFunction, set };
}

function alignmentPositions(version, size) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFormatBits(m, mask) {
  const data = (FORMAT_BITS_LEVEL_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const { size, set } = m;
  for (let i = 0; i <= 5; i += 1) set(8, i, getBit(bits, i));
  set(8, 7, getBit(bits, 6));
  set(8, 8, getBit(bits, 7));
  set(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, getBit(bits, i));
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, getBit(bits, i));
  set(8, size - 8, true); // dark module
}

function drawFunctionPatterns(m) {
  const { version, size, set } = m;
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const positions = alignmentPositions(version, size);
  const last = positions.length - 1;
  positions.forEach((px, i) => {
    positions.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  drawFormatBits(m, 0); // reserve the format areas; real bits are drawn after masking

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const bit = getBit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }
}

function drawCodewords(m, data) {
  const { size, modules, isFunction } = m;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && i < data.length * 8) {
          modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
          i += 1;
        }
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m, mask) {
  const test = MASKS[mask];
  for (let y = 0; y < m.size; y += 1) {
    for (let x = 0; x < m.size; x += 1) {
      if (!m.isFunction[y][x] && test(x, y)) m.modules[y][x] = !m.modules[y][x];
    }
  }
}

/** Standard penalty rules N1–N4, used to pick the most readable mask. */
function penaltyScore({ size, modules }) {
  let score = 0;
  const at = (x, y) => modules[y][x];
  const lines = [];
  for (let i = 0; i < size; i += 1) {
    lines.push(Array.from({ length: size }, (_, k) => at(k, i)));
    lines.push(Array.from({ length: size }, (_, k) => at(i, k)));
  }
  const finderLike = [true, false, true, true, true, false, true];
  for (const line of lines) {
    let run = 1;
    for (let k = 1; k <= size; k += 1) {
      if (k < size && line[k] === line[k - 1]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    const light = (k) => k < 0 || k >= size || !line[k];
    for (let k = 0; k + 7 <= size; k += 1) {
      if (finderLike.every((value, offset) => line[k + offset] === value)) {
        const before = [1, 2, 3, 4].every((d) => light(k - d));
        const after = [7, 8, 9, 10].every((d) => light(k + d));
        if (before || after) score += 40;
      }
    }
  }
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) score += 3;
    }
  }
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/**
 * Encode `text` as a QR code. Returns `{ version, size, modules }`, where `modules[y][x]` is
 * true for a dark square. Throws RangeError if the text is longer than version 10-M allows.
 */
export function encodeQr(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const { version, codewords } = encodeData(bytes);
  const matrix = createMatrix(version);
  drawFunctionPatterns(matrix);
  drawCodewords(matrix, addEccAndInterleave(version, codewords));

  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(matrix, mask);
    drawFormatBits(matrix, mask);
    const score = penaltyScore(matrix);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    applyMask(matrix, mask); // undo
  }
  applyMask(matrix, bestMask);
  drawFormatBits(matrix, bestMask);
  return { version, size: matrix.size, modules: matrix.modules };
}

/** SVG path data for the dark modules, with a quiet zone of `margin` modules. */
export function qrPathData({ size, modules }, margin = 4) {
  const parts = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) parts.push(`M${x + margin},${y + margin}h1v1h-1z`);
    }
  }
  return parts.join('');
}

/** Standalone SVG document (for download). */
export function qrSvgString(qr, { margin = 4, title = '' } = {}) {
  const dimension = qr.size + margin * 2;
  const escapedTitle = title.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges"><title>${escapedTitle}</title><rect width="100%" height="100%" fill="#ffffff"/><path d="${qrPathData(qr, margin)}" fill="#000000"/></svg>`;
}

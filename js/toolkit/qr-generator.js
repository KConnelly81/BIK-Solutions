/**
 * QR Code generator — byte-mode, error correction L.
 * Self-contained, no external dependencies.
 * Ported from the well-known qrcode-generator algorithm (MIT).
 *
 * Usage:
 *   import { renderQR } from './qr-generator.js';
 *   renderQR('https://example.com/checkin?p=proj-123', canvasEl);
 *   // or
 *   const svg = qrToSVG('https://example.com/checkin?p=proj-123');
 */

// ── Reed-Solomon GF(256) tables ──────────────────────────────────────────────
const _EXP = new Uint8Array(512);
const _LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    _EXP[i] = x;
    _LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) _EXP[i] = _EXP[i - 255];
})();

function _gfMul(a, b) { return a && b ? _EXP[_LOG[a] + _LOG[b]] : 0; }

function _rsPoly(degree) {
  let p = [1];
  for (let i = 0; i < degree; i++) {
    const q = [1, _EXP[i]];
    const r = new Array(p.length + q.length - 1).fill(0);
    for (let j = 0; j < p.length; j++)
      for (let k = 0; k < q.length; k++)
        r[j + k] ^= _gfMul(p[j], q[k]);
    p = r;
  }
  return p;
}

function _rsEncode(data, ecLen) {
  const genPoly = _rsPoly(ecLen);
  const msg = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef) {
      for (let j = 0; j < genPoly.length; j++)
        msg[i + j] ^= _gfMul(genPoly[j], coef);
    }
  }
  return msg.slice(data.length);
}

// ── Version / capacity tables (byte mode, EC level L) ──────────────────────
// [version]: [totalCodewords, dataCodewords, ecCodewords, alignmentPositions]
const VER = [
  null,
  [26,  19,  7,  []],        // 1
  [44,  34,  10, [6,18]],    // 2
  [70,  55,  15, [6,22]],    // 3
  [100, 80,  20, [6,26]],    // 4
  [134, 108, 26, [6,30]],    // 5
  [172, 136, 36, [6,34]],    // 6
  [196, 156, 40, [6,22,38]], // 7
];

function _pickVersion(byteLen) {
  for (let v = 1; v < VER.length; v++) {
    if (VER[v] && VER[v][1] >= byteLen + 2) return v; // +2 for mode+length bytes
  }
  throw new Error('QR: data too long (max ~150 bytes)');
}

// ── Data encoding (byte mode) ────────────────────────────────────────────────
function _encodeData(text, version) {
  const bytes = new TextEncoder().encode(text);
  const dc = VER[version][1];
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };

  // Mode indicator: byte = 0100
  push(0b0100, 4);
  // Character count (8 bits for version 1-9)
  push(bytes.length, 8);
  // Data bytes
  for (const b of bytes) push(b, 8);
  // Terminator (up to 4 zeros)
  for (let i = 0; i < 4 && bits.length < dc * 8; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8) bits.push(0);
  // Pad codewords
  const PAD = [0b11101100, 0b00010001];
  let pi = 0;
  while (bits.length < dc * 8) { push(PAD[pi++ & 1], 8); }

  // Pack bits into codewords
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    cw.push(b);
  }
  return cw;
}

// ── Matrix builder ───────────────────────────────────────────────────────────
const DARK = 1, LIGHT = 0, RESERVED = 2;

function _newMatrix(size) {
  return Array.from({ length: size }, () => new Uint8Array(size).fill(255));
}

function _setRect(m, r, c, h, w, val) {
  for (let dr = 0; dr < h; dr++)
    for (let dc = 0; dc < w; dc++)
      m[r + dr][c + dc] = val;
}

function _finderPattern(m, r, c) {
  _setRect(m, r, c, 7, 7, DARK);
  _setRect(m, r + 1, c + 1, 5, 5, LIGHT);
  _setRect(m, r + 2, c + 2, 3, 3, DARK);
}

function _alignPattern(m, r, c) {
  if (m[r][c] !== 255) return;
  _setRect(m, r - 2, c - 2, 5, 5, DARK);
  _setRect(m, r - 1, c - 1, 3, 3, LIGHT);
  m[r][c] = DARK;
}

function _buildMatrix(version) {
  const size = 21 + (version - 1) * 4;
  const m = _newMatrix(size);

  // Finder patterns + separators
  _finderPattern(m, 0, 0);
  _finderPattern(m, 0, size - 7);
  _finderPattern(m, size - 7, 0);
  // Separators
  for (let i = 0; i < 8; i++) {
    m[7][i] = m[i][7] = m[7][size - 1 - i] = m[i][size - 8] = LIGHT;
    m[size - 8][i] = m[size - 1 - i][7] = LIGHT;
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = m[i][6] = (i & 1) ? LIGHT : DARK;
  }

  // Dark module
  m[4 * version + 9][8] = DARK;

  // Format information placeholders
  const fmtPos = [0,1,2,3,4,5,7,8, size-8, size-7, size-6, size-5, size-4, size-3, size-2, size-1];
  for (let i = 0; i < 8; i++) {
    m[8][fmtPos[i]] = RESERVED;
    m[fmtPos[i]][8] = RESERVED;
  }
  for (let i = 8; i < 15; i++) {
    m[8][fmtPos[i]] = RESERVED;
    m[fmtPos[i] - (size - 15)][8] = RESERVED;
  }

  // Alignment patterns
  const ap = VER[version][3];
  for (const ar of ap) for (const ac of ap) {
    if ((ar === 6 && ac === 6) || (ar === 6 && ac === ap[ap.length-1]) || (ar === ap[ap.length-1] && ac === 6)) continue;
    _alignPattern(m, ar, ac);
  }

  return { m, size };
}

function _placeData(m, size, dataBits) {
  let bi = 0;
  let up = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (let ri = 0; ri < size; ri++) {
      const row = up ? size - 1 - ri : ri;
      for (let d = 0; d < 2; d++) {
        const c = col - d;
        if (m[row][c] === 255) {
          m[row][c] = bi < dataBits.length ? dataBits[bi++] : LIGHT;
        }
      }
    }
    up = !up;
  }
}

// Mask patterns
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r)    => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function _applyMask(m, size, maskIdx) {
  const fn = MASKS[maskIdx];
  const out = m.map(row => new Uint8Array(row));
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (out[r][c] !== RESERVED && out[r][c] <= 1 && fn(r, c))
        out[r][c] ^= 1;
  return out;
}

// Format string: EC level L (01) + mask pattern
function _formatBits(mask) {
  const EC_L = 0b01;
  let data = (EC_L << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) ? 0x537 : 0);
  const fmt = ((data << 10) | rem) ^ 0x5412;
  return fmt;
}

function _writeFormat(m, size, maskIdx) {
  const fmt = _formatBits(maskIdx);
  const seq = [];
  for (let i = 14; i >= 0; i--) seq.push((fmt >> i) & 1);

  // Top-left
  const pos1 = [8,8,8,8,8,8,8,8, 7,5,4,3,2,1,0];
  const pos2 = [0,1,2,3,4,5,7,8, 8,8,8,8,8,8,8];
  for (let i = 0; i < 15; i++) { m[pos2[i]][pos1[i]] = seq[i]; m[pos1[i]][pos2[i]] = seq[i]; }

  // Bottom-left + top-right
  const bSeq = seq.slice(0, 7);
  for (let i = 0; i < 7; i++) m[size - 1 - i][8] = bSeq[i];
  const rSeq = seq.slice(8);
  for (let i = 0; i < 7; i++) m[8][size - 8 + i] = rSeq[i];
}

function _penalty(m, size) {
  let pen = 0;
  // Rule 1: 5+ in a row
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 4; c++) {
      const v = m[r][c];
      if (m[r][c+1]===v && m[r][c+2]===v && m[r][c+3]===v && m[r][c+4]===v) pen += 3;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size - 4; r++) {
      const v = m[r][c];
      if (m[r+1][c]===v && m[r+2][c]===v && m[r+3][c]===v && m[r+4][c]===v) pen += 3;
    }
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (m[r][c]===m[r][c+1] && m[r][c]===m[r+1][c] && m[r][c]===m[r+1][c+1]) pen += 3;
  return pen;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Generate a QR matrix for the given text. Returns { matrix, size }. */
export function generateQR(text) {
  const bytes = new TextEncoder().encode(text);
  const version = _pickVersion(bytes.length);
  const [, , ecLen] = VER[version];

  const dataCW = _encodeData(text, version);
  const ecCW   = _rsEncode(dataCW, ecLen);
  const allCW  = [...dataCW, ...ecCW];

  // Bits from codewords
  const bits = [];
  for (const cw of allCW) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  // Remainder bits
  const rem = [0,7,7,7,7,7,0][version] || 0;
  for (let i = 0; i < rem; i++) bits.push(0);

  const { m, size } = _buildMatrix(version);
  _placeData(m, size, bits);

  // Pick best mask by penalty
  let bestMask = 0, bestPen = Infinity, bestMatrix = null;
  for (let mi = 0; mi < 8; mi++) {
    const masked = _applyMask(m, size, mi);
    _writeFormat(masked, size, mi);
    const p = _penalty(masked, size);
    if (p < bestPen) { bestPen = p; bestMask = mi; bestMatrix = masked; }
  }
  _writeFormat(bestMatrix, size, bestMask);

  return { matrix: bestMatrix, size };
}

/** Render a QR code into an existing <canvas> element. */
export function renderQR(text, canvas, { scale = 6, padding = 4, fg = '#252320', bg = '#fff' } = {}) {
  const { matrix, size } = generateQR(text);
  const total = (size + padding * 2) * scale;
  canvas.width = total;
  canvas.height = total;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = fg;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === DARK || (matrix[r][c] !== LIGHT && matrix[r][c] !== RESERVED && matrix[r][c])) {
        ctx.fillRect((c + padding) * scale, (r + padding) * scale, scale, scale);
      }
    }
  }
}

/** Return an SVG string for the QR code. */
export function qrToSVG(text, { padding = 4, fg = '#252320', bg = '#fff' } = {}) {
  const { matrix, size } = generateQR(text);
  const total = size + padding * 2;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = matrix[r][c];
      if (v === DARK || (v !== LIGHT && v !== RESERVED && v)) {
        rects.push(`<rect x="${c + padding}" y="${r + padding}" width="1" height="1"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">
  <rect width="${total}" height="${total}" fill="${bg}"/>
  <g fill="${fg}">${rects.join('')}</g>
</svg>`;
}

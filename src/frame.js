// Geometry for the hand frame. Everything here is pure, so it can be tested without a camera.
// Points are {x, y} in 0..1 "display space": x runs left to right as the user sees it on screen
// (the camera image is mirrored), y runs top to bottom.

export const THUMB_TIP = 4;
export const INDEX_TIP = 8;

const mean = (pts) => pts.reduce((s, p) => s + p.x, 0) / pts.length;

/**
 * Build the four frame corners from two hands: each hand contributes its thumb tip and index tip.
 * Returns [topLeft, topRight, bottomRight, bottomLeft], or null if two hands are not visible.
 * Corners are assigned by position on screen, so it works whichever hand is which and however
 * the hands are turned.
 */
export function cornersFromHands(hands) {
  if (!hands || hands.length < 2) return null;
  const [a, b] = [...hands].sort((h1, h2) => mean(h1) - mean(h2));
  const split = (hand) => {
    const [top, bottom] = [hand[THUMB_TIP], hand[INDEX_TIP]].sort((p, q) => p.y - q.y);
    return { top, bottom };
  };
  const left = split(a);
  const right = split(b);
  return [left.top, right.top, right.bottom, left.bottom].map((p) => ({ x: p.x, y: p.y }));
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Signed area of a polygon (shoelace). Positive for clockwise on a y-down screen. */
export function polygonArea(q) {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    const n = q[(i + 1) % q.length];
    s += p.x * n.y - n.x * p.y;
  }
  return s / 2;
}

/** True when the quad is convex (no twisted or dented corners) and big enough to be useful. */
export function isValidQuad(q, minArea = 0.004) {
  if (!q || q.length !== 4) return false;
  const signs = q.map((p, i) => Math.sign(cross(p, q[(i + 1) % 4], q[(i + 2) % 4])));
  const convex = signs.every((s) => s !== 0 && s === signs[0]);
  return convex && Math.abs(polygonArea(q)) >= minArea;
}

/** True when point p is inside the convex quad q. */
export function pointInQuad(p, q) {
  const signs = q.map((a, i) => Math.sign(cross(a, q[(i + 1) % 4], p)));
  return signs.every((s) => s >= 0) || signs.every((s) => s <= 0);
}

/**
 * Homography that maps the unit square (0,0),(1,0),(1,1),(0,1) onto the quad q
 * [topLeft, topRight, bottomRight, bottomLeft]. Row-major 3x3.
 * (Paul Heckbert, "Fundamentals of Texture Mapping and Image Warping".)
 */
export function squareToQuad(q) {
  const [p0, p1, p2, p3] = q;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    return [
      [p1.x - p0.x, p3.x - p0.x, p0.x],
      [p1.y - p0.y, p3.y - p0.y, p0.y],
      [0, 0, 1],
    ];
  }
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [
    [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x],
    [p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y],
    [g, h, 1],
  ];
}

export function invert3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-14) return null;
  const k = 1 / det;
  return [
    [A * k, -(b * i - c * h) * k, (b * f - c * e) * k],
    [B * k, (a * i - c * g) * k, -(a * f - c * d) * k],
    [C * k, -(a * h - b * g) * k, (a * e - b * d) * k],
  ];
}

/** Apply a 3x3 homography to a point. */
export function applyHomography(m, p) {
  const w = m[2][0] * p.x + m[2][1] * p.y + m[2][2];
  return {
    x: (m[0][0] * p.x + m[0][1] * p.y + m[0][2]) / w,
    y: (m[1][0] * p.x + m[1][1] * p.y + m[1][2]) / w,
  };
}

/** Row-major 3x3 to the flat column-major array WebGL expects for uniformMatrix3fv. */
export function toColumnMajor(m) {
  return new Float32Array([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]]);
}

/**
 * One Euro filter (Casiez, Roussel & Vogel, 2012): smooths jitter when a point is still,
 * but follows quickly when it moves fast. Used so the frame does not shake.
 */
export class OneEuro {
  constructor({ minCutoff = 1.2, beta = 8, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = null;
    this.dx = 0;
    this.t = null;
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset() {
    this.x = null;
    this.t = null;
    this.dx = 0;
  }

  /** value at time tMs (milliseconds) */
  filter(value, tMs) {
    if (this.x === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max((tMs - this.t) / 1000, 1e-3);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

/** Smooths the four corners of a frame. */
export class QuadSmoother {
  constructor(options) {
    this.filters = Array.from({ length: 8 }, () => new OneEuro(options));
  }

  reset() {
    for (const f of this.filters) f.reset();
  }

  update(quad, tMs) {
    return quad.map((p, i) => ({
      x: this.filters[i * 2].filter(p.x, tMs),
      y: this.filters[i * 2 + 1].filter(p.y, tMs),
    }));
  }
}

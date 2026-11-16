// Draws a flat image into a four-cornered frame on a 2D canvas, with perspective.
// A 2D canvas can only stretch and skew, so the image is cut into a grid of small triangles,
// each drawn with its own transform. The grid corners come from the homography in frame.js.
import { applyHomography, squareToQuad } from "./frame.js";

/** Grid points of the quad: (n+1) x (n+1) positions in pixels. quad is in 0..1 display space. */
export function meshPoints(quad, width, height, n = 8) {
  const h = squareToQuad(quad);
  const points = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const p = applyHomography(h, { x: i / n, y: j / n });
      points.push({ x: p.x * width, y: p.y * height });
    }
  }
  return points;
}

/** The 2D-canvas transform that maps source triangle s0,s1,s2 onto destination triangle d0,d1,d2. */
export function triangleTransform(s0, s1, s2, d0, d1, d2) {
  const det = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(det) < 1e-9) return null;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / det;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / det;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / det;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / det;
  return [a, b, c, d, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - d * s0.y];
}

export function drawWarped(ctx, image, quad, width, height, n = 8) {
  const pts = meshPoints(quad, width, height, n);
  const iw = image.width;
  const ih = image.height;
  const at = (i, j) => pts[j * (n + 1) + i];
  const src = (i, j) => ({ x: (i / n) * iw, y: (j / n) * ih });
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      for (const tri of [[[i, j], [i + 1, j], [i, j + 1]], [[i + 1, j], [i + 1, j + 1], [i, j + 1]]]) {
        const s = tri.map(([a, b]) => src(a, b));
        const d = tri.map(([a, b]) => at(a, b));
        const m = triangleTransform(...s, ...d);
        if (!m) continue;
        // Grow the clip triangle a little so neighbouring triangles overlap and no seams show.
        const cx = (d[0].x + d[1].x + d[2].x) / 3;
        const cy = (d[0].y + d[1].y + d[2].y) / 3;
        ctx.save();
        ctx.beginPath();
        d.forEach((p, k) => {
          const len = Math.hypot(p.x - cx, p.y - cy) || 1;
          const x = p.x + ((p.x - cx) / len) * 0.8;
          const y = p.y + ((p.y - cy) / len) * 0.8;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.clip();
        ctx.setTransform(...m);
        ctx.drawImage(image, 0, 0);
        ctx.restore();
      }
    }
  }
}

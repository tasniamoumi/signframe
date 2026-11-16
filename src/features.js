// Turns two tracked hands into numbers a classifier can compare.
// The numbers must not change when the same sign is made nearer, further or elsewhere in the picture,
// so each hand is moved to its wrist, and scaled by its own size.

export const WRIST = 0;
export const MIDDLE_KNUCKLE = 9;
export const FEATURE_COUNT = 21 * 2 * 2 + 3;

const dist = (a, b, aspect) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
const centreX = (hand) => hand.reduce((s, p) => s + p.x, 0) / hand.length;

/**
 * hands: two arrays of 21 {x, y} points in display space (0..1). aspect: picture width / height.
 * Returns an array of FEATURE_COUNT numbers, or null unless exactly two usable hands are given.
 */
export function signFeatures(hands, aspect = 1) {
  if (!hands || hands.length !== 2) return null;
  const [left, right] = [...hands].sort((a, b) => centreX(a) - centreX(b));
  const sizes = [left, right].map((h) => dist(h[WRIST], h[MIDDLE_KNUCKLE], aspect));
  if (sizes.some((s) => s < 1e-6)) return null;
  const out = [];
  [left, right].forEach((hand, i) => {
    for (const p of hand) {
      out.push(((p.x - hand[WRIST].x) * aspect) / sizes[i], (p.y - hand[WRIST].y) / sizes[i]);
    }
  });
  // How the two hands sit relative to each other: offset between wrists, and relative size.
  const mean = (sizes[0] + sizes[1]) / 2;
  out.push(((right[WRIST].x - left[WRIST].x) * aspect) / mean, (right[WRIST].y - left[WRIST].y) / mean);
  out.push(Math.log(sizes[1] / sizes[0]));
  return out;
}

export function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

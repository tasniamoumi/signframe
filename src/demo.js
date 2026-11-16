// Demo mode: a drawn room, a drawn person and simulated hands, so the whole flow can be watched
// without a camera. The hands are 21-point skeletons in the tracker's format, and the demo's signs
// go through the same features, classifier and detector as real ones.
import { NONE } from "./classifier.js";
import { signFeatures } from "./features.js";

const W = 960;
const H = 540;

const FINGERS = [
  { first: 1, angle: -62, base: [-0.55, 0.35], length: 1.0 },
  { first: 5, angle: -12, base: [-0.38, 1.0], length: 1.15 },
  { first: 9, angle: 2, base: [-0.08, 1.05], length: 1.25 },
  { first: 13, angle: 14, base: [0.2, 1.0], length: 1.15 },
  { first: 17, angle: 28, base: [0.44, 0.88], length: 0.9 },
];

/** A hand skeleton in 0..1 space. side: -1 for the hand on the left of the screen, +1 for the right. */
export function makeHand({ x, y, size, side, tilt = 0, curl = 0 }) {
  const points = new Array(21);
  const rot = (px, py) => {
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    return { x: x + (px * c - py * s) * size * side * (H / W), y: y - (px * s + py * c) * size };
  };
  points[0] = rot(0, 0);
  for (const f of FINGERS) {
    const a = (f.angle * Math.PI) / 180;
    const shorten = f.first > 1 ? 1 - curl * 0.62 : 1 - curl * 0.3;
    for (let j = 0; j < 4; j++) {
      const d = (f.length * j * shorten) / 3;
      points[f.first + j] = rot(f.base[0] + Math.sin(a) * d, f.base[1] + Math.cos(a) * d);
    }
  }
  return points;
}

// Each pose: distance of each hand from the centre line, height, size, inward tilt, finger curl, and
// how much lower the right hand is. These are made-up poses for the demo, not anyone's real signs.
export const POSES = {
  rest: { spread: 0.24, y: 1.38, size: 0.15, tilt: -0.5, curl: 0.3, drop: 0 },   // below the picture: hands down
  flame: { spread: 0.03, y: 0.8, size: 0.14, tilt: 0.75, curl: 0, drop: 0 },
  storm: { spread: 0.085, y: 0.78, size: 0.15, tilt: -0.35, curl: 1, drop: 0 },
  tide: { spread: 0.06, y: 0.76, size: 0.15, tilt: 0.1, curl: 0.45, drop: 0.09 },
  frame: { spread: 0.33, y: 0.9, size: 0.22, tilt: 0.22, curl: 0, drop: 0 },
};

export function handsFor(pose, wobble = 0) {
  const p = POSES[pose] ?? pose;
  const w = (k) => Math.sin(wobble * 2.3 + k) * 0.006;
  return [
    makeHand({ x: 0.5 - p.spread + w(1), y: p.y + w(2), size: p.size, side: -1, tilt: p.tilt + w(3) * 4, curl: p.curl }),
    makeHand({ x: 0.5 + p.spread + w(4), y: p.y + p.drop + w(5), size: p.size, side: 1, tilt: p.tilt + w(6) * 4, curl: p.curl }),
  ];
}

const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function blend(a, b, t) {
  const A = POSES[a];
  const B = POSES[b];
  const k = ease(t);
  return Object.fromEntries(Object.keys(A).map((key) => [key, mix(A[key], B[key], k)]));
}

/** Samples that teach the classifier the demo's own poses, so the demo runs the real pipeline. */
export function demoSamples() {
  const out = [];
  for (const [label, pose] of [["flame", "flame"], ["storm", "storm"], ["tide", "tide"], [NONE, "frame"]]) {
    for (let i = 0; i < 14; i++) out.push({ label, features: signFeatures(handsFor(pose, i * 0.9 + label.length), W / H) });
  }
  return out;
}

// The demo's script: [seconds, pose]. Poses blend over 0.45 s. The script loops.
const SCRIPT = [
  [0, "rest"], [1.4, "flame"], [3.2, "frame"], [5.6, "rest"], [6.3, "frame"], [8.4, "rest"], [9.1, "frame"],
  [11.2, "rest"], [12.0, "storm"], [13.8, "frame"], [16.0, "rest"], [16.8, "tide"], [18.6, "frame"], [20.8, "rest"],
  [21.6, "tide"], [23.4, "rest"],
];
export const SCRIPT_LENGTH = 24.5;

function scriptedPose(t) {
  const time = t % SCRIPT_LENGTH;
  let i = SCRIPT.length - 1;
  while (i > 0 && SCRIPT[i][0] > time) i--;
  const [start, pose] = SCRIPT[i];
  const previous = i > 0 ? SCRIPT[i - 1][1] : "rest";
  return blend(previous, pose, (time - start) / 0.45);
}

/** The demo's hands at t seconds, as a tracker would report them: hands out of the picture are absent. */
export function scriptedHands(t) {
  return handsFor(scriptedPose(t), t).filter((hand) => hand.filter((p) => p.y < 1 && p.y > 0).length >= 12);
}

function drawRoom(ctx) {
  ctx.fillStyle = "#b9b4aa";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#a39d92";
  ctx.fillRect(0, H * 0.7, W, H * 0.3);
  ctx.fillStyle = "#8d877c";
  ctx.fillRect(90, 105, 225, 14);
  ctx.fillRect(645, 165, 240, 14);
  for (const [x, y, w, h, color] of [[120, 60, 38, 45, "#6f7f8f"], [168, 72, 26, 33, "#8f6f6f"], [690, 117, 32, 48, "#7f8f6f"], [205, 66, 20, 39, "#9a8f6a"]]) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = "#d8d4cc";
  ctx.fillRect(760, 225, 100, 130);
  ctx.strokeStyle = "#8d877c";
  ctx.lineWidth = 6;
  ctx.strokeRect(760, 225, 100, 130);
}

function drawPerson(ctx, mask) {
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(250, H);
    ctx.quadraticCurveTo(285, 352, 480, 342);
    ctx.quadraticCurveTo(675, 352, 710, H);
    ctx.fill();
    ctx.fillRect(444, 286, 72, 70);
  };
  ctx.fillStyle = mask ? "#000" : "#3d4250";
  body();
  ctx.fillStyle = mask ? "#000" : "#c79f86";
  ctx.beginPath();
  ctx.ellipse(480, 226, 69, 84, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mask ? "#000" : "#2a2d38";
  ctx.beginPath();
  ctx.ellipse(480, 178, 75, 52, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(405, 168, 150, 22);
}

function drawHandShape(ctx, hand, color) {
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.lineWidth = 17;
  const px = (i) => [hand[i].x * W, hand[i].y * H];
  ctx.beginPath();
  for (const first of [1, 5, 9, 13, 17]) {
    ctx.moveTo(...px(0));
    for (let j = 0; j < 4; j++) ctx.lineTo(...px(first + j));
  }
  ctx.stroke();
  ctx.beginPath();
  [0, 1, 5, 9, 13, 17].forEach((i, k) => (k ? ctx.lineTo(...px(i)) : ctx.moveTo(...px(i))));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function createDemoSource() {
  const image = document.createElement("canvas");
  const mask = document.createElement("canvas");
  for (const c of [image, mask]) {
    c.width = W;
    c.height = H;
  }
  const ictx = image.getContext("2d");
  const mctx = mask.getContext("2d");
  let started = null;

  return {
    kind: "demo",
    image,
    mask,
    width: W,
    height: H,
    mirrored: false, // the drawn scene is already in display space
    /** Seconds into the script; the app restarts its state each time this wraps round. */
    scriptTime(nowMs) {
      started ??= nowMs;
      return ((nowMs - started) / 1000) % SCRIPT_LENGTH;
    },
    hands(nowMs) {
      started ??= nowMs;
      const t = (nowMs - started) / 1000;
      const hands = scriptedHands(t);
      drawRoom(ictx);
      drawPerson(ictx, false);
      mctx.clearRect(0, 0, W, H);
      drawPerson(mctx, true);
      for (const hand of handsFor(scriptedPose(t), t)) {
        drawHandShape(ictx, hand, "#c79f86");
        drawHandShape(mctx, hand, "#000");
      }
      return hands;
    },
    updateMask() {},
    stop() {},
  };
}

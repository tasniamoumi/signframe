// The three worlds that replace the room. Each is drawn fresh every frame, with depth: a floor
// grid or skyline in perspective, glow, and particles. Canvas 2D only, so it runs anywhere.

export const WORLDS = [
  { id: "flame", sign: "flame", name: "Ember Grid", accent: "#ff7a3c" },
  { id: "storm", sign: "storm", name: "Neon City", accent: "#5ad1ff" },
  { id: "tide", sign: "tide", name: "Orbit Shrine", accent: "#6dffd2" },
];

const rand = (i) => {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

function sky(ctx, w, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A floor grid in perspective that scrolls towards the viewer. */
function floorGrid(ctx, w, h, horizon, t, color, speed = 0.5) {
  const base = ctx.createLinearGradient(0, horizon, 0, h);
  base.addColorStop(0, "rgba(0,0,0,.2)");
  base.addColorStop(1, "rgba(0,0,0,.75)");
  ctx.fillStyle = base;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.save();
  // drawn twice, wide and faint then thin and bright: a cheap glow without canvas shadows
  for (const [width, alpha] of [[h * 0.012, 0.22], [Math.max(1, h * 0.0028), 1]]) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = -16; i <= 16; i++) {
    ctx.moveTo(w / 2 + i * w * 0.018, horizon);
    ctx.lineTo(w / 2 + i * w * 0.2, h);
  }
  const phase = (t * speed) % 1;
  for (let j = 0; j < 12; j++) {
    const z = (j + phase) / 12;
    const y = horizon + (h - horizon) * z * z;
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  }
  ctx.restore();
  glow(ctx, w / 2, horizon, w * 0.6, "rgba(255,255,255,.1)");
}

function flame(ctx, w, h, t) {
  sky(ctx, w, h, [[0, "#0b0618"], [0.45, "#3b0f3f"], [0.62, "#b3263c"], [0.64, "#12060f"], [1, "#05030a"]]);
  const horizon = h * 0.63;
  // a banded sun sitting on the horizon
  const cx = w / 2;
  const r = h * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, horizon);
  ctx.clip();
  glow(ctx, cx, horizon - r * 0.35, r * 2.2, "rgba(255,120,60,.55)");
  const sun = ctx.createLinearGradient(0, horizon - r * 1.35, 0, horizon);
  sun.addColorStop(0, "#ffe27a");
  sun.addColorStop(0.55, "#ff7a3c");
  sun.addColorStop(1, "#ff2e88");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, horizon - r * 0.35, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b0f3f";
  for (let i = 0; i < 7; i++) {
    const y = horizon - r * 0.9 + ((i + (t * 0.25) % 1) / 7) ** 1.6 * r * 0.95;
    ctx.fillRect(cx - r, y, r * 2, h * 0.004 + i * h * 0.0022);
  }
  ctx.restore();
  // jagged ridge silhouettes either side of the sun
  ctx.fillStyle = "#0a0412";
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= w; x += w / 60) {
    const edge = Math.abs(x - cx) / (w / 2);
    ctx.lineTo(x, horizon - Math.max(0, edge - 0.32) * h * 0.34 * (0.6 + rand(Math.round(x / (w / 60))) * 0.8));
  }
  ctx.lineTo(w, horizon);
  ctx.fill();
  floorGrid(ctx, w, h, horizon, t, "#ff4fa0", 0.6);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 70; i++) {
    const life = (t * (0.1 + rand(i) * 0.18) + rand(i + 9)) % 1;
    const x = rand(i + 3) * w + Math.sin(t * 1.4 + i) * w * 0.02;
    glow(ctx, x, h * (1.03 - life), h * (0.008 + rand(i + 5) * 0.012), `rgba(255,${130 + Math.floor(rand(i) * 90)},60,${(1 - life) * 0.9})`);
  }
  ctx.globalCompositeOperation = "source-over";
}

function storm(ctx, w, h, t) {
  sky(ctx, w, h, [[0, "#03050d"], [0.55, "#0b1836"], [0.78, "#1b2a5c"], [1, "#05060f"]]);
  const flash = Math.max(0, Math.sin(t * 1.9) * Math.sin(t * 0.63 + 1) - 0.8) * 5;
  // searchlights
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const x = w * (0.2 + i * 0.3);
    const a = Math.sin(t * (0.35 + i * 0.12) + i * 2) * 0.5;
    const beam = ctx.createLinearGradient(x, h * 0.8, x + Math.sin(a) * h, h * 0.8 - Math.cos(a) * h);
    beam.addColorStop(0, "rgba(90,209,255,.28)");
    beam.addColorStop(1, "rgba(90,209,255,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.8);
    ctx.lineTo(x + Math.sin(a - 0.07) * h, h * 0.8 - Math.cos(a - 0.07) * h);
    ctx.lineTo(x + Math.sin(a + 0.07) * h, h * 0.8 - Math.cos(a + 0.07) * h);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  // three rows of towers, far to near, with lit windows
  for (let row = 0; row < 3; row++) {
    const shade = ["#0d1a3d", "#081029", "#040817"][row];
    const count = 16 - row * 4;
    const drift = (t * (0.004 + row * 0.004)) % 1;
    for (let i = -1; i <= count; i++) {
      const bw = w / count;
      const x = (i + drift) * bw;
      const id = i + row * 40;
      const bh = h * (0.16 + rand(id) * 0.3 + row * 0.07);
      const top = h * (0.74 + row * 0.09) - bh;
      ctx.fillStyle = shade;
      ctx.fillRect(x, top, bw * 0.86, h - top);
      const cols = 4;
      const rows = Math.floor(bh / (h * 0.03));
      for (let cy = 0; cy < rows; cy++) {
        for (let cxi = 0; cxi < cols; cxi++) {
          const on = rand(id * 7 + cy * 13 + cxi * 3 + Math.floor(t * 0.3 + rand(id + cy) * 5)) > 0.62;
          if (!on) continue;
          ctx.fillStyle = [`rgba(90,209,255,${0.5 + row * 0.2})`, `rgba(255,79,200,${0.45 + row * 0.2})`, `rgba(255,214,120,${0.4 + row * 0.2})`][(id + cy) % 3];
          ctx.fillRect(x + bw * (0.1 + cxi * 0.19), top + h * 0.012 + cy * h * 0.03, bw * 0.1, h * 0.012);
        }
      }
      if (rand(id + 99) > 0.6) {
        ctx.fillStyle = rand(id) > 0.5 ? "#ff4fc8" : "#5ad1ff";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = h * 0.03;
        ctx.fillRect(x + bw * 0.1, top - h * 0.006, bw * 0.66, h * 0.006);
        ctx.shadowBlur = 0;
      }
    }
  }
  if (flash > 0.05) {
    ctx.strokeStyle = `rgba(220,240,255,${Math.min(1, flash * 2)})`;
    ctx.shadowColor = "#9fdcff";
    ctx.shadowBlur = h * 0.04;
    ctx.lineWidth = h * 0.006;
    ctx.beginPath();
    const seed = Math.floor(t * 1.9);
    let x = w * (0.15 + rand(seed) * 0.7);
    let y = 0;
    ctx.moveTo(x, y);
    for (let i = 0; i < 8; i++) {
      x += (rand(i + seed * 7) - 0.5) * w * 0.1;
      y += h * 0.07;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(190,220,255,${flash * 0.22})`;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = "rgba(150,210,255,.4)";
  ctx.lineWidth = Math.max(1, h * 0.002);
  ctx.beginPath();
  for (let i = 0; i < 120; i++) {
    const x = ((rand(i) + t * 0.22) % 1.2 - 0.1) * w;
    const y = ((rand(i + 7) + t * (1.5 + rand(i + 1))) % 1) * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x - h * 0.014, y + h * 0.055);
  }
  ctx.stroke();
}

function tide(ctx, w, h, t) {
  sky(ctx, w, h, [[0, "#02040c"], [0.5, "#06202e"], [0.66, "#0f5b5e"], [0.67, "#031018"], [1, "#010308"]]);
  const horizon = h * 0.66;
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.6 * Math.abs(Math.sin(t * 1.2 + i * 2.1))})`;
    const s = rand(i + 40) > 0.9 ? 3 : 1.6;
    ctx.fillRect(rand(i) * w, rand(i + 11) * horizon * 0.95, s, s);
  }
  // a ringed planet, shaded on one side
  const px = w * 0.27;
  const py = h * 0.3;
  const pr = h * 0.2;
  glow(ctx, px, py, pr * 2.6, "rgba(109,255,210,.28)");
  const ring = (front) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.38);
    ctx.scale(1, 0.26);
    ctx.strokeStyle = "rgba(170,255,230,.8)";
    ctx.shadowColor = "#6dffd2";
    ctx.shadowBlur = h * 0.03;
    ctx.lineWidth = pr * 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, pr * 1.7, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  ring(false);
  const body = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
  body.addColorStop(0, "#eafff7");
  body.addColorStop(0.5, "#58c7b4");
  body.addColorStop(1, "#06323a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ring(true);
  // a floating gate of light on the horizon
  const gx = w * 0.72;
  const s = h * 0.24;
  const bob = Math.sin(t * 0.9) * h * 0.012;
  ctx.save();
  ctx.strokeStyle = "#b8fff0";
  ctx.shadowColor = "#6dffd2";
  ctx.shadowBlur = h * 0.045;
  ctx.lineWidth = h * 0.012;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(gx - s * 0.5, horizon + bob);
  ctx.lineTo(gx - s * 0.5, horizon - s + bob);
  ctx.lineTo(gx + s * 0.5, horizon - s + bob);
  ctx.lineTo(gx + s * 0.5, horizon + bob);
  ctx.moveTo(gx - s * 0.72, horizon - s * 0.78 + bob);
  ctx.lineTo(gx + s * 0.72, horizon - s * 0.78 + bob);
  ctx.stroke();
  ctx.restore();
  const inner = ctx.createLinearGradient(0, horizon - s, 0, horizon);
  inner.addColorStop(0, "rgba(109,255,210,.05)");
  inner.addColorStop(1, "rgba(109,255,210,.3)");
  ctx.fillStyle = inner;
  ctx.fillRect(gx - s * 0.5, horizon - s * 0.78 + bob, s, s * 0.78);
  floorGrid(ctx, w, h, horizon, t, "#39d6c0", 0.35);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 26; i++) {
    const x = (rand(i) * w + Math.sin(t * 0.5 + i) * w * 0.03) % w;
    const y = h * (0.2 + rand(i + 5) * 0.7) + Math.sin(t * 0.8 + i * 2) * h * 0.03;
    glow(ctx, x, y, h * 0.02, "rgba(125,255,220,.6)");
  }
  ctx.globalCompositeOperation = "source-over";
}

const PAINTERS = { flame, storm, tide };

export function drawWorld(ctx, id, w, h, t) {
  (PAINTERS[id] ?? flame)(ctx, w, h, t);
}

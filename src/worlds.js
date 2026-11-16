// The three anime-style worlds that replace the room. Each is drawn fresh every frame so it moves.

export const WORLDS = [
  { id: "flame", sign: "flame", name: "Ember Valley", accent: "#ff9b54" },
  { id: "storm", sign: "storm", name: "Storm Peak", accent: "#8fd3ff" },
  { id: "tide", sign: "tide", name: "Moon Shrine", accent: "#7df0d0" },
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

function ridges(ctx, w, h, t, colors, base, speed) {
  colors.forEach((color, layer) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 80) {
      const u = x / w;
      const peak = Math.abs(Math.sin(u * (5 + layer * 3) + layer * 1.7 + t * speed * (layer + 1)));
      ctx.lineTo(x, h * (base + layer * 0.11) - peak * h * (0.16 - layer * 0.04) - Math.sin(u * 23 + layer) * h * 0.012);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  });
}

function orb(ctx, x, y, r, core, glow) {
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
  g.addColorStop(0, glow);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function flame(ctx, w, h, t) {
  sky(ctx, w, h, [[0, "#1a1235"], [0.5, "#5a2a55"], [0.82, "#d6583f"], [1, "#f6a14e"]]);
  orb(ctx, w * 0.74, h * 0.34, h * 0.15, "#ffe7bd", "rgba(255,190,120,.45)");
  ridges(ctx, w, h, t, ["#3a1f45", "#27163a", "#160d26"], 0.66, 0.012);
  for (let i = 0; i < 60; i++) {
    const life = (t * (0.12 + rand(i) * 0.2) + rand(i + 9)) % 1;
    const x = rand(i + 3) * w + Math.sin(t * 1.5 + i) * w * 0.02;
    ctx.fillStyle = `rgba(255,${150 + Math.floor(rand(i) * 80)},80,${(1 - life) * 0.9})`;
    ctx.beginPath();
    ctx.arc(x, h * (1.02 - life * 0.9), h * (0.004 + rand(i + 5) * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
}

function storm(ctx, w, h, t) {
  sky(ctx, w, h, [[0, "#070b18"], [0.6, "#1c2f4f"], [1, "#3f5f7d"]]);
  const flash = Math.max(0, Math.sin(t * 1.9) * Math.sin(t * 0.63 + 1) - 0.82) * 5;
  for (let i = 0; i < 7; i++) {
    const x = ((rand(i) * 1.4 + t * (0.01 + rand(i + 2) * 0.012)) % 1.4 - 0.2) * w;
    ctx.fillStyle = `rgba(${60 + flash * 120},${75 + flash * 120},${105 + flash * 110},.55)`;
    ctx.beginPath();
    ctx.ellipse(x, h * (0.12 + rand(i + 4) * 0.22), w * (0.14 + rand(i + 6) * 0.1), h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (flash > 0.05) {
    ctx.strokeStyle = `rgba(215,235,255,${Math.min(1, flash * 2)})`;
    ctx.lineWidth = h * 0.006;
    ctx.beginPath();
    let x = w * (0.2 + rand(Math.floor(t * 1.9)) * 0.6);
    let y = h * 0.18;
    ctx.moveTo(x, y);
    for (let i = 0; i < 7; i++) {
      x += (rand(i + Math.floor(t * 1.9) * 7) - 0.5) * w * 0.09;
      y += h * 0.075;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(200,225,255,${flash * 0.25})`;
    ctx.fillRect(0, 0, w, h);
  }
  ridges(ctx, w, h, t, ["#16233a", "#0e172a", "#070c18"], 0.62, 0.008);
  ctx.strokeStyle = "rgba(170,200,235,.35)";
  ctx.lineWidth = Math.max(1, h * 0.002);
  ctx.beginPath();
  for (let i = 0; i < 110; i++) {
    const x = ((rand(i) + t * 0.25) % 1.2 - 0.1) * w;
    const y = ((rand(i + 7) + t * (1.4 + rand(i + 1))) % 1) * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x - h * 0.012, y + h * 0.05);
  }
  ctx.stroke();
}

function tide(ctx, w, h, t) {
  sky(ctx, w, h, [[0, "#04121f"], [0.5, "#0d3a4a"], [0.62, "#1f7a78"], [0.63, "#0a2c3a"], [1, "#04121f"]]);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * Math.abs(Math.sin(t * 1.3 + i * 2.1))})`;
    ctx.fillRect(rand(i) * w, rand(i + 11) * h * 0.52, 2, 2);
  }
  orb(ctx, w * 0.28, h * 0.26, h * 0.12, "#f2fff8", "rgba(150,255,225,.38)");
  // a gate on the horizon, mirrored in the water
  const gx = w * 0.72;
  const gy = h * 0.62;
  const s = h * 0.2;
  ctx.fillStyle = "#06202a";
  for (const dir of [1, -0.55]) {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.scale(1, dir);
    ctx.globalAlpha = dir < 0 ? 0.5 : 1;
    ctx.fillRect(-s * 0.55, -s, s * 0.12, s);
    ctx.fillRect(s * 0.43, -s, s * 0.12, s);
    ctx.fillRect(-s * 0.8, -s * 1.02, s * 1.6, s * 0.12);
    ctx.fillRect(-s * 0.62, -s * 0.76, s * 1.24, s * 0.08);
    ctx.restore();
  }
  for (let i = 0; i < 16; i++) {
    const y = h * (0.66 + i * 0.022);
    const half = w * (0.03 + i * 0.012) * (0.7 + 0.3 * Math.sin(t * 2 + i));
    ctx.fillStyle = `rgba(190,255,235,${0.4 - i * 0.02})`;
    ctx.fillRect(w * 0.28 - half + Math.sin(t * 1.7 + i * 1.3) * w * 0.01, y, half * 2, h * 0.006);
  }
  for (let i = 0; i < 22; i++) {
    const x = (rand(i) * w + Math.sin(t * 0.5 + i) * w * 0.03) % w;
    const y = h * (0.25 + rand(i + 5) * 0.6) + Math.sin(t * 0.8 + i * 2) * h * 0.03;
    orb(ctx, x, y, h * 0.004, "#d8fff2", "rgba(125,240,208,.5)");
  }
}

const PAINTERS = { flame, storm, tide };

export function drawWorld(ctx, id, w, h, t) {
  (PAINTERS[id] ?? flame)(ctx, w, h, t);
}

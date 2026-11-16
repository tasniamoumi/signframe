// The built-in cast, drawn with canvas shapes. Every character here is original to this project.
// A card is drawn once into its own canvas and then warped into the hand frame each frame.

export const CARD_W = 640;
export const CARD_H = 400;

export const CAST = {
  rei: { hair: "#27b3a4", hairDark: "#16786f", skin: "#f3d0b8", cloth: "#1d3a44", eye: "#1f8a8a", style: "long", mark: "moon" },
  daku: { hair: "#8a2231", hairDark: "#571420", skin: "#e2b392", cloth: "#2a1516", eye: "#c4482f", style: "spiky", mark: "flame", scar: true },
  mio: { hair: "#8062dd", hairDark: "#5038a8", skin: "#f7dccb", cloth: "#231b4d", eye: "#6b4fd1", style: "bob", mark: "star", pin: true },
  kaze: { hair: "#eef2f6", hairDark: "#aab6c4", skin: "#eec4a6", cloth: "#1c3350", eye: "#3b9ae1", style: "undercut", mark: "wind", goggles: true },
  tsuchi: { hair: "#6b4a2f", hairDark: "#432d1b", skin: "#c99873", cloth: "#263321", eye: "#5d7f3a", style: "braid", mark: "stone", beads: true, broad: true },
  yoru: { hair: "#15151c", hairDark: "#000000", skin: "#ead2c4", cloth: "#0e0e13", eye: "#d6a93a", style: "curtain", mark: "eclipse", collar: true },
};

function mark(ctx, kind, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (kind === "moon") {
    ctx.arc(0, 0, r, 0.6, Math.PI * 2 - 0.6);
    ctx.arc(r * 0.45, 0, r * 0.78, Math.PI * 2 - 0.95, 0.95, true);
    ctx.fill();
  } else if (kind === "flame") {
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 1.1, -r * 0.1, r * 0.8, r, 0, r);
    ctx.bezierCurveTo(-r * 0.8, r, -r * 0.9, r * 0.1, -r * 0.3, -r * 0.3);
    ctx.bezierCurveTo(-r * 0.1, 0, r * 0.1, -r * 0.4, 0, -r);
    ctx.fill();
  } else if (kind === "star") {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const rr = i % 2 ? r * 0.36 : r;
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.fill();
  } else if (kind === "wind") {
    for (const [dy, len] of [[-r * 0.55, 1], [0, 0.7], [r * 0.55, 0.9]]) {
      ctx.moveTo(-r, dy);
      ctx.quadraticCurveTo(0, dy - r * 0.35, r * len, dy);
    }
    ctx.stroke();
  } else if (kind === "stone") {
    ctx.moveTo(-r, r * 0.6);
    ctx.lineTo(-r * 0.5, -r * 0.6);
    ctx.lineTo(r * 0.3, -r);
    ctx.lineTo(r, r * 0.1);
    ctx.lineTo(r * 0.5, r * 0.8);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.1, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function eye(ctx, x, y, w, h, color) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.1, w * 0.62, h * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#11131c";
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.15, w * 0.3, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x - w * 0.25, y - h * 0.3, w * 0.2, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#11131c";
  ctx.lineWidth = h * 0.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - w * 1.1, y - h * 0.55);
  ctx.quadraticCurveTo(x, y - h * 1.35, x + w * 1.1, y - h * 0.55);
  ctx.stroke();
}

/** Draws a character from the chest up, centred at cx with its chin near cy. u is the unit size. */
export function drawCharacter(ctx, id, cx, cy, u) {
  const c = CAST[id] ?? CAST.rei;
  const headW = 78 * u;
  const headH = 92 * u;
  const top = cy - headH * 1.9;
  const faceY = cy - headH * 0.95;
  ctx.lineJoin = "round";

  // hair behind the head
  ctx.fillStyle = c.hairDark;
  ctx.beginPath();
  if (c.style === "long") ctx.roundRect(cx - headW * 1.25, top + headH * 0.3, headW * 2.5, headH * 3.2, headW * 0.9);
  else if (c.style === "braid") ctx.ellipse(cx, faceY - headH * 0.1, headW * 1.2, headH * 1.15, 0, 0, Math.PI * 2);
  else if (c.style === "curtain") ctx.roundRect(cx - headW * 1.15, top + headH * 0.25, headW * 2.3, headH * 2.1, headW * 0.8);
  else ctx.ellipse(cx, faceY - headH * 0.15, headW * 1.12, headH * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // shoulders and clothes
  const sw = (c.broad ? 250 : 205) * u;
  ctx.fillStyle = c.cloth;
  ctx.beginPath();
  ctx.moveTo(cx - sw, cy + 230 * u);
  ctx.quadraticCurveTo(cx - sw * 0.95, cy + 40 * u, cx - 40 * u, cy + 22 * u);
  ctx.lineTo(cx + 40 * u, cy + 22 * u);
  ctx.quadraticCurveTo(cx + sw * 0.95, cy + 40 * u, cx + sw, cy + 230 * u);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.beginPath();
  ctx.moveTo(cx - 40 * u, cy + 22 * u);
  ctx.lineTo(cx, cy + 110 * u);
  ctx.lineTo(cx + 40 * u, cy + 22 * u);
  ctx.fill();
  if (c.collar) {
    ctx.fillStyle = "#1b1b24";
    ctx.beginPath();
    ctx.moveTo(cx - 95 * u, cy + 50 * u);
    ctx.lineTo(cx - 44 * u, cy - 26 * u);
    ctx.lineTo(cx - 18 * u, cy + 60 * u);
    ctx.moveTo(cx + 95 * u, cy + 50 * u);
    ctx.lineTo(cx + 44 * u, cy - 26 * u);
    ctx.lineTo(cx + 18 * u, cy + 60 * u);
    ctx.fill();
    ctx.strokeStyle = c.eye;
    ctx.lineWidth = 3 * u;
    ctx.stroke();
  }

  // neck and head
  ctx.fillStyle = c.skin;
  ctx.fillRect(cx - 24 * u, cy - 26 * u, 48 * u, 56 * u);
  ctx.fillStyle = "rgba(0,0,0,.12)";
  ctx.fillRect(cx - 24 * u, cy - 26 * u, 48 * u, 18 * u);
  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.moveTo(cx - headW, faceY - headH * 0.35);
  ctx.quadraticCurveTo(cx - headW, faceY + headH * 0.55, cx, faceY + headH * 0.98);
  ctx.quadraticCurveTo(cx + headW, faceY + headH * 0.55, cx + headW, faceY - headH * 0.35);
  ctx.quadraticCurveTo(cx + headW, faceY - headH, cx, faceY - headH);
  ctx.quadraticCurveTo(cx - headW, faceY - headH, cx - headW, faceY - headH * 0.35);
  ctx.fill();

  if (c.beads) {
    ctx.fillStyle = "#b9b2a3";
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 15 * u, cy + 34 * u + (16 - i * i) * 1.6 * u, 8 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // face
  const eyeY = faceY + headH * 0.12;
  eye(ctx, cx - headW * 0.44, eyeY, headW * 0.25, headH * 0.17, c.eye);
  if (c.style !== "curtain") eye(ctx, cx + headW * 0.44, eyeY, headW * 0.25, headH * 0.17, c.eye);
  ctx.strokeStyle = c.hairDark;
  ctx.lineWidth = 5 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - headW * 0.72, eyeY - headH * 0.34);
  ctx.lineTo(cx - headW * 0.2, eyeY - headH * (c.scar ? 0.26 : 0.36));
  if (c.style !== "curtain") {
    ctx.moveTo(cx + headW * 0.72, eyeY - headH * 0.34);
    ctx.lineTo(cx + headW * 0.2, eyeY - headH * (c.scar ? 0.26 : 0.36));
  }
  ctx.stroke();
  if (c.scar) {
    ctx.strokeStyle = "#a8523f";
    ctx.lineWidth = 3.5 * u;
    ctx.beginPath();
    ctx.moveTo(cx + headW * 0.3, eyeY - headH * 0.5);
    ctx.lineTo(cx + headW * 0.56, eyeY - headH * 0.16);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(60,30,25,.7)";
  ctx.lineWidth = 3.5 * u;
  ctx.beginPath();
  ctx.moveTo(cx - headW * 0.18, faceY + headH * 0.6);
  ctx.quadraticCurveTo(cx, faceY + headH * (c.scar || c.collar ? 0.6 : 0.68), cx + headW * 0.18, faceY + headH * 0.6);
  ctx.stroke();

  // hair in front
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  const hy = faceY - headH * 0.38;
  ctx.moveTo(cx - headW * 1.08, hy + headH * 0.3);
  ctx.quadraticCurveTo(cx - headW * 1.15, top, cx, top);
  ctx.quadraticCurveTo(cx + headW * 1.15, top, cx + headW * 1.08, hy + headH * 0.3);
  if (c.style === "spiky") {
    for (const [dx, dy] of [[0.8, 0.5], [0.55, 0.05], [0.3, 0.55], [0.05, 0.1], [-0.25, 0.6], [-0.5, 0.05], [-0.8, 0.5]]) ctx.lineTo(cx + headW * dx, hy + headH * dy * 0.5);
  } else if (c.style === "bob") {
    ctx.lineTo(cx + headW * 0.95, hy + headH * 0.32);
    ctx.quadraticCurveTo(cx, hy + headH * 0.02, cx - headW * 0.95, hy + headH * 0.32);
  } else if (c.style === "undercut") {
    ctx.lineTo(cx + headW * 0.9, hy);
    ctx.quadraticCurveTo(cx + headW * 0.2, hy + headH * 0.2, cx - headW * 0.5, hy - headH * 0.05);
    ctx.lineTo(cx - headW * 1.02, hy + headH * 0.05);
  } else if (c.style === "curtain") {
    ctx.lineTo(cx + headW * 1.05, hy + headH * 1.15);
    ctx.quadraticCurveTo(cx + headW * 0.35, hy + headH * 1.0, cx + headW * 0.02, hy - headH * 0.05);
    ctx.quadraticCurveTo(cx - headW * 0.5, hy + headH * 0.25, cx - headW * 0.95, hy + headH * 0.4);
  } else {
    ctx.lineTo(cx + headW * 0.92, hy + headH * 0.2);
    ctx.quadraticCurveTo(cx + headW * 0.4, hy - headH * 0.05, cx, hy + headH * 0.22);
    ctx.quadraticCurveTo(cx - headW * 0.4, hy - headH * 0.05, cx - headW * 0.92, hy + headH * 0.2);
  }
  ctx.closePath();
  ctx.fill();
  if (c.style === "long" || c.style === "bob") {
    ctx.fillRect(cx - headW * 1.1, hy + headH * 0.2, headW * 0.26, headH * (c.style === "long" ? 1.7 : 0.9));
    ctx.fillRect(cx + headW * 0.84, hy + headH * 0.2, headW * 0.26, headH * (c.style === "long" ? 1.7 : 0.9));
  }
  if (c.style === "braid") {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + headW * 1.05 + (i % 2 ? 6 : -6) * u, cy - 20 * u + i * 34 * u, 19 * u, 22 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.beginPath();
  ctx.ellipse(cx - headW * 0.3, top + headH * 0.34, headW * 0.42, headH * 0.09, -0.3, 0, Math.PI * 2);
  ctx.fill();

  if (c.pin) mark(ctx, "star", cx + headW * 0.8, hy + headH * 0.05, 17 * u, "#ffd166");
  if (c.goggles) {
    ctx.fillStyle = "#26303d";
    ctx.fillRect(cx - headW * 1.06, hy - headH * 0.3, headW * 2.12, headH * 0.16);
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#26303d";
      ctx.beginPath();
      ctx.ellipse(cx + s * headW * 0.42, hy - headH * 0.22, headW * 0.34, headH * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7fd0ff";
      ctx.beginPath();
      ctx.ellipse(cx + s * headW * 0.42, hy - headH * 0.22, headW * 0.25, headH * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (c.mark === "moon") mark(ctx, "moon", cx, hy + headH * 0.42, 9 * u, c.eye);
}

/** Draws one full card (background, character, name, title, mark) into ctx at CARD_W x CARD_H. */
export function drawBuiltinCard(ctx, card) {
  const id = card.art.replace("builtin:", "");
  const c = CAST[id] ?? CAST.rei;
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, card.colors[0]);
  g.addColorStop(1, card.colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = 26;
  for (let i = -3; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 110, CARD_H);
    ctx.lineTo(i * 110 + 260, 0);
    ctx.stroke();
  }
  ctx.save();
  ctx.globalAlpha = 0.16;
  mark(ctx, c.mark, CARD_W * 0.78, CARD_H * 0.42, 150, "#fff");
  ctx.restore();
  drawCharacter(ctx, id, CARD_W * 0.34, CARD_H * 0.86, 1.3);
  drawLabels(ctx, card, c.mark);
}

export function drawLabels(ctx, card, markKind) {
  const shade = ctx.createLinearGradient(0, CARD_H * 0.55, 0, CARD_H);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, CARD_H * 0.55, CARD_W, CARD_H * 0.45);
  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.font = '800 64px "Avenir Next", "Segoe UI", system-ui, sans-serif';
  ctx.fillText(card.name.toUpperCase(), CARD_W - 34, CARD_H - 70);
  ctx.font = '500 24px "Avenir Next", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText(card.title, CARD_W - 36, CARD_H - 34);
  if (markKind) mark(ctx, markKind, CARD_W - 60, 58, 24, "rgba(255,255,255,.9)");
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, CARD_W - 6, CARD_H - 6);
}

/** Builds one canvas per card. Image cards are loaded from the pack folder and cropped to fill. */
export async function buildCards(pack, baseUrl) {
  return Promise.all(pack.cards.map(async (card) => {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (card.art.startsWith("builtin:")) {
      drawBuiltinCard(ctx, card);
      return canvas;
    }
    try {
      const img = new Image();
      img.src = `${baseUrl}${card.art}`;
      await img.decode();
      const scale = Math.max(CARD_W / img.width, CARD_H / img.height);
      ctx.drawImage(img, (CARD_W - img.width * scale) / 2, (CARD_H - img.height * scale) / 2, img.width * scale, img.height * scale);
    } catch {
      ctx.fillStyle = "#2a2f3c";
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.fillStyle = "#fff";
      ctx.font = "24px system-ui, sans-serif";
      ctx.fillText(`Could not load ${card.art}`, 30, 60);
    }
    drawLabels(ctx, card, null);
    return canvas;
  }));
}

// Puts the picture together on a 2D canvas: world, the cut-out person with a rim of light,
// the hologram card in three layers, and the energy ring when a sign lands.
import { drawWarped } from "./warp.js";
import { drawWorld } from "./worlds.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** The quad grown or shrunk about its centre, squeezed vertically by `open` (0..1), and shifted. */
export function shapeQuad(quad, scale, open = 1, shift = { x: 0, y: 0 }) {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  return quad.map((p) => ({ x: cx + (p.x - cx) * scale + shift.x, y: cy + (p.y - cy) * scale * open + shift.y }));
}

/** How far the frame is turned, from its shape: used to slide the layers against each other. */
export function parallax(quad, strength = 0.03) {
  const left = dist(quad[0], quad[3]);
  const right = dist(quad[1], quad[2]);
  const top = dist(quad[0], quad[1]);
  const bottom = dist(quad[3], quad[2]);
  const x = ((right - left) / Math.max(1e-6, right + left)) * strength;
  const y = ((bottom - top) / Math.max(1e-6, bottom + top)) * strength;
  return { x, y };
}

export function createCompositor(canvas) {
  const ctx = canvas.getContext("2d");
  const person = document.createElement("canvas");
  const pctx = person.getContext("2d");
  const fx = document.createElement("canvas");
  fx.width = 64;
  fx.height = 40;
  const fctx = fx.getContext("2d");

  function drawSource(target, source, w, h) {
    if (source.mirrored) {
      target.save();
      target.translate(w, 0);
      target.scale(-1, 1);
      target.drawImage(source.image, 0, 0, w, h);
      target.restore();
    } else {
      target.drawImage(source.image, 0, 0, w, h);
    }
  }

  function drawCard(card, w, h, time) {
    const open = Math.min(1, card.alpha * 1.4);
    const flicker = card.alpha < 0.95 ? 0.75 + 0.25 * Math.sin(time * 90) : 0.96 + 0.04 * Math.sin(time * 23);
    const slide = parallax(card.quad);
    const base = shapeQuad(card.quad, 1, open);
    const px = (p) => [p.x * w, p.y * h];

    ctx.save();
    ctx.globalAlpha = card.alpha * flicker * 0.94;
    drawWarped(ctx, card.layers.back, base, w, h, 6);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // a band of light sweeping down the panel
    fctx.clearRect(0, 0, fx.width, fx.height);
    const y = ((time * 0.45) % 1.4 - 0.2) * fx.height;
    const band = fctx.createLinearGradient(0, y - 8, 0, y + 8);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, "rgba(255,255,255,.35)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    fctx.fillStyle = band;
    fctx.fillRect(0, 0, fx.width, fx.height);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = card.alpha;
    drawWarped(ctx, fx, base, w, h, 4);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // the frame's edge, glowing
    ctx.save();
    ctx.globalAlpha = card.alpha;
    ctx.strokeStyle = "#fff";
    ctx.shadowColor = card.layers.accent;
    ctx.shadowBlur = h * 0.035;
    ctx.lineWidth = h * 0.006;
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      base.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // the figure and the read-outs float in front of the panel and slide as it turns
    if (card.layers.figure) {
      ctx.save();
      ctx.globalAlpha = card.alpha * flicker;
      drawWarped(ctx, card.layers.figure, shapeQuad(card.quad, 1.05, open, { x: slide.x, y: slide.y - 0.006 }), w, h, 6);
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = card.alpha * flicker;
    drawWarped(ctx, card.layers.hud, shapeQuad(card.quad, 1.12, open, { x: slide.x * 2.2, y: slide.y * 2.2 - 0.012 }), w, h, 6);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return {
    /**
     * source: {image, mask, width, height, mirrored}. world: {id, amount 0..1, accent} or null.
     * card: {layers, quad, alpha} or null. burst: {x, y, age 0..1, color} or null. time: seconds.
     */
    draw({ source, world, card, burst, time }) {
      const w = source.width;
      const h = source.height;
      for (const c of [canvas, person]) {
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
      }
      drawSource(ctx, source, w, h);
      const hasMask = Boolean(source.mask && source.mask.width > 1);
      if (world && world.amount > 0 && !hasMask) {
        // No cut-out available: tint the room with the world instead of hiding the person.
        ctx.save();
        ctx.globalAlpha = world.amount * 0.6;
        drawWorld(ctx, world.id, w, h, time);
        ctx.restore();
      }
      if (world && world.amount > 0 && hasMask) {
        // The person: the camera picture, kept only where the mask says "person".
        pctx.globalCompositeOperation = "source-over";
        pctx.clearRect(0, 0, w, h);
        drawSource(pctx, source, w, h);
        pctx.globalCompositeOperation = "destination-in";
        pctx.imageSmoothingEnabled = true;
        drawSource(pctx, { image: source.mask, mirrored: source.mirrored }, w, h);
        pctx.globalCompositeOperation = "source-over";

        ctx.save();
        ctx.globalAlpha = world.amount;
        drawWorld(ctx, world.id, w, h, time);
        ctx.restore();
        ctx.save();
        ctx.shadowColor = world.accent; // a rim of the world's light around the person
        ctx.shadowBlur = h * 0.035 * world.amount;
        ctx.drawImage(person, 0, 0);
        ctx.restore();
      }
      if (card && card.alpha > 0) drawCard(card, w, h, time);
      if (burst && burst.age < 1) {
        const k = 1 - (1 - burst.age) ** 3;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = burst.color;
        ctx.shadowColor = burst.color;
        ctx.shadowBlur = h * 0.06;
        for (let ring = 0; ring < 3; ring++) {
          const r = Math.max(0, k - ring * 0.12) * Math.hypot(w, h) * 0.7;
          ctx.globalAlpha = (1 - burst.age) * (1 - ring * 0.25);
          ctx.lineWidth = h * 0.02 * (1 - burst.age) + 1;
          ctx.beginPath();
          ctx.arc(burst.x * w, burst.y * h, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = Math.max(0, 0.5 - burst.age * 1.6);
        ctx.fillStyle = burst.color;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    },
  };
}

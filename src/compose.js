// Puts the picture together on a 2D canvas: world, then the cut-out person, then the character card.
import { drawWarped } from "./warp.js";
import { drawWorld } from "./worlds.js";

export function createCompositor(canvas) {
  const ctx = canvas.getContext("2d");
  const person = document.createElement("canvas");
  const pctx = person.getContext("2d");

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

  return {
    /**
     * source: {image, mask, width, height, mirrored}. world: {id, amount 0..1} or null.
     * card: {canvas, quad, alpha} or null. flash: 0..1 white. time: seconds.
     */
    draw({ source, world, card, flash, time }) {
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
        ctx.drawImage(person, 0, 0);
      }
      if (card && card.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = card.alpha;
        drawWarped(ctx, card.canvas, card.quad, w, h);
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flash)})`;
        ctx.fillRect(0, 0, w, h);
      }
    },
  };
}

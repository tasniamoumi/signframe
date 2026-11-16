// Draws the frame outline and the hand skeletons on a 2D canvas above the WebGL image.

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export function drawOverlay(canvas, { width, height, hands, quad, showHands }) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  const px = (p) => [p.x * width, p.y * height];
  const unit = Math.max(width, height) / 960;

  if (showHands) {
    ctx.lineWidth = 2 * unit;
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.fillStyle = "#ffd166";
    for (const hand of hands) {
      ctx.beginPath();
      for (const [a, b] of BONES) {
        ctx.moveTo(...px(hand[a]));
        ctx.lineTo(...px(hand[b]));
      }
      ctx.stroke();
      for (const p of hand) {
        ctx.beginPath();
        ctx.arc(...px(p), 3 * unit, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (quad) {
    ctx.lineWidth = 3 * unit;
    ctx.strokeStyle = "#ffffff";
    ctx.lineJoin = "round";
    ctx.beginPath();
    quad.forEach((p, i) => (i ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const p of quad) {
      ctx.beginPath();
      ctx.arc(...px(p), 6 * unit, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

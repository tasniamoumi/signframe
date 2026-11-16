// Draws the tracked hand points as thin lines of light, above the picture.

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export function drawOverlay(canvas, { width, height, hands, showHands, color = "#ffffff" }) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  if (!showHands) return;
  const px = (p) => [p.x * width, p.y * height];
  const unit = Math.max(width, height) / 960;
  ctx.save();
  ctx.lineWidth = 1.6 * unit;
  ctx.strokeStyle = color;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 * unit;
  ctx.globalAlpha = 0.9;
  for (const hand of hands) {
    ctx.beginPath();
    for (const [a, b] of BONES) {
      ctx.moveTo(...px(hand[a]));
      ctx.lineTo(...px(hand[b]));
    }
    ctx.stroke();
    for (const i of [4, 8, 12, 16, 20]) {
      ctx.beginPath();
      ctx.arc(...px(hand[i]), 3.2 * unit, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

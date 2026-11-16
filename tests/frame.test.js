import { describe, expect, it } from "vitest";
import {
  OneEuro,
  QuadSmoother,
  applyHomography,
  cornersFromHands,
  invert3,
  isValidQuad,
  pointInQuad,
  polygonArea,
  squareToQuad,
  toColumnMajor,
} from "../src/frame.js";

const blankHand = () => Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
const hand = (thumb, index) => {
  const h = blankHand();
  h[4] = thumb;
  h[8] = index;
  return h;
};

describe("cornersFromHands", () => {
  const leftHand = hand({ x: 0.2, y: 0.7 }, { x: 0.25, y: 0.3 });
  const rightHand = hand({ x: 0.8, y: 0.65 }, { x: 0.75, y: 0.35 });

  it("needs two hands", () => {
    expect(cornersFromHands([leftHand])).toBeNull();
    expect(cornersFromHands([])).toBeNull();
  });

  it("orders corners top-left, top-right, bottom-right, bottom-left", () => {
    expect(cornersFromHands([leftHand, rightHand])).toEqual([
      { x: 0.25, y: 0.3 },
      { x: 0.75, y: 0.35 },
      { x: 0.8, y: 0.65 },
      { x: 0.2, y: 0.7 },
    ]);
  });

  it("does not depend on the order hands are reported", () => {
    expect(cornersFromHands([rightHand, leftHand])).toEqual(cornersFromHands([leftHand, rightHand]));
  });

  it("uses screen position, so a hand turned upside down still gives a sensible frame", () => {
    const flipped = hand({ x: 0.25, y: 0.3 }, { x: 0.2, y: 0.7 });
    expect(cornersFromHands([flipped, rightHand])[0]).toEqual({ x: 0.25, y: 0.3 });
  });
});

describe("quad checks", () => {
  const square = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];

  it("accepts a convex quad and measures its area", () => {
    expect(isValidQuad(square)).toBe(true);
    expect(Math.abs(polygonArea(square))).toBeCloseTo(0.36);
  });

  it("rejects a twisted quad", () => {
    const bowtie = [square[0], square[2], square[1], square[3]];
    expect(isValidQuad(bowtie)).toBe(false);
  });

  it("rejects a quad that is too small or flat", () => {
    const tiny = square.map((p) => ({ x: p.x * 0.05, y: p.y * 0.05 }));
    expect(isValidQuad(tiny)).toBe(false);
    const flat = square.map((p) => ({ x: p.x, y: 0.5 }));
    expect(isValidQuad(flat)).toBe(false);
  });

  it("tests whether a point is inside", () => {
    expect(pointInQuad({ x: 0.5, y: 0.5 }, square)).toBe(true);
    expect(pointInQuad({ x: 0.1, y: 0.5 }, square)).toBe(false);
    expect(pointInQuad({ x: 0.5, y: 0.9 }, square)).toBe(false);
  });
});

describe("homography", () => {
  const trapezoid = [
    { x: 0.1, y: 0.2 },
    { x: 0.9, y: 0.3 },
    { x: 0.75, y: 0.8 },
    { x: 0.2, y: 0.7 },
  ];
  const unit = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it("maps the unit square corners onto the quad", () => {
    const m = squareToQuad(trapezoid);
    unit.forEach((c, i) => {
      const p = applyHomography(m, c);
      expect(p.x).toBeCloseTo(trapezoid[i].x, 9);
      expect(p.y).toBeCloseTo(trapezoid[i].y, 9);
    });
  });

  it("handles a parallelogram (affine case)", () => {
    const para = [
      { x: 0.1, y: 0.1 },
      { x: 0.6, y: 0.2 },
      { x: 0.7, y: 0.7 },
      { x: 0.2, y: 0.6 },
    ];
    const m = squareToQuad(para);
    const p = applyHomography(m, { x: 1, y: 1 });
    expect(p.x).toBeCloseTo(0.7, 9);
    expect(p.y).toBeCloseTo(0.7, 9);
  });

  it("inverts: quad corners map back to the unit square", () => {
    const inv = invert3(squareToQuad(trapezoid));
    trapezoid.forEach((c, i) => {
      const p = applyHomography(inv, c);
      expect(p.x).toBeCloseTo(unit[i].x, 9);
      expect(p.y).toBeCloseTo(unit[i].y, 9);
    });
  });

  it("maps the quad centre to a point inside the unit square", () => {
    const inv = invert3(squareToQuad(trapezoid));
    const p = applyHomography(inv, { x: 0.49, y: 0.5 });
    expect(p.x).toBeGreaterThan(0.2);
    expect(p.x).toBeLessThan(0.8);
    expect(p.y).toBeGreaterThan(0.2);
    expect(p.y).toBeLessThan(0.8);
  });

  it("returns null for a matrix that cannot be inverted", () => {
    expect(invert3([[1, 2, 3], [2, 4, 6], [1, 1, 1]])).toBeNull();
  });

  it("flattens column-major for WebGL", () => {
    const arr = toColumnMajor([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(Array.from(arr)).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
  });
});

describe("OneEuro smoothing", () => {
  it("passes the first value through and holds a constant", () => {
    const f = new OneEuro();
    expect(f.filter(0.4, 0)).toBe(0.4);
    for (let t = 16; t < 500; t += 16) expect(f.filter(0.4, t)).toBeCloseTo(0.4, 9);
  });

  it("reduces jitter around a still point", () => {
    const f = new OneEuro();
    let rawSpread = 0;
    let smoothSpread = 0;
    f.filter(0.5, 0);
    for (let i = 1; i < 200; i++) {
      const noisy = 0.5 + (i % 2 ? 0.004 : -0.004);
      const out = f.filter(noisy, i * 16);
      rawSpread += Math.abs(noisy - 0.5);
      smoothSpread += Math.abs(out - 0.5);
    }
    expect(smoothSpread).toBeLessThan(rawSpread * 0.5);
  });

  it("follows quickly when the point really moves", () => {
    const f = new OneEuro();
    f.filter(0, 0);
    let out = 0;
    for (let i = 1; i <= 10; i++) out = f.filter(i * 0.05, i * 16); // moves 0.5 in 160 ms
    expect(out).toBeGreaterThan(0.3);
  });

  it("QuadSmoother keeps four corners and can reset", () => {
    const s = new QuadSmoother();
    const q = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    expect(s.update(q, 0)).toEqual(q);
    s.reset();
    const moved = q.map((p) => ({ x: p.x + 0.3, y: p.y }));
    expect(s.update(moved, 1000)).toEqual(moved);
  });
});

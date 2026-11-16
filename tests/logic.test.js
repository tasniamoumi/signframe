import { describe, expect, it } from "vitest";
import { CardCycler, parsePack } from "../src/cards.js";
import { NONE, SignClassifier, SignDetector, holdOutAccuracy } from "../src/classifier.js";
import { FEATURE_COUNT, distance, signFeatures } from "../src/features.js";
import { meshPoints, triangleTransform } from "../src/warp.js";

// A simple synthetic hand: wrist, then points fanned out. "spread" changes the pose.
const hand = (cx, cy, size, spread = 1, flip = 1) =>
  Array.from({ length: 21 }, (_, i) => {
    if (i === 0) return { x: cx, y: cy };
    const finger = Math.floor((i - 1) / 4);
    const joint = ((i - 1) % 4) + 1;
    const angle = (-0.6 + finger * 0.3) * spread;
    return { x: cx + flip * Math.sin(angle) * joint * size * 0.3, y: cy - Math.cos(angle) * joint * size * 0.3 };
  });
const pose = (spread, dx = 0, dy = 0, scale = 1) => [
  hand(0.3 * scale + dx, 0.7 * scale + dy, 0.2 * scale, spread, 1),
  hand(0.7 * scale + dx, 0.7 * scale + dy, 0.2 * scale, spread, -1),
];

describe("signFeatures", () => {
  it("needs exactly two hands", () => {
    expect(signFeatures([], 1)).toBeNull();
    expect(signFeatures([hand(0.5, 0.5, 0.2)], 1)).toBeNull();
    expect(signFeatures(pose(1), 1)).toHaveLength(FEATURE_COUNT);
  });

  it("does not change when the sign moves or is nearer the camera", () => {
    const base = signFeatures(pose(1), 1);
    expect(distance(base, signFeatures(pose(1, 0.1, -0.2), 1))).toBeLessThan(1e-9);
    expect(distance(base, signFeatures(pose(1, 0, 0, 0.6), 1))).toBeLessThan(1e-9);
  });

  it("does not depend on which hand is listed first", () => {
    const [a, b] = pose(1);
    expect(signFeatures([b, a], 1)).toEqual(signFeatures([a, b], 1));
  });

  it("changes when the pose changes", () => {
    expect(distance(signFeatures(pose(1), 1), signFeatures(pose(0.2), 1))).toBeGreaterThan(1);
  });

  it("returns null for a collapsed hand", () => {
    const flat = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
    expect(signFeatures([flat, hand(0.7, 0.7, 0.2)], 1)).toBeNull();
  });
});

const jitter = (features, amount, seed) => features.map((v, i) => v + Math.sin(seed * 12.9898 + i * 78.233) * amount);
const makeSamples = (label, spread, n = 20) =>
  Array.from({ length: n }, (_, i) => ({ label, features: jitter(signFeatures(pose(spread), 1), 0.03, i + spread * 100) }));

describe("SignClassifier", () => {
  const samples = [...makeSamples("flame", 1), ...makeSamples("storm", 0.2), ...makeSamples(NONE, 1.8)];
  const model = new SignClassifier(samples);

  it("recognises taught signs", () => {
    expect(model.labels.sort()).toEqual(["flame", "storm"]);
    expect(model.predict(signFeatures(pose(1.02), 1)).label).toBe("flame");
    expect(model.predict(signFeatures(pose(0.22), 1)).label).toBe("storm");
  });

  it("answers none for the taught rest pose, for something unlike anything taught, and for no hands", () => {
    expect(model.predict(signFeatures(pose(1.8), 1)).label).toBe(NONE);
    expect(model.predict(signFeatures(pose(-2.5), 1)).label).toBe(NONE);
    expect(model.predict(null).label).toBe(NONE);
  });

  it("is not ready until a sign is taught", () => {
    expect(new SignClassifier([]).ready).toBe(false);
    expect(new SignClassifier(makeSamples(NONE, 1)).ready).toBe(false);
    expect(new SignClassifier([]).predict(signFeatures(pose(1), 1)).label).toBe(NONE);
  });

  it("scores itself on held-out samples", () => {
    const score = holdOutAccuracy(samples);
    expect(score.tested).toBe(12);
    expect(score.accuracy).toBe(1);
  });
});

describe("SignDetector", () => {
  const yes = (label) => ({ label, confidence: 1 });
  const no = { label: NONE, confidence: 0 };

  it("fires once after the sign is held, not on every frame", () => {
    const d = new SignDetector({ holdMs: 400, cooldownMs: 0 });
    expect(d.update(yes("flame"), 0)).toBeNull();
    expect(d.update(yes("flame"), 200)).toBeNull();
    expect(d.progress(200)).toBeCloseTo(0.5);
    expect(d.update(yes("flame"), 450)).toBe("flame");
    expect(d.update(yes("flame"), 900)).toBeNull();
  });

  it("needs a release before the same sign fires again", () => {
    const d = new SignDetector({ holdMs: 100, cooldownMs: 0 });
    d.update(yes("flame"), 0);
    expect(d.update(yes("flame"), 150)).toBe("flame");
    d.update(no, 200);
    d.update(yes("flame"), 300);
    expect(d.update(yes("flame"), 450)).toBe("flame");
  });

  it("ignores a flicker and low-confidence guesses", () => {
    const d = new SignDetector({ holdMs: 300, cooldownMs: 0 });
    d.update(yes("flame"), 0);
    d.update(no, 100); // flicker resets the hold
    d.update(yes("flame"), 150);
    expect(d.update(yes("flame"), 350)).toBeNull();
    expect(d.update({ label: "storm", confidence: 0.4 }, 400)).toBeNull();
  });

  it("respects the cooldown between two different signs", () => {
    const d = new SignDetector({ holdMs: 100, cooldownMs: 1000 });
    d.update(yes("flame"), 0);
    expect(d.update(yes("flame"), 150)).toBe("flame");
    d.update(yes("storm"), 200);
    expect(d.update(yes("storm"), 400)).toBeNull();
    expect(d.update(yes("storm"), 1200)).toBe("storm");
  });
});

describe("CardCycler", () => {
  it("shows the first card, keeps it while the frame is held, and advances when the frame is re-made", () => {
    const c = new CardCycler(3, { reopenMs: 300, appearMs: 0 });
    expect(c.update(false, 0)).toBeNull();
    expect(c.update(true, 100)).toBe(0);
    expect(c.update(true, 900)).toBe(0);
    expect(c.update(false, 1000)).toBeNull();
    expect(c.update(true, 1400)).toBe(1);
    c.update(false, 2000);
    expect(c.update(true, 2400)).toBe(2);
    c.update(false, 3000);
    expect(c.update(true, 3400)).toBe(0); // loops
  });

  it("does not advance on a brief tracking drop-out", () => {
    const c = new CardCycler(3, { reopenMs: 300, appearMs: 0 });
    c.update(true, 0);
    c.update(false, 100);
    expect(c.update(true, 200)).toBe(0);
  });

  it("waits for the frame to be held before showing a card", () => {
    const c = new CardCycler(3, { appearMs: 200 });
    expect(c.update(true, 0)).toBeNull();
    expect(c.update(true, 100)).toBeNull();
    expect(c.update(false, 150)).toBeNull();   // a passing shape, never shown
    expect(c.update(true, 1000)).toBeNull();
    expect(c.update(true, 1250)).toBe(0);      // first real frame is still the first card
  });

  it("starts again from the first card after a reset", () => {
    const c = new CardCycler(3, { appearMs: 0 });
    c.update(true, 0);
    c.update(false, 100);
    c.update(true, 1000);
    c.reset();
    expect(c.update(true, 2000)).toBe(0);
  });
});

describe("parsePack", () => {
  it("accepts built-in art and image files, and fills defaults", () => {
    const pack = parsePack({ name: "Mine", cards: [{ name: "Rei", title: "Archer", art: "builtin:rei" }, { name: "Photo", art: "me.png", colors: ["#000", "#fff"] }] });
    expect(pack.cards).toHaveLength(2);
    expect(pack.cards[0].colors).toHaveLength(2);
    expect(pack.cards[1]).toMatchObject({ art: "me.png", colors: ["#000", "#fff"], title: "" });
  });

  it("rejects bad packs with a message that says what to fix", () => {
    expect(() => parsePack({ cards: [] })).toThrow(/non-empty/);
    expect(() => parsePack({ cards: [{ art: "a.png" }] })).toThrow(/needs a name/);
    expect(() => parsePack({ cards: [{ name: "X", art: "https://example.com/a.png" }] })).toThrow(/pack folder/);
    expect(() => parsePack({ cards: [{ name: "X", art: "../secret.png" }] })).toThrow(/inside the pack folder/);
    expect(() => parsePack({ cards: [{ name: "X", art: "a.exe" }] })).toThrow(/art/);
  });
});

describe("warp", () => {
  const quad = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.7, y: 0.8 }, { x: 0.25, y: 0.7 }];

  it("puts the mesh corners on the quad corners", () => {
    const pts = meshPoints(quad, 1000, 500, 4);
    expect(pts).toHaveLength(25);
    expect(pts[0]).toEqual({ x: 200, y: 100 });
    expect(pts[4].x).toBeCloseTo(800);
    expect(pts[24].y).toBeCloseTo(400);
    expect(pts[20].x).toBeCloseTo(250);
  });

  it("maps a source triangle exactly onto its destination", () => {
    const s = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }];
    const d = [{ x: 10, y: 20 }, { x: 60, y: 30 }, { x: 5, y: 70 }];
    const [a, b, c, dd, e, f] = triangleTransform(...s, ...d);
    s.forEach((p, i) => {
      expect(a * p.x + c * p.y + e).toBeCloseTo(d[i].x);
      expect(b * p.x + dd * p.y + f).toBeCloseTo(d[i].y);
    });
    expect(triangleTransform(s[0], s[0], s[0], ...d)).toBeNull();
  });
});

// A k-nearest-neighbour classifier over sign features, plus the logic that turns a stream of
// per-frame guesses into one event per sign.
import { distance } from "./features.js";

export const NONE = "none";

export class SignClassifier {
  /** samples: [{label, features}], k: neighbours that vote, maxDistance: further than this is "none". */
  constructor(samples = [], { k = 5, maxDistance = 2.2 } = {}) {
    this.samples = samples.filter((s) => Array.isArray(s.features));
    this.k = k;
    this.maxDistance = maxDistance;
  }

  get labels() {
    return [...new Set(this.samples.map((s) => s.label))].filter((l) => l !== NONE);
  }

  /** True when there is at least one sign to recognise. */
  get ready() {
    return this.labels.length > 0;
  }

  /** Returns {label, confidence, distance}. label is "none" when nothing is close enough. */
  predict(features) {
    if (!features || !this.ready) return { label: NONE, confidence: 0, distance: Infinity };
    const nearest = this.samples
      .map((s) => ({ label: s.label, d: distance(features, s.features) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.k);
    const votes = new Map();
    for (const n of nearest) votes.set(n.label, (votes.get(n.label) ?? 0) + 1);
    const [label, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    const closest = nearest.find((n) => n.label === label).d;
    if (label === NONE || closest > this.maxDistance) return { label: NONE, confidence: 0, distance: closest };
    return { label, confidence: count / nearest.length, distance: closest };
  }
}

/**
 * Fires a sign once, after it has been held steadily. A sign must be released (or changed)
 * before it can fire again, and there is a short cooldown between any two events.
 */
export class SignDetector {
  constructor({ holdMs = 450, minConfidence = 0.8, cooldownMs = 1200 } = {}) {
    Object.assign(this, { holdMs, minConfidence, cooldownMs });
    this.candidate = NONE;
    this.since = 0;
    this.fired = NONE;
    this.lastEventAt = -Infinity;
  }

  /** prediction: from SignClassifier.predict. Returns the sign's label when it fires, else null. */
  update(prediction, nowMs) {
    const label = prediction.confidence >= this.minConfidence ? prediction.label : NONE;
    if (label !== this.candidate) {
      this.candidate = label;
      this.since = nowMs;
      if (label === NONE) this.fired = NONE; // released: the same sign may fire again later
      return null;
    }
    if (label === NONE || label === this.fired) return null;
    if (nowMs - this.since < this.holdMs || nowMs - this.lastEventAt < this.cooldownMs) return null;
    this.fired = label;
    this.lastEventAt = nowMs;
    return label;
  }

  /** 0..1: how far through the hold the current sign is (for a progress ring). */
  progress(nowMs) {
    if (this.candidate === NONE || this.candidate === this.fired) return 0;
    return Math.min(1, (nowMs - this.since) / this.holdMs);
  }
}

/** Splits samples into train and test parts per label (every nth sample is held out) and scores them. */
export function holdOutAccuracy(samples, { every = 5, k = 5, maxDistance = 2.2 } = {}) {
  const counts = new Map();
  const train = [];
  const test = [];
  for (const s of samples) {
    const n = counts.get(s.label) ?? 0;
    counts.set(s.label, n + 1);
    (n % every === every - 1 ? test : train).push(s);
  }
  const model = new SignClassifier(train, { k, maxDistance });
  const correct = test.filter((s) => model.predict(s.features).label === s.label).length;
  return { tested: test.length, correct, accuracy: test.length ? correct / test.length : 0 };
}

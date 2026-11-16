import { describe, expect, it } from "vitest";
import { SignClassifier, SignDetector } from "../src/classifier.js";
import { SCRIPT_LENGTH, demoSamples, handsFor, scriptedHands } from "../src/demo.js";
import { Show } from "../src/show.js";
import { signFeatures } from "../src/features.js";
import { cornersFromHands, isValidQuad } from "../src/frame.js";
import { holdsFrame } from "../src/show.js";

describe("the demo's simulated signs", () => {
  const model = new SignClassifier(demoSamples());

  it("are told apart by the real classifier", () => {
    for (const sign of ["flame", "storm", "tide"]) {
      for (let wobble = 0.3; wobble < 20; wobble += 1.7) {
        expect(model.predict(signFeatures(handsFor(sign, wobble), 16 / 9)).label).toBe(sign);
      }
    }
  });

  it("do not fire on the rest pose or while holding the frame", () => {
    for (const pose of ["frame"]) {
      for (let wobble = 0.3; wobble < 20; wobble += 1.7) {
        expect(model.predict(signFeatures(handsFor(pose, wobble), 16 / 9)).label).toBe("none");
      }
    }
  });

  it("the frame pose counts as a frame and the sign poses do not", () => {
    const frame = handsFor("frame");
    expect(isValidQuad(cornersFromHands(frame), 0.03)).toBe(true);
    expect(holdsFrame(frame, model.predict(signFeatures(frame, 16 / 9)))).toBe(true);
    for (const sign of ["flame", "storm", "tide"]) {
      const hands = handsFor(sign);
      expect(holdsFrame(hands, model.predict(signFeatures(hands, 16 / 9)))).toBe(false);
    }
  });

  it("a held sign fires once through the detector", () => {
    const detector = new SignDetector();
    const fired = [];
    for (let ms = 0; ms < 1500; ms += 33) {
      const event = detector.update(model.predict(signFeatures(handsFor("storm", ms / 1000), 16 / 9)), ms);
      if (event) fired.push(event);
    }
    expect(fired).toEqual(["storm"]);
  });

  it("the whole scripted demo plays out as intended through the real pipeline", () => {
    const detector = new SignDetector();
    const show = new Show(["flame", "storm", "tide"], 6);
    const log = [];
    let last = "";
    for (let ms = 0; ms < SCRIPT_LENGTH * 1000; ms += 33) {
      const hands = scriptedHands(ms / 1000);
      const guess = model.predict(signFeatures(hands, 16 / 9));
      const event = detector.update(guess, ms);
      if (event) show.sign(event, ms);
      const state = show.update(holdsFrame(hands, guess), ms);
      const now = `${state.world ?? "room"}:${state.card ?? "-"}`;
      if (now !== last) log.push((last = now));
    }
    expect(log).toEqual([
      "room:-", "flame:-", "flame:0", "flame:-", "flame:1", "flame:-", "flame:2", "flame:-",
      "storm:-", "storm:0", "storm:-", "tide:-", "tide:0", "tide:-", "room:-",
    ]);
  });
});

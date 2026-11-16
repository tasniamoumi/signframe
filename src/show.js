// The state of the show: which world is on, and which character card the frame holds.
import { CardCycler } from "./cards.js";
import { NONE } from "./classifier.js";
import { cornersFromHands, isValidQuad } from "./frame.js";

export const MIN_FRAME_AREA = 0.03; // share of the picture; smaller shapes are hands held together

/** True when the hands hold a frame: a big enough four-cornered shape that is not a sign. */
export function holdsFrame(hands, guess) {
  if (guess && guess.label !== NONE) return false;
  const corners = cornersFromHands(hands);
  return Boolean(corners && isValidQuad(corners, MIN_FRAME_AREA));
}

export class Show {
  constructor(worldIds, cardCount) {
    this.worldIds = worldIds;
    this.cards = new CardCycler(cardCount);
    this.world = null;       // null = the real room
    this.changedAt = -Infinity;
  }

  reset() {
    this.world = null;
    this.changedAt = -Infinity;
    this.cards.reset();
  }

  /** A recognised sign switches to its world. Making the current world's sign again returns to the room. */
  sign(label, nowMs) {
    if (!this.worldIds.includes(label)) return false;
    this.world = this.world === label ? null : label;
    this.changedAt = nowMs;
    this.cards.reset();
    return true;
  }

  /** Call every frame. Returns {world, card}: card is an index, or null when no card should show. */
  update(hasFrame, nowMs) {
    const card = this.world ? this.cards.update(hasFrame, nowMs) : null;
    return { world: this.world, card };
  }
}

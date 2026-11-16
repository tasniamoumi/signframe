// Which character card the frame shows. The card changes each time the frame is closed and re-made.

export class CardCycler {
  /**
   * count: number of cards. reopenMs: how long the frame must be gone before re-making it advances.
   * appearMs: how long a frame must be held before its card shows, so hands passing through a
   * frame-like shape do not flash a card.
   */
  constructor(count, { reopenMs = 350, appearMs = 180 } = {}) {
    this.count = count;
    this.reopenMs = reopenMs;
    this.appearMs = appearMs;
    this.reset();
  }

  reset() {
    this.index = 0;
    this.visible = false;
    this.goneSince = null;
    this.heldSince = null;
    this.started = false;
  }

  /** hasFrame: is a valid frame held right now? Returns the card index to show, or null. */
  update(hasFrame, nowMs) {
    if (!hasFrame) {
      this.heldSince = null;
      if (this.visible) {
        this.visible = false;
        this.goneSince = nowMs;
      }
      return null;
    }
    if (!this.visible) {
      this.heldSince ??= nowMs;
      if (nowMs - this.heldSince < this.appearMs) return null;
      const reopened = this.started && this.goneSince !== null && this.heldSince - this.goneSince >= this.reopenMs;
      if (reopened) this.index = (this.index + 1) % this.count;
      this.visible = true;
      this.started = true;
      this.goneSince = null;
    }
    return this.index;
  }
}

/**
 * Checks a pack description (public/pack/pack.json) and fills in defaults.
 * A card is either drawn by the app ("art": "builtin:<id>") or an image file in the pack folder.
 */
export function parsePack(json) {
  if (!json || !Array.isArray(json.cards) || json.cards.length === 0) throw new Error("A pack needs a non-empty \"cards\" list");
  const cards = json.cards.map((card, i) => {
    if (!card || typeof card.name !== "string" || !card.name.trim()) throw new Error(`Card ${i + 1} needs a name`);
    const art = typeof card.art === "string" ? card.art : "";
    if (!art.startsWith("builtin:") && !/^[\w./-]+\.(png|jpe?g|webp|svg)$/i.test(art)) {
      throw new Error(`Card "${card.name}" needs "art": a file in the pack folder (png, jpg, webp or svg) or "builtin:<id>"`);
    }
    if (art.includes("..")) throw new Error(`Card "${card.name}": art must stay inside the pack folder`);
    return {
      name: card.name.trim().slice(0, 24),
      title: typeof card.title === "string" ? card.title.slice(0, 40) : "",
      art,
      colors: Array.isArray(card.colors) && card.colors.length >= 2 ? card.colors.slice(0, 2).map(String) : ["#1c1647", "#6b4fd1"],
    };
  });
  return { name: typeof json.name === "string" ? json.name : "Untitled pack", cards };
}

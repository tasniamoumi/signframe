import { buildCards } from "./art.js";
import { parsePack } from "./cards.js";
import { NONE, SignClassifier, SignDetector, holdOutAccuracy } from "./classifier.js";
import { createCompositor } from "./compose.js";
import { createDemoSource, demoSamples } from "./demo.js";
import { signFeatures } from "./features.js";
import { QuadSmoother, cornersFromHands } from "./frame.js";
import { drawOverlay } from "./overlay.js";
import { Show, holdsFrame } from "./show.js";
import { WORLDS } from "./worlds.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const view = $("view");
const overlay = $("overlay");
const video = $("video");
const BASE = import.meta.env.BASE_URL;
const STORE_KEY = "signframe.samples.v1";
const TEACH = [...WORLDS.map((w) => ({ label: w.sign, name: `${w.sign[0].toUpperCase()}${w.sign.slice(1)} (${w.name})`, color: w.accent })),
  { label: NONE, name: "Not a sign", color: "#a3a9b8" }];
const RECORD_MS = 3000;
const MAX_PER_RECORDING = 45;

const state = {
  source: null,
  running: false,
  pack: null,
  cardCanvases: [],
  show: null,
  classifier: new SignClassifier([]),
  detector: new SignDetector(),
  shipped: [],          // samples that ship with the app
  taught: [],           // samples recorded in this browser
  showHands: true,
  swapMask: false,
  quad: null,
  cardAlpha: 0,
  burst: null,          // {x, y, at, color}: the energy ring when a sign lands
  fps: 0,
  lastFrameAt: 0,
  lastScriptTime: 0,
  recording: null,      // {label, startsAt, endsAt, added}
  guess: { label: NONE, confidence: 0 },
};
const smoother = new QuadSmoother();
let compositor = null;

/* ---------- chips ---------- */

function buildChips(container, labels, onPick) {
  container.replaceChildren();
  labels.forEach((label, i) => {
    const chip = el("button", "chip", label);
    chip.type = "button";
    chip.setAttribute("role", "radio");
    chip.addEventListener("click", () => onPick(i));
    container.append(chip);
  });
}
function paintChips(container, current) {
  [...container.children].forEach((chip, i) => {
    chip.setAttribute("aria-checked", String(i === current));
    chip.tabIndex = i === current || (current < 0 && i === 0) ? 0 : -1;
  });
}
function paintControls() {
  if (!state.show) return;
  paintChips($("worlds"), state.show.world ? WORLDS.findIndex((w) => w.id === state.show.world) + 1 : 0);
  paintChips($("cast"), state.show.cards.index);
}
function enterWorld(index, nowMs = performance.now()) { // 0 = room
  if (!state.show) return;
  const target = index === 0 ? null : WORLDS[index - 1].id;
  if (state.show.world === target) return;
  if (target) state.show.sign(target, nowMs);
  else state.show.sign(state.show.world, nowMs);
  startBurst(target, nowMs, null);
  paintControls();
}
function startBurst(worldId, nowMs, hands) {
  const world = WORLDS.find((w) => w.id === worldId);
  const centre = hands && hands.length === 2
    ? { x: (hands[0][9].x + hands[1][9].x) / 2, y: (hands[0][9].y + hands[1][9].y) / 2 }
    : { x: 0.5, y: 0.6 };
  state.burst = { ...centre, at: nowMs, color: world?.accent ?? "#ffffff" };
}
function pickCard(index) {
  if (!state.show) return;
  state.show.cards.index = (index + state.pack.cards.length) % state.pack.cards.length;
  paintControls();
}

/* ---------- samples and the classifier ---------- */

function loadTaught() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((s) => s && typeof s.label === "string" && Array.isArray(s.features)) : [];
  } catch {
    return [];
  }
}
function saveTaught() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.taught));
  } catch {
    /* storage may be blocked; the examples still work until the tab closes */
  }
}
function rebuildClassifier() {
  const samples = state.source?.kind === "demo" ? demoSamples() : [...state.shipped, ...state.taught];
  state.classifier = new SignClassifier(samples);
  state.detector = new SignDetector();
  paintTeach();
}
function paintTeach() {
  const rows = $("teach-rows");
  rows.replaceChildren();
  for (const item of TEACH) {
    const count = state.taught.filter((s) => s.label === item.label).length;
    const tr = el("tr");
    const name = el("td");
    const dot = el("span", "swatch");
    dot.style.background = item.color;
    name.append(dot, document.createTextNode(item.name));
    const record = el("button", "btn", "Record");
    record.type = "button";
    record.disabled = !state.running || state.source.kind !== "camera" || Boolean(state.recording);
    record.addEventListener("click", () => startRecording(item.label));
    const clear = el("button", "btn", "Clear");
    clear.type = "button";
    clear.disabled = count === 0;
    clear.addEventListener("click", () => {
      state.taught = state.taught.filter((s) => s.label !== item.label);
      saveTaught();
      rebuildClassifier();
    });
    const actions = el("td");
    actions.append(record, document.createTextNode(" "), clear);
    tr.append(name, el("td", "n", String(count)), actions);
    rows.append(tr);
  }
  const signs = WORLDS.filter((w) => state.taught.some((s) => s.label === w.sign) || state.shipped.some((s) => s.label === w.sign)).length;
  const status = $("teach-status");
  status.textContent = signs === WORLDS.length ? "· all three signs taught" : `· ${signs} of ${WORLDS.length} signs taught`;
  status.className = `note ${signs === WORLDS.length ? "status-ok" : "status-warn"}`;
  const all = [...state.shipped, ...state.taught];
  const score = all.length >= 40 ? holdOutAccuracy(all) : null;
  $("teach-score").textContent = score && score.tested
    ? `Self-check: ${score.correct} of ${score.tested} held-back examples recognised correctly. Examples from one recording are alike, so real use will be less accurate than this.`
    : "Record at least 40 examples in total to see a self-check score.";
}
function startRecording(label) {
  const now = performance.now();
  state.recording = { label, startsAt: now + 3000, endsAt: now + 3000 + RECORD_MS, added: 0 };
  paintTeach();
}
function recordStep(hands, nowMs, aspect) {
  const rec = state.recording;
  const box = $("count-in");
  if (!rec) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const name = TEACH.find((t) => t.label === rec.label).name;
  if (nowMs < rec.startsAt) {
    box.replaceChildren(document.createTextNode(String(Math.ceil((rec.startsAt - nowMs) / 1000))), el("small", "", `Get ready: ${name}`));
    return;
  }
  if (nowMs < rec.endsAt) {
    const features = signFeatures(hands, aspect);
    if (features && rec.added < MAX_PER_RECORDING) {
      state.taught.push({ label: rec.label, features: features.map((v) => Math.round(v * 1e4) / 1e4) });
      rec.added++;
    }
    box.replaceChildren(document.createTextNode("●"), el("small", "", `Hold it: ${rec.added} examples${hands.length === 2 ? "" : " (show both hands)"}`));
    return;
  }
  state.recording = null;
  box.hidden = true;
  saveTaught();
  rebuildClassifier();
}

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ app: "signframe", version: 1, aspect: view.width / view.height, samples: state.taught })], { type: "application/json" });
  const link = el("a");
  link.href = URL.createObjectURL(blob);
  link.download = "signframe-examples.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const samples = (data.samples || []).filter((s) => s && TEACH.some((t) => t.label === s.label) && Array.isArray(s.features) && s.features.every(Number.isFinite));
    if (!samples.length) throw new Error("empty");
    state.taught = [...state.taught, ...samples];
    saveTaught();
    rebuildClassifier();
  } catch {
    $("teach-score").textContent = "That file could not be read as signframe examples.";
  }
});
$("clear-all").addEventListener("click", () => {
  state.taught = [];
  saveTaught();
  rebuildClassifier();
});

/* ---------- starting and stopping ---------- */

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = !message;
}
function setBusy(busy, label) {
  $("start-camera").disabled = $("start-demo").disabled = busy;
  $("start-camera").textContent = busy ? label : "Use my camera";
}
function cameraErrorMessage(err) {
  if (err?.name === "NotAllowedError") return "Camera access was blocked. Allow the camera for this page in your browser, then try again.";
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "No camera was found. You can still watch the demo.";
  if (err?.name === "NotReadableError") return "The camera is in use by another app. Close it there, then try again.";
  return "The camera could not be started. You can still watch the demo.";
}

async function startCamera() {
  showError("");
  if (!navigator.mediaDevices?.getUserMedia) {
    showError("This browser cannot open the camera here. Use a recent browser over https, or watch the demo.");
    return;
  }
  let stream;
  try {
    setBusy(true, "Waiting for camera…");
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    setBusy(true, "Loading hand tracking…");
    const { createTracker } = await import("./tracking.js");
    const tracker = await createTracker();
    setBusy(true, "Loading background cut-out…");
    let segmenter = null;
    try {
      const { createSegmenter } = await import("./segment.js");
      segmenter = await createSegmenter();
    } catch (err) {
      console.error(err); // worlds will tint the room instead of replacing it
    }
    begin({
      kind: "camera",
      image: video,
      get mask() {
        return segmenter?.mask ?? null;
      },
      get width() {
        return video.videoWidth;
      },
      get height() {
        return video.videoHeight;
      },
      mirrored: true,
      hands: (nowMs) => tracker.detect(video, nowMs),
      updateMask: (nowMs) => segmenter?.update(video, nowMs, state.swapMask),
      stop() {
        for (const track of stream.getTracks()) track.stop();
        video.srcObject = null;
        tracker.close();
        segmenter?.close();
      },
    });
  } catch (err) {
    console.error(err);
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
      showError("Hand tracking could not be loaded. Check your connection and try again, or watch the demo.");
    } else {
      showError(cameraErrorMessage(err));
    }
  } finally {
    setBusy(false);
  }
}

function begin(source) {
  compositor ??= createCompositor(view);
  state.source = source;
  state.running = true;
  state.show.reset();
  state.quad = null;
  state.cardAlpha = 0;
  state.lastScriptTime = 0;
  smoother.reset();
  rebuildClassifier();
  $("stage").style.aspectRatio = `${source.width} / ${source.height}`;
  $("start").hidden = true;
  $("hint").hidden = $("readout").hidden = $("stop").hidden = false;
  $("teach-panel").hidden = $("swap-wrap").hidden = source.kind !== "camera";
  if (source.kind === "camera" && !state.classifier.ready) $("teach-panel").open = true;
  paintControls();
  requestAnimationFrame(frame);
}

function stop() {
  state.running = false;
  state.recording = null;
  state.source?.stop();
  state.source = null;
  $("start").hidden = false;
  $("hint").hidden = $("readout").hidden = $("stop").hidden = $("count-in").hidden = true;
  overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
  paintTeach();
}

/* ---------- the frame loop ---------- */

function hintFor(hands, world, card) {
  if (state.source.kind === "demo") return "Demo with simulated hands and signs";
  if (state.recording) return "Recording examples";
  if (!state.classifier.ready) return "Teach your signs below first, or press 1, 2 or 3";
  if (!world) return hands.length === 2 ? "Hold one of your signs" : "Show both hands and make a sign";
  if (card === null) return "Make a frame with both hands to see a character";
  return "Drop the frame and make it again for the next character";
}

function drawSignRing(ctx, hands, nowMs, w, h) {
  const progress = state.detector.progress(nowMs);
  if (!progress || hands.length !== 2) return;
  const cx = (hands[0][9].x + hands[1][9].x) / 2 * w;
  const cy = (hands[0][9].y + hands[1][9].y) / 2 * h;
  const world = WORLDS.find((wd) => wd.sign === state.detector.candidate);
  ctx.strokeStyle = world?.accent ?? "#fff";
  ctx.lineWidth = h * 0.012;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.11, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
}

const accentOf = (worldId) => WORLDS.find((w) => w.id === worldId)?.accent ?? "#ffffff";

function frame(nowMs) {
  if (!state.running) return;
  const source = state.source;
  const { width, height } = source;
  if (!width || !height) {
    requestAnimationFrame(frame);
    return;
  }
  const aspect = width / height;
  const hands = source.hands(nowMs);

  if (source.kind === "demo") { // the script loops: start each loop from the room
    const t = source.scriptTime(nowMs);
    if (t < state.lastScriptTime) {
      state.show.reset();
      state.detector = new SignDetector();
    }
    state.lastScriptTime = t;
  }

  recordStep(hands, nowMs, aspect);
  const guess = state.recording ? { label: NONE, confidence: 0 } : state.classifier.predict(signFeatures(hands, aspect));
  state.guess = guess;
  const event = state.detector.update(guess, nowMs);
  if (event && state.show.sign(event, nowMs)) {
    startBurst(state.show.world, nowMs, hands);
    paintControls();
  }

  const framed = holdsFrame(hands, guess);
  const before = state.show.cards.index;
  const { world, card } = state.show.update(framed, nowMs);
  if (state.show.cards.index !== before) paintControls();
  if (framed) state.quad = smoother.update(cornersFromHands(hands), nowMs);
  else smoother.reset();
  state.cardAlpha += ((card !== null ? 1 : 0) - state.cardAlpha) * 0.22;
  if (state.cardAlpha < 0.02) state.cardAlpha = 0;

  if (world) source.updateMask(nowMs);
  const sinceChange = nowMs - state.show.changedAt;
  compositor.draw({
    source,
    world: world ? { id: world, amount: Math.min(1, sinceChange / 350), accent: accentOf(world) } : null,
    card: state.quad && state.cardAlpha > 0 && world ? { layers: state.cardCanvases[state.show.cards.index], quad: state.quad, alpha: state.cardAlpha } : null,
    burst: state.burst ? { ...state.burst, age: (nowMs - state.burst.at) / 700 } : null,
    time: nowMs / 1000,
  });
  drawOverlay(overlay, { width, height, hands, showHands: state.showHands, color: world ? accentOf(world) : "#ffffff" });
  drawSignRing(overlay.getContext("2d"), hands, nowMs, width, height);

  if (state.lastFrameAt) state.fps += (1000 / Math.max(nowMs - state.lastFrameAt, 1) - state.fps) * 0.08;
  state.lastFrameAt = nowMs;
  const worldName = world ? WORLDS.find((w) => w.id === world).name : "your room";
  const seen = guess.label === NONE ? "no sign" : `${guess.label} ${Math.round(guess.confidence * 100)}%`;
  $("readout").textContent = `${Math.round(state.fps)} fps · ${hands.length} hand${hands.length === 1 ? "" : "s"} · ${seen} · ${worldName}`;
  const hint = hintFor(hands, world, card);
  if ($("hint").textContent !== hint) $("hint").textContent = hint;
  requestAnimationFrame(frame);
}

/* ---------- controls ---------- */

$("start-camera").addEventListener("click", startCamera);
$("start-demo").addEventListener("click", () => {
  showError("");
  begin(createDemoSource());
});
$("stop").addEventListener("click", stop);
$("show-hands").addEventListener("change", (e) => (state.showHands = e.target.checked));
$("swap-mask").addEventListener("change", (e) => (state.swapMask = e.target.checked));
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || !state.running) return;
  if (e.target instanceof HTMLInputElement && e.target.type !== "checkbox") return;
  const key = e.key.toLowerCase();
  if (key === "0" || key === "escape") enterWorld(0);
  else if (/^[1-3]$/.test(key)) enterWorld(Number(key));
  else if (key === "n") pickCard(state.show.cards.index + 1);
  else if (key === "h") {
    state.showHands = !state.showHands;
    $("show-hands").checked = state.showHands;
  }
});

/* ---------- start-up ---------- */

async function init() {
  let pack;
  try {
    pack = parsePack(await (await fetch(`${BASE}pack/pack.json`)).json());
  } catch (err) {
    console.error(err);
    showError(`The character pack could not be loaded: ${err.message}`);
    $("start-camera").disabled = $("start-demo").disabled = true;
    return;
  }
  state.pack = pack;
  state.cardCanvases = await buildCards(pack, `${BASE}pack/`);
  state.show = new Show(WORLDS.map((w) => w.id), pack.cards.length);
  try {
    const shipped = await (await fetch(`${BASE}model/signs.json`)).json();
    state.shipped = Array.isArray(shipped.samples) ? shipped.samples : [];
  } catch {
    state.shipped = [];
  }
  state.taught = loadTaught();
  buildChips($("worlds"), ["Your room", ...WORLDS.map((w) => w.name)], (i) => state.running && enterWorld(i));
  buildChips($("cast"), pack.cards.map((c) => c.name), (i) => state.running && pickCard(i));
  paintControls();
  rebuildClassifier();
  window.__signframe = state; // handy for debugging in the console
}
init();

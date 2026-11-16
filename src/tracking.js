// Hand tracking with MediaPipe. The model runs in the browser; no video leaves the device.
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

// Tried in order: a copy in public/models (if you add one), then Google's hosted model.
const MODEL_URLS = [
  `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
];

async function firstReachable(urls) {
  for (const url of urls.slice(0, -1)) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok && !(res.headers.get("content-type") || "").includes("text/html")) return url;
    } catch {
      /* try the next one */
    }
  }
  return urls[urls.length - 1];
}

export async function createTracker() {
  const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  const modelAssetPath = await firstReachable(MODEL_URLS);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: "VIDEO",
    numHands: 2,
  });
  let landmarker;
  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    landmarker = await HandLandmarker.createFromOptions(fileset, options("CPU"));
  }

  let lastVideoTime = -1;
  let lastHands = [];
  return {
    /** Returns hands as arrays of 21 points in display space (mirrored, 0..1). */
    detect(video, nowMs) {
      if (video.currentTime === lastVideoTime) return lastHands; // no new camera frame yet
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, nowMs);
      lastHands = (result.landmarks || []).map((hand) => hand.map((p) => ({ x: 1 - p.x, y: p.y })));
      return lastHands;
    },
    close() {
      landmarker.close();
    },
  };
}

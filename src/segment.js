// Separates the person from the room with MediaPipe's selfie segmenter, on the device.
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

const MODEL_URLS = [
  `${import.meta.env.BASE_URL}models/selfie_segmenter.tflite`,
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
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

/** Writes person-ness (0..1 per pixel) into the alpha channel of a small canvas. */
export function paintMask(maskCanvas, values, width, height, invert = false) {
  if (maskCanvas.width !== width || maskCanvas.height !== height) {
    maskCanvas.width = width;
    maskCanvas.height = height;
  }
  const ctx = maskCanvas.getContext("2d");
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < values.length; i++) {
    const v = invert ? 1 - values[i] : values[i];
    // Steepen the edge so half-sure pixels do not leave a ghostly halo.
    const a = Math.min(1, Math.max(0, (v - 0.35) / 0.3));
    image.data[i * 4 + 3] = a * 255;
  }
  ctx.putImageData(image, 0, 0);
}

export async function createSegmenter() {
  const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  const modelAssetPath = await firstReachable(MODEL_URLS);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath, delegate },
    runningMode: "VIDEO",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  let segmenter;
  try {
    segmenter = await ImageSegmenter.createFromOptions(fileset, options("GPU"));
  } catch {
    segmenter = await ImageSegmenter.createFromOptions(fileset, options("CPU"));
  }
  const maskCanvas = document.createElement("canvas");
  let lastVideoTime = -1;
  return {
    mask: maskCanvas,
    /** Updates the mask canvas from the current camera frame. invert swaps person and background. */
    update(video, nowMs, invert) {
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      segmenter.segmentForVideo(video, nowMs, (result) => {
        const masks = result.confidenceMasks;
        if (!masks || !masks.length) return;
        const person = masks[masks.length - 1]; // one mask: the person; two: background, then person
        paintMask(maskCanvas, person.getAsFloat32Array(), person.width, person.height, invert);
      });
    },
    close() {
      segmenter.close();
    },
  };
}

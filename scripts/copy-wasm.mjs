// Copies MediaPipe's WebAssembly runtime next to the app so it is served from the same origin.
import { cpSync, mkdirSync } from "node:fs";

const from = "node_modules/@mediapipe/tasks-vision/wasm";
const to = "public/wasm";
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`copied ${from} -> ${to}`);

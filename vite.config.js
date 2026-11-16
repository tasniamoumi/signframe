import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // works on GitHub Pages under /handframe/ and anywhere else
  test: { include: ["tests/**/*.test.js"] },
});

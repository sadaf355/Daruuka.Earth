/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Vitest exits non-zero when it finds no test files; being explicit about where
    // tests live keeps `npm test` meaningful in CI.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

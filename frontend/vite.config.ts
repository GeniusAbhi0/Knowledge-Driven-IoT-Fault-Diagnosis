/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const backend = loadEnv(mode, ".", "VITE_").VITE_BACKEND_URL ?? "http://localhost:8000";
  return {
  plugins: [react()],
  server: { proxy: { "/api": backend, "/ws": { target: backend, ws: true } } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/setupTests.ts"] },
  };
});

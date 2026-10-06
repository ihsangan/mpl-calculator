import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Sourcemaps expose the full source to anyone downloading the bundle, so
    // they are opt-in for local debugging rather than shipped by default.
    sourcemap: process.env.BUILD_SOURCEMAP === "true",
  },
  worker: {
    // The simulation worker dynamically imports the ELO engine so it ships as
    // a separate chunk. IIFE workers cannot code-split, which would pull the
    // ELO code back into the worker bundle.
    format: "es",
  },
})

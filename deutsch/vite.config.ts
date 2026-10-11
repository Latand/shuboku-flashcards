import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// tgcloud serves the site from the host root, so `base` stays at its default.
// The scheduler and Telegram helpers live in Shuboku's src/, one level up.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [".."] } },
});

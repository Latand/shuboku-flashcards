import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/shuboku-flashcards/",
  plugins: [react()],
});

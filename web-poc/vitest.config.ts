import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // The screen tests drive whole flows through the mock API; 5 s is too tight when the machine is busy.
    testTimeout: 20_000,
    env: { NEXT_PUBLIC_API_URL: "http://localhost/api" },
  },
});

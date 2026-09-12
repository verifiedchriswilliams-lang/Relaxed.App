import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the pure logic (audio levels, session timing/blueprints, the
// breath clock, formatters, history storage, rate limiting). No DOM is needed;
// history's localStorage is polyfilled in tests/setup.ts. The "@" alias mirrors
// tsconfig so lib modules resolve the same way they do in the app.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 120000,
    reporters: ["basic"],
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
})



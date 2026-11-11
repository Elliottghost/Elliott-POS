import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "./data/test-foundation.db",
      APP_URL: "http://localhost:3000",
      AUTH_EXPOSE_RESET_LINKS: "true",
      AUTH_RESET_TOKEN_TTL_MINUTES: "30",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});

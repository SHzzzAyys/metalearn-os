import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@metalearn/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@metalearn/learning-science": new URL("./packages/learning-science/src/index.ts", import.meta.url).pathname,
      "@metalearn/ai": new URL("./packages/ai/src/index.ts", import.meta.url).pathname,
      "@metalearn/storage": new URL("./packages/storage/src/index.ts", import.meta.url).pathname
    }
  }
});


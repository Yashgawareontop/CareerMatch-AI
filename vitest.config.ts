import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Forward slashes: on Windows Vite resolves "D:/x/" but not "D:\x\".
const root = fileURLToPath(new URL(".", import.meta.url)).replaceAll("\\", "/")

const shared = {
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // Next's guard against client bundles has nothing to guard in tests.
      {
        find: /^server-only$/,
        replacement: `${root}tests/stubs/server-only.ts`,
      },
    ],
  },
}

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: "convex",
          // Convex functions run in Convex's edge-like runtime.
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        ...shared,
        test: {
          name: "unit",
          environment: "node",
          include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
        },
      },
    ],
  },
})

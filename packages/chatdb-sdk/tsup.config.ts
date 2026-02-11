import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    clean: true,
    outDir: "dist",
    external: ["pg", "mysql2", "better-sqlite3"],
  },
  {
    entry: ["src/cli/index.ts"],
    format: ["esm"],
    outDir: "dist/cli",
    banner: { js: "#!/usr/bin/env node" },
    external: ["pg", "mysql2", "better-sqlite3"],
  },
]);

import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    // Never bundled in: the app must resolve a single copy of each (see README).
    external: ["react", "slz-form"],
    tsconfig: "tsconfig.build.json",
});

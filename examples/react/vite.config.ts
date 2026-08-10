import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        // In this repo the example runs against the packages' **source**, so editing
        // the engine hot-reloads the demo without a rebuild. A real consumer resolves
        // `dist` through the packages' `exports` instead.
        alias: {
            "slz-react-form": source("../../packages/react-form/src/index.ts"),
            "slz-form": source("../../packages/form/src/index.ts"),
        },
        // A single copy of each: two copies of React break hooks, and two copies of
        // slz-form break the `instanceof BehaviorState` check inside the engine.
        dedupe: ["react", "react-dom", "slz-form"],
    },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        // Une seule copie du core : le moteur teste `result instanceof
        // BehaviorState`, et deux copies feraient échouer le test en silence.
        alias: { "slz-form": new URL("../form/src/index.ts", import.meta.url).pathname },
        dedupe: ["react", "react-dom", "slz-form"],
    },
    test: {
        include: ["test/**/*.test.tsx"],
        environment: "jsdom",
    },
});
